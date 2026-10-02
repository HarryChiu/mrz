import { getWorker, recognizeMRZ } from '../lib/ocr.js';
import { resolveCountry } from '../lib/countries.js';
import { fillForm } from '../lib/fill.js';

const $ = (id) => document.getElementById(id);
const steps = ['step-paste', 'step-ocr', 'step-confirm', 'step-error'];
let previewURL = null;
let lastTexts = [];
let busy = false;

function show(step) {
  for (const s of steps) $(s).classList.toggle('hidden', s !== step);
}

function setPreview(blob) {
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = URL.createObjectURL(blob);
  $('preview').src = previewURL;
  $('preview2').src = previewURL;
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// ---------- OCR engine warm-up ----------
const engine = $('engine');
getWorker((m) => {
  if (m.status && m.progress !== undefined && !busy) engine.textContent = `${m.status} ${Math.round(m.progress * 100)}%`;
}).then(() => { engine.textContent = 'OCR ready'; engine.classList.add('ready'); })
  .catch((err) => { engine.textContent = 'OCR failed to load'; engine.classList.add('bad'); console.error(err); });

// ---------- image intake ----------
async function handleBlob(blob) {
  if (!blob || !blob.type.startsWith('image/')) { fail('That was not an image. Copy a screenshot and paste again.'); return; }
  if (busy) return;
  busy = true;
  setPreview(blob);
  show('step-ocr');
  $('bar').style.width = '0%';
  try {
    const { result, texts, lineWidthPx } = await recognizeMRZ(blob, {
      onStatus: (status, progress) => {
        $('status').textContent = status;
        if (typeof progress === 'number') $('bar').style.width = `${Math.round(progress * 100)}%`;
      },
    });
    lastTexts = texts;
    if (!result) { fail('No machine-readable zone found. Make sure the two MRZ lines at the bottom of the passport are fully inside the screenshot and readable.'); return; }
    showResult(result, lineWidthPx);
  } catch (err) {
    console.error(err);
    fail(`OCR error: ${err.message || err}`);
  } finally {
    busy = false;
  }
}

function fail(msg) {
  $('error').textContent = msg;
  $('ocrtext').textContent = lastTexts.join('\n-----\n');
  show('step-error');
}

async function readClipboard() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return item.getType(type);
    }
    fail('The clipboard does not contain an image. Take a screenshot to the clipboard first, then try again.');
  } catch (err) {
    fail(`Could not read the clipboard (${err.message}). Press ⌘V / Ctrl+V to paste instead.`);
  }
  return null;
}

document.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) { e.preventDefault(); handleBlob(item.getAsFile()); return; }
  }
});

$('btn-paste').addEventListener('click', async () => { const b = await readClipboard(); if (b) handleBlob(b); });
$('file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) handleBlob(f); e.target.value = ''; });

const dz = $('dropzone');
dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleBlob(f); });

// ---------- result display ----------
function showResult(r, lineWidthPx = 0) {
  $('f-firstName').value = titleCase(r.firstName || '');
  $('f-lastName').value = titleCase(r.lastName || '');
  $('f-passportNumber').value = r.passportNumber || '';
  $('f-dob').value = r.dob || '';
  $('f-sex').value = r.sex || 'X';
  $('f-nationality').value = r.nationality || '';
  $('f-issuingCountry').value = r.issuingCountry || '';
  $('f-expiry').value = r.expiry || '';
  $('raw').textContent = r.raw.join('\n');
  for (const el of document.querySelectorAll('.chk')) {
    const ok = r.checks[el.dataset.chk];
    el.textContent = ok ? '✓' : '✗';
    el.title = ok ? 'Check digit OK' : 'Check digit failed. Verify this value.';
    el.className = `chk ${ok ? 'ok' : 'bad'}`;
  }
  const v = $('validity');
  if (r.valid && r.checks.composite) { v.textContent = 'All MRZ check digits pass. Review and fill.'; v.className = 'validity ok'; }
  else if (r.valid) { v.textContent = 'Mandatory check digits pass (composite check failed). Review the values before filling.'; v.className = 'validity warn'; }
  else { v.textContent = 'Some check digits failed. The OCR may have misread characters. Correct the values marked ✗ before filling.'; v.className = 'validity warn'; }
  if (r.agreement !== undefined && r.agreement < 2) {
    v.textContent += ' No two OCR passes read the second line identically, so double-check every value.';
    v.className = 'validity warn';
  }
  if (lineWidthPx && lineWidthPx < 650) {
    v.textContent += ` Low-resolution screenshot (MRZ ${lineWidthPx}px wide): names are easy to misread, so please check them. Zoom in or capture a larger area for better results.`;
    v.className = 'validity warn';
  }
  updateCountryNames();
  $('fill-status').textContent = '';
  $('fill-status').className = 'status';
  show('step-confirm');
  $('f-firstName').focus();
}

function updateCountryNames() {
  const n = resolveCountry($('f-nationality').value);
  const i = resolveCountry($('f-issuingCountry').value);
  $('nat-name').textContent = n ? n.name : '';
  $('iss-name').textContent = i ? i.name : '';
}
$('f-nationality').addEventListener('input', updateCountryNames);
$('f-issuingCountry').addEventListener('input', updateCountryNames);

// ---------- fill ----------
function payloadFromForm() {
  return {
    dateFormat: $('dateFormat').value,
    fields: {
      firstName: $('f-firstName').value.trim(),
      lastName: $('f-lastName').value.trim(),
      passportNumber: $('f-passportNumber').value.trim(),
      dob: $('f-dob').value,
      sex: $('f-sex').value,
      nationality: resolveCountry($('f-nationality').value.trim()),
      issuingCountry: resolveCountry($('f-issuingCountry').value.trim()),
      expiry: $('f-expiry').value,
    },
  };
}

$('fields').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('fill-status');
  status.className = 'status';
  status.textContent = 'Filling…';
  $('btn-fill').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab.');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillForm,
      args: [payloadFromForm()],
    });
    let count = 0;
    const fieldsFilled = [];
    for (const r of results) {
      if (r && r.result) { count += r.result.count; fieldsFilled.push(...r.result.filled.map((f) => f.field)); }
    }
    if (count === 0) {
      status.className = 'status bad';
      status.textContent = 'No matching fields found on this page. Click into the page first if it is a restricted URL (chrome://, Web Store).';
    } else {
      status.className = 'status ok';
      status.textContent = `Filled ${count} field${count === 1 ? '' : 's'}: ${[...new Set(fieldsFilled)].join(', ')}. Review the page and submit it yourself.`;
    }
  } catch (err) {
    status.className = 'status bad';
    status.textContent = `Could not fill: ${err.message}. The page may block extensions (chrome://, Web Store, PDF viewer).`;
  } finally {
    $('btn-fill').disabled = false;
  }
});

function reset() {
  for (const el of $('fields').querySelectorAll('input')) el.value = '';
  $('raw').textContent = '';
  lastTexts = [];
  if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
  $('preview').removeAttribute('src');
  $('preview2').removeAttribute('src');
  show('step-paste');
  dz.focus();
}
$('btn-reset').addEventListener('click', reset);
$('btn-retry').addEventListener('click', reset);

dz.focus();
