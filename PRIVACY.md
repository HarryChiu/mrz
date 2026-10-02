# Privacy Policy — MRZ Passport Autofill

_Last updated: 1 October 2026_

MRZ Passport Autofill is a Chrome extension that reads the machine-readable zone (MRZ) of a passport
from a screenshot you paste into it and fills matching fields on the web page you are viewing.

## What the extension does with your data

- **Everything runs on your device.** Optical character recognition (Tesseract.js) and MRZ decoding
  run inside the extension popup in your browser. The screenshot and the decoded data are never
  uploaded, transmitted, or shared with anyone, including the developer.
- **Nothing is stored.** The screenshot and the decoded passport data (name, passport number, date of
  birth, sex, nationality, issuing country, expiry date) are held only in the popup's memory while it is
  open and are discarded when it closes. The extension does not use browser storage, cookies, or any
  database for this data.
- **No network requests.** The extension makes no network requests of any kind. It contains no
  analytics, telemetry, advertising, or remote code. Its content security policy restricts it to its own
  bundled files.
- **Form filling happens only when you ask.** Decoded values are written into the current tab only when
  you click "Fill form on this page", and only into fields that match (name, passport number, date of
  birth, gender, nationality, issuing country, expiry). The extension never submits a form.

## Data collection

The extension does not collect, sell, or transfer any user data. It does not read your browsing history,
monitor your activity, or access any page until you click "Fill form".

## Permissions

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | To fill fields on the tab you are viewing, only when you click "Fill form". |
| `clipboardRead` | To read the pasted screenshot when you click "Paste from clipboard". |

## Changes

If this policy changes, the updated version will be published at the same location and the extension's
store listing will be updated.

## Contact

Questions about this policy: open an issue on the project repository or email the developer listed on
the Chrome Web Store page.
