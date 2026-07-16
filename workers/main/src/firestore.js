// =====================================================
// firestore.js — Read-only Firestore REST helpers for the Worker.
// Used by RSS + sitemap. No auth — relies on Firestore rules
// allowing public read on series/chapters.
// =====================================================

const BASE = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function unwrapValue(v) {
  if (v == null) return null;
  if ('stringValue'    in v) return v.stringValue;
  if ('integerValue'   in v) return Number(v.integerValue);
  if ('doubleValue'    in v) return Number(v.doubleValue);
  if ('booleanValue'   in v) return !!v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue'      in v) return null;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(unwrapValue);
  if ('mapValue'       in v) {
    const f = v.mapValue.fields || {};
    const o = {};
    for (const k of Object.keys(f)) o[k] = unwrapValue(f[k]);
    return o;
  }
  return null;
}

function unwrap(doc) {
  if (!doc) return null;
  const id = doc.name?.split('/').pop();
  const out = { _id: id };
  const fields = doc.fields || {};
  for (const k of Object.keys(fields)) out[k] = unwrapValue(fields[k]);
  return out;
}

export async function listDocs(projectId, collection, { pageSize = 200 } = {}) {
  const url = `${BASE(projectId)}/${collection}?pageSize=${pageSize}`;
  const res = await fetch(url, { cf: { cacheTtl: 120 } });
  if (!res.ok) throw new Error(`Firestore list ${collection}: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(unwrap);
}

export async function queryDocs(projectId, collection, filters = [], orderBy = null, limit = 100) {
  const where = filters.length === 1
    ? { fieldFilter: { field: { fieldPath: filters[0].field }, op: filters[0].op, value: filters[0].value } }
    : (filters.length > 1
        ? { compositeFilter: { op: 'AND', filters: filters.map(f => ({
            fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: f.value }
          })) } }
        : undefined);

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      ...(where ? { where } : {}),
      ...(orderBy ? { orderBy: [{ field: { fieldPath: orderBy.field }, direction: orderBy.direction }] } : {}),
      limit
    }
  };

  const res = await fetch(`${BASE(projectId)}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cf: { cacheTtl: 120 }
  });
  if (!res.ok) throw new Error(`Firestore query ${collection}: ${res.status}`);
  const arr = await res.json();
  return (Array.isArray(arr) ? arr : [])
    .filter(r => r.document)
    .map(r => unwrap(r.document));
}

export function tsToDate(t) {
  if (!t) return null;
  if (typeof t === 'string') return new Date(t);
  if (t.seconds) return new Date(t.seconds * 1000);
  return new Date(t);
}

/**
 * Patch (merge-update) a single Firestore document.
 * Requires env.FIREBASE_SA_TOKEN or env.FIREBASE_SA_KEY (service account JSON
 * for auto-minting). Store as encrypted secrets in Cloudflare Workers.
 */
export async function patchDoc(projectId, collection, docId, fields, env) {
  let token = env?.FIREBASE_SA_TOKEN;
  
  // If no pre-minted token, try to self-mint from service account key
  if (!token && env?.FIREBASE_SA_KEY) {
    token = await mintTokenFromKey(env.FIREBASE_SA_KEY);
  }
  if (!token) throw new Error('FIREBASE_SA_TOKEN or FIREBASE_SA_KEY env var not set — cannot write to Firestore from Worker');

  // Build Firestore REST field map
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) {
      firestoreFields[k] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      firestoreFields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      firestoreFields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    } else {
      firestoreFields[k] = { stringValue: String(v) };
    }
  }

  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${BASE(projectId)}/${collection}/${docId}?${updateMask}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fields: firestoreFields })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore PATCH ${collection}/${docId}: ${res.status} ${err}`);
  }
  return await res.json();
}

// =====================================================
// TOKEN MINTING — generate OAuth2 token from service account JSON
// =====================================================
let _mintedToken = null;
let _mintedExpires = 0;

export async function mintTokenFromKey(saKeyJson) {
  const now = Date.now();
  if (_mintedToken && now < _mintedExpires) return _mintedToken;

  const sa = typeof saKeyJson === 'string' ? JSON.parse(saKeyJson) : saKeyJson;
  const nowSec = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600
  };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  const pem = sa.private_key;
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token mint failed: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  _mintedToken = data.access_token;
  _mintedExpires = now + 55 * 60 * 1000;
  return _mintedToken;
}
