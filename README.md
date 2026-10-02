# MRZ Passport Autofill (Chrome extension, Manifest V3)

Paste a screenshot of a passport → the machine-readable zone (MRZ) is OCR'd **locally** with an
OCR-B-specific Tesseract model →
check digits are validated → you confirm → the form on the current tab is filled.

```
OS screenshot → clipboard → extension popup → Tesseract.js (local, in a Web Worker)
             → ICAO 9303 TD3 parse + check digits → confirm → autofill (never submits)
```

* No backend, no API, no analytics, **no network requests** (the manifest CSP only allows `'self'`).
* Nothing is stored. The image and the decoded data live in the popup's memory and vanish when it closes.
* Permissions: `activeTab` + `scripting` (inject the filler into the tab you clicked on, only when you click
  "Fill form") and `clipboardRead` (the "Paste from clipboard" button). ⌘V / Ctrl+V works without any permission.

## Install

```bash
npm install
npm run build        # → dist/
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and pick the `dist/` folder.
`dist/` is self-contained (≈13 MB: Tesseract worker, wasm cores, and a 1.4 MB MRZ/OCR-B language model
from [DoubangoTelecom/tesseractMRZ](https://github.com/DoubangoTelecom/tesseractMRZ), BSD-3-Clause).

## Use

1. Take a screenshot **to the clipboard** that includes both MRZ lines at the bottom of the passport
   (macOS: `⌃⌘⇧4` for a region; `⌘⇧4` alone saves a file instead. Windows: `Win+Shift+S`).
2. Click the extension icon and press **⌘V / Ctrl+V** (or "Paste from clipboard", or choose a file).
3. Review the decoded fields. ✓/✗ shows whether each check digit passed; edit anything that looks wrong.
4. Click **Fill form on this page**. Filled fields flash green. Submit the form yourself.

Extracted: first name, last name, passport number, date of birth, gender, nationality, issuing country, expiry date.

## How fields are matched

Each visible, enabled `<input>`, `<select>`, `<textarea>` and radio (including inside open shadow roots and
iframes) is described by its `autocomplete`, `name`, `id`, `placeholder`, `aria-label`, `aria-labelledby`,
`title`, `data-*`, `formcontrolname`, associated `<label>`, and, as a fallback, the text of its own small
container. That description is matched against keyword patterns (e.g. *given name / first name*,
*surname / family name*, *passport number / document number*, *date of birth / dob*, *sex / gender*,
*nationality / citizenship*, *issuing country*, *expiry / valid until*). Fields that say *place of birth*,
*date of issue*, *username*, *email*, *mother's name* etc. are deliberately skipped.

* **Dates**: `type=date` gets ISO; text inputs use the format hinted by the placeholder/pattern
  (`DD/MM/YYYY`, `MM/DD/YYYY`, …) or the format you pick in the popup; split day/month/year inputs
  and selects are handled.
* **Selects**: matched by option value or text (ISO alpha-3, alpha-2, country name, common aliases,
  demonym; male/female; month names).
* **Radios**: the matching radio in the group is clicked (gender, nationality).
* **Frameworks**: values are set through the native value setter and `input`/`change`/`blur` events are
  dispatched so React, Vue and Angular controlled inputs update their state.
* Forms are **never submitted**.

## Layout

```
src/
  manifest.json
  popup/popup.html|css|js   UI: paste → OCR → confirm → fill
  lib/ocr.js                canvas preprocessing (grayscale, Otsu threshold, scaling) + Tesseract worker
  lib/mrz.js                TD3 parsing, check digits, OCR-error repair (pure functions)
  lib/countries.js          ISO 3166 alpha-3 → alpha-2 / name / demonym, ICAO special codes
  lib/fill.js               self-contained function injected into the page with chrome.scripting
scripts/build.mjs           copies src → dist, vendors tesseract.js/-core + MRZ model, generates icons
third_party/tessdata/       mrz.traineddata.gz (OCR-B model) and its licence
test/mrz.test.js            node --test unit tests for the parser
test/harness.html           dev page: renders an MRZ on a canvas and runs the real OCR pipeline
test/form.html              dev page with many field styles to exercise the filler
dist/                       build output (load this in Chrome)
```

```bash
npm test             # parser unit tests
```

To try the dev pages, serve the project root (e.g. `python3 -m http.server 8765`) and open
`http://localhost:8765/test/harness.html` or `/test/form.html`.

## Notes and limits

* OCR quality depends on the screenshot: both MRZ lines should be sharp and at least ~700 px wide
  (zoom the page or capture a larger area). The popup warns when the MRZ is narrower than that.
  The extension runs several preprocessing passes, picks line 2 by its check digits, and picks line 1
  (which has no check digit) by name-likeness plus majority vote across passes.
* Only TD3 (passport, 2 × 44 characters) is decoded. ID cards (TD1/TD2) are not.
* Custom dropdown widgets that are not real `<select>` elements (e.g. react-select) are not filled.
* The popup closes if it loses focus, so take the screenshot first, then open the popup and paste.
