# mrz.traineddata

Tesseract LSTM model trained on OCR-B machine-readable zones, from
https://github.com/DoubangoTelecom/tesseractMRZ (`tessdata_fast/mrz.traineddata`, integer model),
BSD-3-Clause, Copyright (c) 2019 DoubangoTelecom. See LICENSE.txt.

Stored gzipped; `scripts/build.mjs` copies it to `dist/vendor/`. The float `tessdata_best` variant
does not run on the LSTM-only wasm core bundled with tesseract.js, so only the fast model is used.
