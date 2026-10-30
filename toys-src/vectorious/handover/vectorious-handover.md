# Handover: Vectorious upgrades (better preprocessing + frieze mode)

## Context

Vectorious (https://jermolene.com/toys/vectorious/) is a single-file, browser-only tool:
image in → threshold to 1-bit → potrace.js → SVG/PDF out. Current controls: threshold
(manual or Otsu), invert, ignore specks (turdsize), corner smoothing (alphamax). It embeds
potrace.js (GPL v2+; page is GPL v3), jsPDF + svg2pdf.js (MIT), pdf.js for .jp2 (Apache-2.0).
Everything runs locally; images are never uploaded. Keep it that way, keep it one file,
and keep any new dependencies licence-compatible with GPL v3, credited in the about text.

The test case was a scan of a gilt-tooled green leather book cover (Gould, *Birds of
Australia*, vol. 6) with repeating border friezes. A plain trace gives ragged edges,
grain specks and broken scroll loops. A prototype in Python (attached: `stack.py`,
`trace.py`, `single.py`) showed that **the tracer is not the bottleneck; preprocessing
is.** The results are attached as `frieze_compare.png`, `frieze_zoom_compare.png`,
`frieze_improved.svg` and `anthemion_tile.svg`.

## Measured results on the test scan (1736×2576)

- Plain potrace (luminance, Otsu, turdsize 2, alphamax 1): 197 paths for 7 repeats, mostly
  grain specks, with ragged edges.
- Stacked pipeline: 65 clean paths for 7 repeats, symmetric and identical repeats, with
  roughly the same segment count.
- Period found: coarse 136 px by autocorrelation, refined to 136.4 px (545.75 at 4×).
- 41 repeats collected from all four sides of the border (top 7, bottom 6, left 14,
  right 14), with normalised cross-correlation (NCC) 0.78–0.82 each.
- Mirror axis found automatically, correlation 0.926 with its reflection.

## Phase 1: general preprocessing (helps every image)

Add these as controls, in pipeline order:

1. **Channel picker**: Luminance (current) / Lab b* (yellowness) / Saturation / Lab a*.
   b* is the right choice for gold on dark leather: the leather grain highlights are bright
   but not yellow, so most of the speckle never reaches the threshold. Implement
   sRGB → linear → XYZ (D65) → Lab directly; no library is needed.
2. **Upscale** ×1 / ×2 / ×3 / ×4 (bicubic) *before* thresholding, then scale the traced
   path coordinates back down by the same factor so the output keeps the original size.
   Potrace gets smoother edges to work from.
3. **Denoise**: a Gaussian sigma slider (0–3 px at the working scale) and an optional
   median filter (3×3 / 5×5).
4. **Adaptive threshold option**: Sauvola (window size, k) alongside global/Otsu, for
   uneven wear and lighting. Use integral images so it runs in O(n).
5. **Threshold offset** relative to Otsu. On the test image, Otsu + 15 (out of 255) kept
   the palmette petals separate; plain Otsu fused some of them.

Parameters that worked on the test image (at 4× working scale): Gaussian σ 0.8,
Otsu + 15, turdsize 40, alphamax 1.1, opttolerance 0.4.

## Phase 2: "Frieze mode" (the big win)

The user drags a box around **one repeat** of a band. Then:

1. **Template**: the boxed region, using the selected channel, plus about 20 px of
   vertical slack on each side.
2. **Find the band and its repeats.** Run NCC template matching along the strip that
   contains the box. For a whole border, also search the other three sides with the
   template rotated by 90°, 180° and 270° (and mirrored). Keep peaks with NCC above 0.35
   that are at least 0.8 × the box width apart.
3. **Period**: the median spacing between neighbouring peaks, refined to subpixel precision
   (see the next step). The repeat count, mean NCC and the period should all be shown in
   the UI.
4. **Subpixel alignment**: for each hit, upscale a small patch and the template by 4× and
   match again to get quarter-pixel offsets.
5. **Stack**: take the per-pixel **median** of all aligned repeats at 4×. Then iterate once:
   downscale the stack, use it as the new template and recollect the repeats. This sharpens
   the result noticeably.
6. **Mirror-symmetrise** (a toggle, on by default). Search the column axis c that maximises
   the correlation between the tile and its reflection about c, with periodic wrap. Show the
   correlation score, and only auto-enable symmetry when it is above about 0.85. Then average
   the tile with its mirror image.
7. **Stretch to exactly one period** (for example 544 → 546 px at 4×) so that copies placed
   side by side line up without a gap.
8. **Trace**: tile the clean tile 3 times, threshold, trace with potrace, keep only the
   curves that touch the middle period, and clip them to that period. Shapes that cross the
   tile edges then continue correctly into the neighbouring tiles.

**Outputs**
- a single-repeat SVG: viewBox equal to one period, a clipPath on the period rectangle,
  transparent background. See `anthemion_tile.svg` for the reference result;
- a strip of N repeats (N chosen by the user), built either with `<use>` or by tracing N
  tiles at once;
- an `<pattern>`-based SVG of the same width as the period.
- Show a 3-repeat preview so the user can check the joins.

**Caveat**: bands with a different period (the leaf-and-ring band, the zigzag) come out
blurred in the stack. That is expected; each band needs its own box. Don't try to stack
the whole border height as one tile.

## Phase 3 (optional): primitive fitting

Straight rules, zigzags and dot rows are better fitted than traced: least-squares lines,
polylines with equal pitch, and circles. A simple version: for horizontal rules inside a
frieze tile, detect rows where the binary image is more than 95% foreground across the
tile, and replace them with rectangles before tracing.

## Implementation notes (JS, no OpenCV)

- Run the work in a Web Worker on Float32Array images, and post progress messages so the
  UI can show which stage is running.
- NCC template matching: compute it with the FFT (sums from integral images for the mean
  and variance terms). Brute force is acceptable if you first search at ¼ scale, then
  refine locally. On the test scan, a full border search must finish well under a second.
- Median of about 40 frames per pixel: a quickselect per pixel is fine at tile size
  (around 550×540 at 4× ≈ 300k pixels × 41 values).
- Bicubic upscaling: write it directly, or use canvas `drawImage` with
  `imageSmoothingQuality = 'high'` on a copy of the channel stored as a greyscale image.
  Precision matters less than speed here.
- potrace.js is run separately per trace; make sure the upscaled bitmap's coordinates are
  scaled back down when writing the SVG.
- Keep "Original / Quantised / Traced vector" viewers. In frieze mode, add views for
  "Stacked tile" and "Repeat preview".
- Follow the controls/UX conventions already in the page, and add the new controls to
  the about text with credits for any added code.

## Acceptance checks

Use the test scan in this folder (`birdsAustraliav6Goul_0344.jpeg`; the close-up is
`IMG_1474.jpeg`).

- Phase 1 alone (b*, ×4, σ 0.8, Otsu + 15, turdsize 40) visibly removes the grain
  speckle in the main anthemion band compared with the current output.
- Frieze mode on one anthemion repeat finds about 41 repeats round the whole border,
  with a period of 136.4 ± 0.3 px and a symmetry correlation of about 0.93.
- The single-repeat SVG, placed three times side by side, shows no visible seam, and its
  geometry matches `anthemion_tile.svg` closely.
- Regression: the existing behaviour (luminance + global threshold) is unchanged when the
  new options are left at their defaults.

## Attached reference files

- `stack.py`: band extraction, period finding, subpixel alignment, iterative median stack.
- `trace.py`: symmetrisation, period stretch, threshold, potrace, and the baseline trace.
- `single.py`: single seamless repeat (trace 3 tiles, keep and clip the middle one).
- `anthemion_tile.svg`, `frieze_improved.svg`, `frieze_potrace_baseline.svg`, and the
  two comparison PNGs.

The Python uses OpenCV, NumPy, SciPy and potracer (pure-Python port of potrace). Treat it
as a specification of the algorithm, not code to port line by line. The band coordinates
in `stack.py` are hard-coded for the test scan; the JS version should derive everything
from the user's box.
