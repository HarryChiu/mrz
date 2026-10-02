// Local OCR: preprocess the pasted image on a canvas and run Tesseract.js in a Web Worker
// with an MRZ-specific (OCR-B) language model.
// Everything (worker script, wasm core, language data) is loaded from this extension's own files.
import Tesseract from '../vendor/tesseract.esm.min.js';
import { findMRZ, normalizeLine, WHITELIST } from './mrz.js';

const { createWorker } = Tesseract;
const VENDOR = new URL('../vendor', import.meta.url).href;

let workerPromise = null;

export function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      // 'mrz': an LSTM model trained on OCR-B machine-readable zones (see third_party/tessdata).
      const worker = await createWorker('mrz', 1, {
        workerPath: `${VENDOR}/worker.min.js`,
        corePath: VENDOR,
        langPath: VENDOR,
        workerBlobURL: false,
        gzip: true,
        logger: (m) => { if (onProgress) onProgress(m); },
      }, {
        // Init-time settings: no English dictionaries, so chevron runs are not "corrected" into words.
        load_system_dawg: '0',
        load_freq_dawg: '0',
        load_punc_dawg: '0',
        load_number_dawg: '0',
        load_unambig_dawg: '0',
        load_bigram_dawg: '0',
      });
      await worker.setParameters({
        tessedit_char_whitelist: WHITELIST,
        tessedit_pageseg_mode: '6', // single uniform block of text
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return worker;
    })().catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

async function toBitmap(blob) {
  return createImageBitmap(blob);
}

/** Render the image to a canvas with the requested transformation. Returns a canvas. */
export function preprocess(bitmap, { scale, threshold, crop }) {
  const sx = 0;
  const sy = crop ? Math.floor(bitmap.height * (1 - crop)) : 0;
  const sw = bitmap.width;
  const sh = bitmap.height - sy;
  const pad = 24;
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, sw, sh, pad, pad, w, h);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  let t = 255;
  if (threshold) t = otsu(gray);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const v = threshold ? (gray[j] > t ? 255 : 0) : gray[j];
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0; let wB = 0; let max = 0; let thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; thr = i; }
  }
  return thr;
}

/**
 * Run OCR over several preprocessing variants and return the best MRZ parse.
 * Stops early once all mandatory check digits pass.
 */
export async function recognizeMRZ(blob, { onStatus } = {}) {
  const worker = await getWorker((m) => onStatus && onStatus(m.status, m.progress));
  const bitmap = await toBitmap(blob);
  // The MRZ model reads best with the 44-character line around 900-1400px wide; different scales
  // make different mistakes, so several are tried and the parser votes across them.
  const base = Math.min(5, Math.max(0.5, 1000 / bitmap.width));
  const variants = [
    { scale: base, threshold: false },
    { scale: base * 1.4, threshold: true },
    { scale: base * 1.4, threshold: false },
    { scale: base, threshold: true },
    { scale: base * 0.8, threshold: false },
    { scale: base * 1.8, threshold: false },
    { scale: base, threshold: false, crop: 0.45 },
  ];
  const texts = [];
  const confidence = new Map(); // normalised OCR line -> best confidence seen (0-100)
  const confidenceOf = (line) => confidence.get(line) || 0;
  let best = null;
  let lineWidthPx = 0; // width of the widest MRZ-like line, in source pixels
  for (let i = 0; i < variants.length; i++) {
    if (onStatus) onStatus(`recognizing (pass ${i + 1}/${variants.length})`, 0);
    const canvas = preprocess(bitmap, variants[i]);
    const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
    texts.push(data.text);
    for (const b of data.blocks || []) {
      for (const p of b.paragraphs || []) {
        for (const l of p.lines || []) {
          const key = normalizeLine(l.text);
          if (key) confidence.set(key, Math.max(confidence.get(key) || 0, l.confidence || 0));
          if (key.length >= 40 && l.bbox) lineWidthPx = Math.max(lineWidthPx, (l.bbox.x1 - l.bbox.x0) / variants[i].scale);
        }
      }
    }
    best = findMRZ(texts, confidenceOf);
    // Stop once line 2 is fully verified, read identically by at least two passes, and at
    // least four passes have voted on the names.
    if (i >= 3 && best && best.valid && best.checks.composite && best.agreement >= 2 && best.firstName && best.lastName) break;
  }
  bitmap.close && bitmap.close();
  return { result: best, texts, lineWidthPx: Math.round(lineWidthPx) };
}
