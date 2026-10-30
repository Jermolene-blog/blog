# Animal Island

Single-file three.js toddler game. Read HANDOVER.md before changing anything.

## Ground rules
- Everything lives in `index.html` (HTML + CSS + one inline script). Keep it a single self-contained file; no build step, no bundler.
- three.js r128 is loaded as a UMD global from cdnjs (`THREE`). Do not switch to ES modules or a newer three without a reason: r128 is what the code and tests are written against.
- External resources are restricted to cdnjs/jsDelivr/unpkg scripts and Google Fonts (claude.ai artifact CSP). Anything else (models, audio, images) must be inlined as data: URIs or generated in code.
- The audience is 1–4 year olds: big targets, no failure states, no text a child must read to play, nothing scary, no ads/links in the child's path. Grown-up controls stay small and in the top bar.
- British English in all spoken and displayed text.
- Respect `prefers-reduced-motion` (already gates the spin-on-tap and cloud drift).

## Testing
- `npm install` then `npm test` (headless Chromium with SwiftShader WebGL). `npm run shots` also writes screenshots to `tests/out/`.
- If Playwright's bundled browser is missing, set `CHROMIUM_PATH` to a Chromium/Chrome binary.
- The test loads `index.html#test`, which exposes `window.__island = { animals, trees, camera, THREE }`. Keep that hook working.
- Run the tests after every change to tap handling, hit targets or animal construction. A previous regression (hit target not stored on the animal) broke every tap and was only caught by clicking, not by screenshots.
- Speech synthesis can't be verified headlessly (no voices). Check voices on a real iPad/Mac.
