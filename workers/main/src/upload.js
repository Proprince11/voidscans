// =====================================================
// upload.js — Image upload proxy.
//
// Storage priority (auto-detected, first available wins):
//   1. R2     — if env.R2_BUCKET binding + env.R2_PUBLIC_BASE var present
//   2. ImgBB  — if env.IMGBB_API_KEY secret present  ← recommended
//   3. Catbox — last-resort fallback, anonymous, no setup
//
// Catbox is the only option that works without any user setup, but
// it's less reliable. Set IMGBB_API_KEY for the recommended path.
//
// To set the ImgBB key:
//   Cloudflare Dashboard → Workers → voidscans → Settings → Variables
//   → Add variable → name: IMGBB_API_KEY, value: <your key>, mark as secret
//
// Get a free key at https://api.imgbb.com/ — no card required.
// =====================================================

const IMGBB_API = 'https://api.imgbb.com/1/upload';
const CATBOX_API = 'https://catbox.moe/user/api.php';

/** Convert a Blob/File to base64 string (without data: prefix). */
async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Workers has btoa but it works on binary strings, not Uint8Array.
  // Build a binary string in chunks to avoid call-stack overflow on large files.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Upload to ImgBB. Requires API key. */
async function toImgBB(env, file) {
  const key = env.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY not configured');
  const b64 = await blobToBase64(file);
  const fd = new FormData();
  fd.append('key', key);
  fd.append('image', b64);
  // Optional: name (if file has one)
  if (file.name) fd.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 100));
  const res = await fetch(IMGBB_API, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`ImgBB HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(`ImgBB: ${json.error?.message || 'upload failed'}`);
  }
  return json.data?.image?.url || json.data?.url || json.data?.display_url;
}

/** Upload to Catbox as last-resort fallback. */
async function toCatbox(file) {
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

/** Upload to R2 if bound. */
async function toR2(env, file, key) {
  if (!env.R2_BUCKET) return null;
  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' }
  });
  const base = (env.R2_PUBLIC_BASE || '').replace(/\/$/, '');
  return `${base}/${key}`;
}

async function uploadFile(env, file, suggestedKey) {
  // R2 wins if bound + public base configured
  if (env.R2_BUCKET && env.R2_PUBLIC_BASE) {
    const key = suggestedKey
      || `uploads/${Date.now()}-${(file.name || 'img').replace(/[^a-z0-9._-]/gi, '_')}`;
    return await toR2(env, file, key);
  }
  // ImgBB if API key present (recommended)
  if (env.IMGBB_API_KEY) {
    return await toImgBB(env, file);
  }
  // Last resort: Catbox
  return await toCatbox(file);
}

/** Reports which backend will be used (for admin debug + diagnostics). */
export function getStorageBackend(env) {
  if (env.R2_BUCKET && env.R2_PUBLIC_BASE) return 'r2';
  if (env.IMGBB_API_KEY) return 'imgbb';
  return 'catbox';
}

export async function handleStorageInfo(_request, env) {
  return Response.json({
    backend: getStorageBackend(env),
    r2: !!(env.R2_BUCKET && env.R2_PUBLIC_BASE),
    imgbb: !!env.IMGBB_API_KEY,
    catbox: true,
    recommended: env.R2_BUCKET ? 'r2 (configured)' : env.IMGBB_API_KEY ? 'imgbb (configured)' : 'imgbb — set IMGBB_API_KEY in Cloudflare Workers env'
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
    const url = await uploadFile(env, file, key);
    return Response.json({ ok: true, url, name: file.name, backend: getStorageBackend(env) });
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
        const url = await uploadFile(env, file, key);
        results.push({ ok: true, name: file.name, url });
      } catch (err) {
        results.push({ ok: false, name: file.name, error: err.message });
      }
    }
    return Response.json({ ok: true, backend: getStorageBackend(env), results });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function rehostFromUrl(env, sourceUrl, suggestedKey) {
  const dl = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VoidScans/1.0)',
      'Referer': new URL(sourceUrl).origin
    }
  });
  if (!dl.ok) throw new Error(`Source returned ${dl.status}`);
  const blob = await dl.blob();
  const name = sourceUrl.split('/').pop().split('?')[0] || 'image.jpg';
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  return uploadFile(env, file, suggestedKey);
}
