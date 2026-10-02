// Build: copies src/ to dist/, vendors Tesseract.js (worker, wasm core) from
// node_modules and generates the icon PNGs. No network access is needed after `npm install`.
import { cpSync, mkdirSync, rmSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const nm = join(root, 'node_modules');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'src'), dist, { recursive: true });

const vendor = join(dist, 'vendor');
mkdirSync(vendor, { recursive: true });
const vendorFiles = [
  ['tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only cores; the worker picks the best one for the CPU at runtime.
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
];
for (const [from, to] of vendorFiles) cpSync(join(nm, from), join(vendor, to));
// MRZ-specific OCR-B language model (BSD-3-Clause, see third_party/tessdata/README.md).
cpSync(join(root, 'third_party/tessdata/mrz.traineddata.gz'), join(vendor, 'mrz.traineddata.gz'));
cpSync(join(root, 'third_party/tessdata/LICENSE.txt'), join(vendor, 'LICENSE.tesseractMRZ.txt'));
cpSync(join(nm, 'tesseract.js/dist/tesseract.min.js.LICENSE.txt'), join(vendor, 'LICENSE.tesseract.js.txt'));
cpSync(join(nm, 'tesseract.js-core/LICENSE'), join(vendor, 'LICENSE.tesseract.js-core.txt'));

// ---- icons: tiny PNG encoder (RGBA, no deps) ----
function crc32(buf) {
  let c; const table = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function icon(size) {
  const r = size * 0.2;
  return png(size, (x, y) => {
    const cx = Math.min(Math.max(x + 0.5, r), size - r); const cy = Math.min(Math.max(y + 0.5, r), size - r);
    const inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
    if (!inside) return [0, 0, 0, 0];
    // Two "MRZ lines" near the bottom plus a small photo block top-left.
    const u = x / size; const v = y / size;
    const line1 = v > 0.62 && v < 0.70 && u > 0.14 && u < 0.86;
    const line2 = v > 0.76 && v < 0.84 && u > 0.14 && u < 0.86;
    const photo = u > 0.16 && u < 0.40 && v > 0.16 && v < 0.48;
    if (line1 || line2) return [255, 255, 255, 255];
    if (photo) return [191, 219, 254, 255];
    return [29, 78, 216, 255];
  });
}
mkdirSync(join(dist, 'icons'), { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(join(dist, 'icons', `icon${s}.png`), icon(s));

// ---- report ----
function sizeOf(dir) {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    total += e.isDirectory() ? sizeOf(p) : statSync(p).size;
  }
  return total;
}
console.log(`Built dist/ (${(sizeOf(dist) / 1024 / 1024).toFixed(1)} MB). Load it via chrome://extensions → Load unpacked.`);
