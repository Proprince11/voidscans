// =====================================================
// upload.js — Image upload proxy.
//
// Why a proxy?
//   - Catbox does not enable CORS, so browsers cannot upload directly.
//   - This Worker accepts a multipart upload from admin, forwards it
//     to Catbox server-side, and returns the public URL.
//
// R2 fallback:
//   - If env.R2_BUCKET is bound (user has set up R2), uploads go there
//     instead. Returns the R2 public URL via env.R2_PUBLIC_BASE.
// =====================================================

const CATBOX_API = 'https://catbox.moe/user/api.php';

async function toCatbox(file, hint = 'image.jpg') {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', file, file.name || hint);
  const res = await fetch(CATBOX_API, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Catbox HTTP ${res.status}`);
  const text = (await res.text()).trim();
  if (!text.startsWith('https://files.catbox.moe/')) {
    throw new Error(`Catbox unexpected response: ${text.slice(0, 100)}`);
  }
  return text;
}

async function toR2(env, file, key) {
  if (!env.R2_BUCKET) return null;
  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' }
  });
  const base = (env.R2_PUBLIC_BASE || '').replace(/\/$/, '');
  return `${base}/${key}`;
}

async function uploadFile(env, file, suggestedKey) {
  if (env.R2_BUCKET && env.R2_PUBLIC_BASE) {
    const key = suggestedKey
      || `uploads/${Date.now()}-${(file.name || 'img').replace(/[^a-z0-9._-]/gi, '_')}`;
    return await toR2(env, file, key);
  }
  return await toCatbox(file, file.name);
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
    return Response.json({ ok: true, url, name: file.name });
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
    return Response.json({ ok: true, results });
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
