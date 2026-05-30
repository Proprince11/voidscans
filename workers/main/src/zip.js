// =====================================================
// zip.js — Minimal ZIP encoder (STORED mode, no compression).
//
// Why no compression? We only zip already-compressed images
// (JPEG/PNG/WebP), so deflate would barely shrink anything
// and would burn CPU. STORED mode = pure concatenation with
// ZIP headers. ~80 lines, no external deps.
//
// Spec: PKWARE APPNOTE, section 4.3 (LFH + CDH + EOCD).
// =====================================================

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c;
  }
  return t;
})();

function crc32(uint8) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < uint8.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ uint8[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Build a ZIP archive from an array of { name, data: Uint8Array } files.
 *  Returns a single Uint8Array ready to send as application/zip. */
export function makeZip(files) {
  const enc = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    // ---- Local File Header (30 bytes + name) ----
    const lfh = new Uint8Array(30);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);   // signature
    dv.setUint16(4, 20, true);           // version needed
    dv.setUint16(6, 0x0800, true);       // general purpose flags (UTF-8 names)
    dv.setUint16(8, 0, true);            // compression method (0 = STORED)
    dv.setUint16(10, 0, true);           // mod time
    dv.setUint16(12, 0, true);           // mod date
    dv.setUint32(14, crc, true);         // CRC-32
    dv.setUint32(18, size, true);        // compressed size
    dv.setUint32(22, size, true);        // uncompressed size
    dv.setUint16(26, nameBytes.length, true); // filename length
    dv.setUint16(28, 0, true);           // extra field length

    local.push({ lfh, nameBytes, data: f.data });

    // ---- Central Directory Header (46 bytes + name) ----
    const cdh = new Uint8Array(46);
    const dvc = new DataView(cdh.buffer);
    dvc.setUint32(0, 0x02014b50, true);  // signature
    dvc.setUint16(4, 20, true);          // version made by
    dvc.setUint16(6, 20, true);          // version needed
    dvc.setUint16(8, 0x0800, true);      // flags
    dvc.setUint16(10, 0, true);          // compression
    dvc.setUint16(12, 0, true);          // mod time
    dvc.setUint16(14, 0, true);          // mod date
    dvc.setUint32(16, crc, true);
    dvc.setUint32(20, size, true);
    dvc.setUint32(24, size, true);
    dvc.setUint16(28, nameBytes.length, true);
    dvc.setUint16(30, 0, true);          // extra
    dvc.setUint16(32, 0, true);          // comment
    dvc.setUint16(34, 0, true);          // disk number
    dvc.setUint16(36, 0, true);          // internal attrs
    dvc.setUint32(38, 0, true);          // external attrs
    dvc.setUint32(42, offset, true);     // local header offset

    central.push({ cdh, nameBytes });
    offset += lfh.length + nameBytes.length + size;
  }

  const cdSize = central.reduce((s, c) => s + c.cdh.length + c.nameBytes.length, 0);

  // ---- End of Central Directory Record (22 bytes) ----
  const eocd = new Uint8Array(22);
  const dve = new DataView(eocd.buffer);
  dve.setUint32(0, 0x06054b50, true);
  dve.setUint16(4, 0, true);
  dve.setUint16(6, 0, true);
  dve.setUint16(8, files.length, true);
  dve.setUint16(10, files.length, true);
  dve.setUint32(12, cdSize, true);
  dve.setUint32(16, offset, true);
  dve.setUint16(20, 0, true);

  // ---- Concatenate everything ----
  const total = offset + cdSize + 22;
  const zip = new Uint8Array(total);
  let pos = 0;
  for (const p of local) {
    zip.set(p.lfh, pos); pos += 30;
    zip.set(p.nameBytes, pos); pos += p.nameBytes.length;
    zip.set(p.data, pos); pos += p.data.length;
  }
  for (const c of central) {
    zip.set(c.cdh, pos); pos += 46;
    zip.set(c.nameBytes, pos); pos += c.nameBytes.length;
  }
  zip.set(eocd, pos);

  return zip;
}
