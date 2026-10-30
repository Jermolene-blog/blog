# Trundle World

A chunky, colourful 3D toy-island diorama for young children: cars trundle round a knotted road, a steam train circles the rim through a tunnel behind a waterfall, and almost everything reacts when tapped. It is a single self-contained HTML file (`index.html`) using three.js r147 from jsDelivr. There is no build step.

Read `HANDOVER.md` before making non-trivial changes. It explains the architecture, the size system and the reasons behind the current design.

## Rules

- **Keep it one file.** All CSS, JS and assets stay inline in `index.html`. External scripts may only be the two pinned three.js r147 URLs (`build/three.min.js`, `examples/js/controls/OrbitControls.js`), which use the old global `THREE` builds. Don't move to ES modules or a newer three.js without being asked: r147 is the last release with the `examples/js` globals.
- **The audience is toddlers.** Use big targets, bright flat-shaded low-poly shapes and immediate feedback (a sound, a wiggle or a sparkle) on every tap. Avoid reading, fail states and anything scary. Changes should keep things simple rather than adding detail.
- **All four sizes must keep working** (`S`, `M`, `L`, `XL`; `S` is the default). Anything you add has to be checked at every size; see "Size system" in the handover.
- **Town randomness is seeded.** Each town is rebuilt from `seed=20261017`. Adding or removing an `rnd()` call before a placement step reshuffles every later placement. That is acceptable, but say so and re-check the layouts visually.
- **Everything in a town goes in the `scene` group** that `buildTown` creates (it is a `THREE.Group`, not the real scene), so the town can shrink and grow when the size changes. `puff()` and `sparkle()` take world-space positions.
- **Audio** is synthesised with Web Audio (`tone`, `noise`, `sfx.*`). There are no sound files.
- **UK English** in all copy ("aeroplane", "lorry").

## Checking work

`npm install` (it only installs three@0.147.0 for offline tests), then `python3 tools/screenshot.py index.html [--sizes S M] [--fly]`. This writes PNGs to `shots/` and exits non-zero on console or page errors. Look at the screenshots: most regressions here are visual (objects overlapping roads, things off-screen, clipping).
