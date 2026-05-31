// =====================================================
// upload.js — Image upload proxy with automatic failover.
//
// DEFAULT priority (best for a scanlation site — lossless + DMCA-resilient):
//   1. Catbox  — anonymous, no account tie, stores ORIGINAL (lossless),
//                separate from your Cloudflare account so a strike on an
//                image can't take down your whole site. ← primary
//   2. ImgBB   — backup. (Note: ImgBB may re-encode; used only if Catbox
//                fails, so a page still gets hosted rather than lost.)
//   3. R2      — only if you explicitly opt in (STORAGE_PRIMARY=r2). R2 lives
//                inside your Cloudflare account, so it shares DMCA exposure
//                with the main site — off by default for safety.
//
// Override the order with the STORAGE_PRIMARY env var: "catbox" | "imgbb" | "r2".
// Uploads automatically FAIL OVER down the chain, so one host being down
// never means a lost page.
//
// To add an ImgBB backup key (free, no card — https://api.imgbb.com/):
//   Cloudflare Dashboard → Workers → voidscans → Settings → Variables
//   → add IMGBB_API_KEY, click Encrypt, Save & deploy.
// =====================================================

const IMGBB_API = 'https://api.imgbb.com/1/upload';
const CATBOX_API = 'https://catbox.moe/user/api.php';

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ---- Individual backends ----
async function toCatbox(_env, file) {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', file, file.name || 'image.jpg');
  const res = await fetch(CATBOX_API, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Catbox HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) {
    throw new Error(`Catbox unexpected response: ${text.slice(0, 100)}`);
  }
  return text;
}

async function toImgBB(env, file) {
  if (!env.IMGBB_API_KEY) throw new Error('IMGBB_API_KEY not configured');
  const b64 = await blobToBase64(file);
  const fd = new FormData();
  fd.append('key', env.IMGBB_API_KEY);
  fd.append('image', b64);
  if (file.name) fd.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 100));
  const res = await fetch(IMGBB_API, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`ImgBB HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`ImgBB: ${json.error?.message || 'upload failed'}`);
  return json.data?.image?.url || json.data?.url || json.data?.display_url;
}

async function toR2(env, file, key) {
  if (!env.R2_BUCKET || !env.R2_PUBLIC_BASE) throw new Error('R2 not configured');
  const k = key || `uploads/${Date.now()}-${(file.name || 'img').replace(/[^a-z0-9._-]/gi, '_')}`;
  await env.R2_BUCKET.put(k, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' }
  });
  return `${(env.R2_PUBLIC_BASE || '').replace(/\/$/, '')}/${k}`;
}

const BACKENDS = {
  catbox: { available: () => true,                                   run: toCatbox },
  imgbb:  { available: (env) => !!env.IMGBB_API_KEY,                 run: toImgBB },
  r2:     { available: (env) => !!(env.R2_BUCKET && env.R2_PUBLIC_BASE), run: toR2 }
};

/** Build the ordered, availability-filtered failover chain. */
function buildChain(env) {
  const primary = String(env.STORAGE_PRIMARY || 'catbox').toLowerCase();
  // Default order favours Catbox (lossless + DMCA-safe), then ImgBB backup.
  // R2 only joins the chain when explicitly chosen as primary.
  let order;
  if (primary === 'imgbb')      order = ['imgbb', 'catbox'];
  else if (primary === 'r2')    order = ['r2', 'catbox', 'imgbb'];
  else                          order = ['catbox', 'imgbb'];   // default
  return order.filter(name => BACKENDS[name]?.available(env));
}

/** Upload a file through the failover chain. Returns { url, backend }. */
async function uploadFile(env, file, suggestedKey) {
  const chain = buildChain(env);
  if (!chain.length) throw new Error('No storage backend available');
  let lastErr;
  for (const name of chain) {
    try {
      const url = await BACKENDS[name].run(env, file, suggestedKey);
      if (url) return { url, backend: name };
    } catch (e) {
      lastErr = e;
      // try next backend in the chain
    }
  }
  throw new Error(`All storage backends failed (${chain.join(' → ')}): ${lastErr?.message || 'unknown'}`);
}

export function getStorageChain(env) {
  return buildChain(env);
}

export async function handleStorageInfo(_request, env) {
  const chain = buildChain(env);
  return Response.json({
    primary: chain[0] || null,
    chain,
    available: {
      catbox: true,
      imgbb: !!env.IMGBB_API_KEY,
      r2: !!(env.R2_BUCKET && env.R2_PUBLIC_BASE)
    },
    note: 'Catbox is primary (lossless + DMCA-resilient). ImgBB used as automatic backup if Catbox fails. Set STORAGE_PRIMARY env to change.'
  });
}

export async function handleUpload(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'POST only' }, { status: 405 });
  }
  try {
    const fd = await request.formData();
    const file = fd.get('file');
    const seriesSlug = String(fd.get('series') || 'misc').replace(/[^a-z0-9-]/gi, '-');
    const chapterNum = String(fd.get('chapter') || '').replace(/[^0-9.]/g, '');
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return Response.json({ ok: false, error: 'No file in form field "file"' }, { status: 400 });
    }
    const safeName = (file.name || 'img').replace(/[^a-z0-9._-]/gi, '_');
    const key = chapterNum
      ? `chapters/${seriesSlug}/${chapterNum}/${safeName}`
      : `uploads/${Date.now()}-${safeName}`;
    const { url, backend } = await uploadFile(env, file, key);
    return Response.json({ ok: true, url, name: file.name, backend });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function handleBulkUpload(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'POST only' }, { status: 405 });
  }
  try {
    const fd = await request.formData();
    const files = fd.getAll('files');
    const seriesSlug = String(fd.get('series') || 'misc').replace(/[^a-z0-9-]/gi, '-');
    const chapterNum = String(fd.get('chapter') || '').replace(/[^0-9.]/g, '');
    if (!files.length) {
      return Response.json({ ok: false, error: 'No files in "files" field' }, { status: 400 });
    }
    const results = [];
    let i = 0;
    for (const file of files) {
      i++;
      try {
        const safeName = (file.name || `${i}.jpg`).replace(/[^a-z0-9._-]/gi, '_');
        const padded = String(i).padStart(3, '0');
        const key = chapterNum
          ? `chapters/${seriesSlug}/${chapterNum}/${padded}-${safeName}`
          : `uploads/${Date.now()}-${padded}-${safeName}`;
        const { url, backend } = await uploadFile(env, file, key);
        results.push({ ok: true, name: file.name, url, backend });
      } catch (err) {
        results.push({ ok: false, name: file.name, error: err.message });
      }
    }
    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function rehostFromUrl(env, sourceUrl, suggestedKey) {
  const dl = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JayaScans/1.0)',
      'Referer': new URL(sourceUrl).origin
    }
  });
  if (!dl.ok) throw new Error(`Source returned ${dl.status}`);
  const blob = await dl.blob();
  const name = sourceUrl.split('/').pop().split('?')[0] || 'image.jpg';
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  const { url } = await uploadFile(env, file, suggestedKey);
  return url;
}
