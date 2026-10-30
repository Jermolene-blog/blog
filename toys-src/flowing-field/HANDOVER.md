# Flowing Field — handover

Interactive, animated ink-drawing toy. A flow field is drawn as thousands of fine tapered "feathering" strokes that converge into dark creased spines (reference look: fine pen strokes sweeping into ridges). The plane can also be split into zentangle-style sections filled with hand-drawn line patterns. Dragging rakes the strokes into line (and smears pattern lines); marks relax back over time. Psychedelic palettes and colour cycling. Previously called "Sumi Field" (the name came from the owner's reference picture).

Published at https://jermolene.com/toys/flowing-field/. Developed as a claude.ai artifact (https://claude.ai/artifact/1TAJyVGjZRus5zRYgNp7tb, versions 1–9) and then in its own repository (versions 4–9), whose history was merged into the jermolene.com repository on 2026-10-30.

## Files

| Path | What |
|---|---|
| `static-assets/toys/flowing-field/index.html` | The whole app. HTML, CSS, JS and GLSL in one file. It was `flowing-field.html` at the top of the toy's own repository. |
| `toys-src/flowing-field/tools/render.mjs` | Headless Playwright render check (software GL via SwiftShader), using the Playwright installed in `toys-src`. It replaced the original `render.py`, as Python Playwright isn't installed. |
| `CLAUDE.md` | Short working rules for Claude Code. |

The file works served or opened directly from disk. It was written for the claude.ai artifact sandbox, where the host adds the document skeleton; on jermolene.com it starts with a doctype, `<html>` and `<head>` carrying the site's toy tags (description, tagline, category, web app manifest, `../pwa.js`), but deliberately has no `</head>` or `<body>` tags, which are optional: adding them beside the `<canvas>` line would make reverting v9 conflict. localStorage keys: `sumi-field-v3` (params), `…-purr` (sound on/off), `…-dbg` (debug panel open). The keys kept their old names so saved settings survived the rename.

## Architecture (per frame)

1. **Groom pass** (`FS_GROOM`, ping-pong RGBA16F at 1/4 css res): persistent "pen marks" direction field. Pointer segments (up to 16/frame) are splatted as capsules; field decays by `exp(-dt/memory)`; reprojected on pan/zoom (`uK`, `uB`).
2. **Field pass** (`FS_FIELD`, 1/1.5 css res), two sub-passes:
   - `uPass==0`: scalar ridged-noise F(p) (simplex, up to 4 octaves, `crease` folds each octave → spines; optional domain warp), packed 16-bit into RGBA8 `fsTex`.
   - `uPass==1`: central differences of that scalar → gradient → rotated by `curl` → blended toward groom direction. Inside tangled sections the direction is written as zero (strokes stop at the string). Output RGBA16F: xy direction (×.5+.5), z field value (colour key), w groom magnitude.
3. **Trace** (fast path, `FS_TRACE`): one fragment pass per step; each texel is one stroke; midpoint integration with step `STEP=3.5` px; stops when direction reverses (the crease) or hits zero (tangled section). Results stacked in an RGBA32F texture (`Wt`=4096 wide, R rows per band, S+1 bands).
4. **Paper + tangle** (`FS_PAPER`, full res): paper tone + grain; if `tAmt>0`, per-pixel wobbly Voronoi (`TANGLE` GLSL: jittered-grid sites, 3×3 nearest + 3×3 border search) and per-section line patterns drawn analytically as anti-aliased isolines of a scalar S with known |∇S| (`pat()`, 9 patterns: stripes, auras, rings, spiral, sunburst, waves, zigzag, bubbles, grid/checker), optional alternate-band black fills, the string outline, pen-gap before the string. Groom vector smears the pattern sample position.
5. **Strokes** (`VS_FAST`/`VS_SLOW` + `FS_STROKE`): instanced triangle strips, one instance per stroke, vertices read from the trace texture. Seeds are a shuffled jittered grid at `spacing` px; instances are sorted by length factor and drawn in 6 buckets so short strokes get fewer vertices. Light paper → multiply blend; dark paper (<.5) → additive glow.
6. **Explore** (3×3): tiles render into an offscreen atlas at ≤1× density, `tpf` tiles per frame (adaptive 1–9), as true miniatures (lengths/weights scaled by k = tile/full); atlas copied to screen each frame.

**Fallback path** (`FAST=false`, no `EXT_color_buffer_float`, or URL hash `#slow`): RGBA8 groom/field with ±1 encoding (`ENC=1`); strokes traced per vertex in `VS_SLOW`. Keep both paths working.

**Adaptive resolution**: `scale` drops ×0.85 when 30-frame mean > 21 ms, rises ×1.08 after 10 good windows, never back above 97 % of the last scale that failed (`ceil`). Canvas size changes only via `needResize`, applied at the *start* of `frame()` (resizing a canvas clears it; doing it after drawing caused black flashes).

**Test hooks**: `window.__sumi` = `{fast, halt(), snap(), frames()}` used by `tools/render.py`. Harmless; remove if you want.

## Controls / parameters (`SPEC` array)

Groups: Pen (nib width, pen pressure, mark persistence (120 = ∞), nib sound volume) · Field (frequency, detail layers/strength, crease sharpness, curl, warp, drift) · Tangle (patterned sections, section size, pattern variety, line spacing/weight, freehand wobble, black fills, string weight, line drift) · Feathering (stroke spacing/length, line weight, taper, ink load, dry-brush breaks, break length, ink travel) · Colour (palette Ink/Spectrum/Acid/Duotone, colour by Direction/Field/Stroke, hue, hue range, saturation, cycling) · Paper (tone, grain).
`keep:1` params (Pen group, stroke spacing) are untouched by Randomise and Explore mutation. Keys: R randomise, E explore, Space pause, H hide UI, D debug. Gestures: 1-finger drag = rake; 2-finger/right/Shift drag = pan; pinch/wheel = zoom.

## Version history and how to revert

Each published version is one commit; the commits were tagged `v4`…`v9` in the toy's own repository, and are these in the jermolene.com repository: v4 `9cea299`, v5 `756c9ba`, v6 `295b07c`, v7 `90874f1`, v8 `678f04f`, v9 `1428a63`. In those commits the file is `flowing-field.html` at the top level; git follows it to its new path when reverting. Versions 1–3 (suminagashi marbling prototype; first flow-field version; first stroking version) are not in the repository.

| Tag | Change | Notes for reverting |
|---|---|---|
| v4 | Explore: offscreen atlas, round-robin tiles, true miniatures | Baseline of the history. |
| v5 | Perf: split field into scalar + gradient passes; RGBA16F field; length buckets; 3.5 px step; groom-aware pass count; adaptive render scale | Large; touches draw(), seeds(), FS_FIELD, VS_FAST. The adaptive scale introduced the black-flash bug fixed in v7. `git revert` conflicts with v6–v8; easier to re-apply later work onto `v4` by hand. |
| v6 | Debug panel (D) | Adds `ST` counters in draw()/frame(). `git revert` conflicts (v7 edited the panel text); resolve by deleting the debug block. |
| v7 | Black-flash fix: deferred resize, scale hysteresis, `webglcontextlost` → reload; debug shows rescales/lost | Reverts cleanly (brings the flashes back). |
| v8 | Rename to Flowing Field; zentangle Tangle sections | Touches FS_FIELD (zero dir in sections), FS_TRACE/VS_* (stop at zero dir), FS_PAPER (tangle art), new `TANGLE`/`INK` GLSL strings, `setTangle()`, `st.M` line-drift phase, Tangle SPEC group, randomP. |
| v9 | Inking terminology; nib-scratch sound replaces purr | Labels/text only, plus `initAudio`/`updatePurr` bodies. Internal names (`purrOn`, `hand`, `memory`, `groom`) intentionally unchanged. |

Revert behaviour was checked, and checked again after the move into jermolene.com: v9 and v7 revert cleanly against the head; v8, v6 and v5 conflict. Typical operations:

```sh
git diff 90874f1 678f04f -- flowing-field.html   # see exactly what a version changed (v7 to v8)
git revert --no-edit 1428a63                     # v9: back to purr + old wording (clean)
git revert --no-edit 90874f1                     # v7: undo the flash fix (clean)
git revert 678f04f                               # v8: drop tangles: CONFLICTS with v9's label edits inside the
                                                 #   Tangle group; resolve by deleting the Tangle group and
                                                 #   keeping v9's other labels
git show 90874f1:flowing-field.html > static-assets/toys/flowing-field/index.html
                                                 # or restore a whole earlier version (v7), then put back
                                                 #   the site's tags at the top of the file
```

To keep tangles but switch them off by default, rather than reverting v8: set `tAmt` default to 0 in SPEC (Tangle amount 0 is exactly the pre-v8 rendering, apart from the paper shader's per-pixel cost, which is skipped when `uTAmt==0`).

## Known issues / open threads

- Only tested in headless SwiftShader; real iPad numbers unknown. The owner reported explore slowness (addressed in v4/v5) and black flashes (v7 fix unconfirmed on device; debug panel shows `rescales` and `lost` counters to confirm).
- Tangle art is computed per pixel every frame (Voronoi + ~4 simplex calls). If too slow on iPad: render the pattern layer to a texture and only refresh it when drift/line-drift/marks change.
- Pattern strokes are isolines, so they are evenly spaced and crisp; feathering strokes are seeded randomly, so they are not. Evenly spaced streamlines (Jobard–Lefer) would be a different, CPU-side project.
- Nib sound not listened to; tune `initAudio` (band-pass 1.8–5 kHz with speed, grain at ~900 Hz).
- The owner may rename the toy again ("I'll think of a better name" was said of Sumi Field; Flowing Field is the owner's choice).
- Untested on a real iPad as an installed web app: `pwa.js` adds a small "back to the toys" button in the bottom-left corner when the toy is opened from the installed toys app, which may sit near the bottom toolbar on a phone.
