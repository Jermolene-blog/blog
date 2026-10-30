# Toy sources

Most toys are a single `index.html` in `static-assets/toys/<name>/`, edited in place: that file is the toy's source, and nothing for it lives here. This folder holds what the others need beyond their published files: source and build scripts for the toys that are built, model-conversion tools, tests, and the working notes and handover documents that came with toys developed elsewhere (mostly as claude.ai artifacts).

Each toy's notes are in its `CLAUDE.md` or `HANDOVER.md`. Read them before making non-trivial changes.

| Toy | Published file is | What's here |
|---|---|---|
| `quizbuzz` | **Built**: `python3 build.py` writes `static-assets/toys/quizbuzz/index.html` | Source (`src/game.html`), question bank, fonts, vendored QR libraries, tests |
| `meadow-games` | **Built**: `python3 tools/build.py --site` writes `index.html` and `models.js` | Source for three apps (only Meadow Games is published), the CC0 animal models, tests |
| `bowling-bear` | Edited in place | Notes; the original table-mode handover (`src/`); the bear model (CC BY 4.0) and `tools/build_toy_model.py`, which writes `bear-model.js`; tests, including the network tests `test/rejoin.mjs` and `test/link.mjs` |
| `bear-beat` | Edited in place | Notes; the bear model and `tools/build_toy_model.py`; tests |
| `animal-island`, `trundle-world` | Edited in place | Notes and checks |
| `fractaliser`, `loujain-yahya`, `rug-addict` | Edited in place | Handover notes |
| `vectorious` | Edited in place | Handover notes, test images and the Python tracing experiments behind it |

A built toy starts with a comment naming the script that builds it. Don't edit it directly: change the source here, rebuild, and commit both.

## Setting up

```
cd toys-src
npm install                      # Playwright, shared by the tests
npx playwright install chromium
```

Some toys have their own `package.json` for extra tools (for example `bowling-bear` uses gltf-transform to slim its model); run `npm install` in that folder when you need them. Python scripts need only Python 3, except Vectorious's experiments (`opencv-python`, `numpy`, `pypotrace`, `cairosvg`). Each test's header says what it serves and on which port.

## What isn't here

The repository is public. Private material, such as the original photographs that the cat sprites are cut from, lives in the gitignored `local/` folder at the root of the repo and is backed up separately. Keep anything personal out of this folder and out of the toys.
