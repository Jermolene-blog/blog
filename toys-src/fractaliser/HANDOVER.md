# Fractaliser — handover

Single-file WebGL 2 fractal explorer: `fractaliser.html` (~1060 lines, no build step, no dependencies beyond Google Fonts). Built in a claude.ai chat and published as a claude.ai artifact. This note is for continuing work in Claude Code.

**2026-10-23: integrated into jermolene.com.** The toy is now `static-assets/toys/fractaliser/index.html` (the fragment wrapped in the usual toy skeleton with PWA tags, description and `toy-category` trifles), with `icon.svg` and rendered icons. Edit that file directly; `fractaliser.html` is gone. The sandbox constraints below no longer apply, so PNG export and URL hash state are now possible. It works from `file://` (blob worker included).

Families: Mandelbrot, Tricorn, Burning Ship, Cubic Multibrot — each in parameter plane or Julia mode.
Goals: very fast and smooth interaction, deep zoom, and Jeremy's usual exploratorium conventions: Randomise, Reset, and an 8-way variation grid modelled on the Spotty Sphericle toy on jermolene.com.

## Hosting constraints (claude.ai artifact sandbox)

These apply only while it lives as an artifact. Lift them if it moves to jermolene.com or anywhere else.

- The file is a body fragment. It has no `<!doctype>`, `<html>`, `<head>` or `<body>`, because the host wraps it. Add a skeleton to serve it standalone.
- Scripts can load only from cdnjs, jsdelivr, unpkg and similar CDNs. Fonts only from Google Fonts.
- Downloads, `window.print`, `alert`/`confirm` and URL hash state are all blocked. That is why there is no PNG export and no shareable URL. Locations are shared instead as a text string through Copy and Go.
- Web Workers from `blob:` URLs work. The reference-orbit worker uses one.

## Architecture (by section marker in the script)

| Section | What it does |
|---|---|
| data | `FORMULAS` (default views), `PALETTES` (8 looping gradients + interior colour), `PLACES` presets |
| state | Single object `S`. The centre `S.cx` / `S.cy` is **double-double** `[hi, lo]`. `S.r` is the half-height in complex units (a plain double). |
| double-double | `ddAdd`, `ddMulN` and friends; `ddStr` / `strDD` convert to and from decimal via BigInt at 2^120 fixed point |
| reference-orbit worker | `workerMain` is stringified into a Blob worker. It computes the reference orbit in double-double and returns it as a Float32Array (x, y pairs). If the centre escapes early, it scans a 5×5 grid within ±0.5r and keeps the longest orbit. |
| shaders | `iterSrc(formula, direct)` builds the iteration shader, compiled per formula through `#define`. It packs the smooth iteration count μ as float bits into RGBA8, with interior stored as −1. `CS` is the colour pass. |
| references | Up to 5 cached refs. `pickRef` picks the closest compatible ref within 3r. `manageRefs` requests a new one when it is >1.2r off, its capacity is short, or the Julia c changed. `pinWant` (flights) takes priority over `autoWant`. `satisfies()` dedupes requests. |
| render passes | `computeView` (perturbation), `computeDirect` (plain float, used for the companion scope), `colourPass` |
| frame state / main loop | Low-res render while moving; strip-wise hi-res build when idle; composite every dirty frame |
| view operations | Pan, eased zoom about an anchor, inertia, `flyTo` / `stepFlight` |
| randomise | `hunt()` repeatedly zooms toward high-escape exterior points, using plain doubles |
| colour fitting & variations | `fitColours` reads back a 184×116 μ buffer and sets the density from its 4th–96th percentile. The variation grid uses fixed mutation "directions" (`muts`) applied to the current state. |

### Key mechanisms and invariants

**Perturbation with rebasing (Zhuoran).**
- Each pixel iterates a float32 delta `dz` against the reference orbit `Z[m]`.
- It rebases (`dz = z − Zs`, `m = 0`) when `|z − Zs| < |dz|` or when it reaches the end of the reference.
- `Zs` is 0 for parameter-plane formulas and the reference's starting point in Julia mode.
- In Julia mode, the difference between the current c and the reference's c is fed in as `uJdc`. That is why morphing c works without waiting for a new reference.

**The perturbation step `pstep` and the worker's `orbit()` must implement identical formulas.**
- Burning Ship deliberately uses `y' = −2|xy| + cy`. This is the y-flipped variant, so the ship appears upright with the imaginary axis pointing up. Standard ship coordinates map to ours by negating Im.
- Tricorn is `conj(z)² + c`.
- Cubic is `z³ + c`, with smooth-colouring base log 3.

**Bailout.** |z|² > 1e6 in both the shader and the worker. The smooth μ calculation in `smu()` assumes R = 1000.

**Depth limit.** `R_MIN = 2e-26`, set by double-double precision of the centre. Float32 deltas would go deeper, to about 1e-35. Going past this needs arbitrary-precision references (BigInt fixed-point in the worker) and probably scaled deltas.

**Rendering cadence.**
- While moving: `renderLow` at an adaptive `lowScale` (0.15–1), tuned from the rAF dt and capped by a 2.5e9 iteration-cost budget.
- At rest: after 140 ms idle, with no reference pending and no flight, `buildHi` renders `hi` (2× supersampled when it fits in 16M px) in scissored row strips. The strip height adapts to dt.
- Partially built rows are composited over the low-res image.

**Colour is fully decoupled.**
- `tm()` mappings: Linear `μ·0.03`, Root `√μ·0.25`, Log `ln(μ+1)·0.35`, each multiplied by density. JS `gmap` must mirror them.
- Relief shading uses the gradient of the colour coordinate, so it stays consistent at every depth.

**Other details.**
- RGBA8 packing needs `gl.disable(gl.DITHER)`. That is already done; don't remove it.
- `fitColours` and the variation grid share the `thumbIter` / `thumbCol` targets and use `readPixels`. Keep them off the interactive path.

## What was verified

- `node --check` on the script passes.
- The worker's double-double orbits match plain-double iteration (all four formulas) to float32 storage precision.
- CPU float32 simulation of the shader perturbation loop at r = 2e-14 (seahorse spiral coordinates) against exact double-double iteration: escape counts matched at 3 of 4 test pixels and differed by 16 iterations (3240 vs 3224) at the fourth, a chaotic boundary pixel.
- Headless Chromium (SwiftShader) renders the default view and the Seahorse-valley and Eye-of-the-seahorse presets correctly, and reaches the Sharp state. A companion-scope misalignment caused by layout shifts was found and fixed: there is now a 250 ms rect check.

## Not verified

- **No visual check of the deep presets** (10⁻¹⁴, 10⁻²²). SwiftShader was too slow to screenshot them. Check on a real GPU first.
- **Burning Ship perturbation at depth.** `diffabs` with rebasing is believed sound but untested past shallow zoom.
- **The Armada preset coordinates** (−1.755, 0.035, r 0.045) are from memory of the standard ship detail region, mapped to the flipped convention.
- **Elephant valley and Triple-spiral-type presets** are approximate.
- **Mobile.** Touch, pinch, double-tap and the bottom-sheet layout were written but not tested on a device.
- **WebGL context loss** shows a fatal message only; it does not recover.

## Known limitations / ideas

- No series approximation or bilinear approximation. Deep views with large iteration counts are pure brute force. BLA would be the big speed win for deep minibrots.
- No periodicity or interior detection beyond the cardioid and period-2 bulb test (parameter-plane Mandelbrot only, r > 1e-3). Interior-heavy views at high iteration counts are expensive.
- The worker's reference grid search is crude. A Newton-based search for the nucleus of the nearest minibrot would give better references at depth.
- No reprojection of the previous frame while panning. Shifting the last hi texture would make pans look sharper.
- Density auto-fit happens on arrival only. Fixed density means bands drift visually across depth.
- Possible additions: rotation, more families (Phoenix, Newton, Magnet), distance-estimate shading, an export path once outside the artifact sandbox.

## Controls (for reference)

- Drag pans, with glide. Wheel or pinch zooms at the pointer. Double-click or double-tap dives ×4; Shift surfaces.
- J toggles Julia at the pointer. R randomises, 0 resets, F fits bands, V shuffles the variations, H hides the UI, and arrows and +/− also navigate.
- The companion scope:
  - In parameter mode it shows the Julia set at the pointer; click it to enter Julia mode.
  - In Julia mode it shows the parameter plane; drag in it to morph c.

## Testing tips

- Headless: launch Playwright Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- Wrap the fragment in a minimal doctype/head/body when loading it with `set_content`.
- Keep viewports small (≤900×500) or SwiftShader screenshots time out.
- `PLACES` buttons are good click targets for scripted tests. Status text is in `#stateT`, and it reads "Sharp" when refinement is complete.
