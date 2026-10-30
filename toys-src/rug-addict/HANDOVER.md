# Rug Addict — handover

**2026-10-23: integrated into jermolene.com** as `static-assets/toys/rug-addict/index.html` (the fragment wrapped in the usual toy skeleton with PWA tags, description and `toy-category` trifles), with `icon.svg` and rendered icons. Edit that file directly; `rug-addict.html` is gone. Tested from `file://` and http, Room view included.

Rug Addict is a single-file HTML toy that generates Persian, Anatolian, Caucasian and Turkmen-style rugs knot by knot. It works from the "grammar" of real rugs (border system, field, medallions, motifs) and renders the result as wool pile, as a graph-paper cartoon, or lying on the floor of a 3D room. It follows Jeremy's usual exploratorium pattern: **Randomise**, **Reset**, **Back**, and **8-way exploration** (eight mutations of the current rug; click one to adopt it and breed again).

The file is `rug-addict.html`, about 85 KB. It has no build step and needs no server. Open it in a browser. It was previously called "Naqsheh". The word *naqsheh* still appears once in the notes, deliberately: it's the Persian term for a rug cartoon.

It is currently published as a claude.ai artifact at https://claude.ai/artifact/7J2F3kPPiiHRCzZ336dhUZ. The artifact page wraps the file in its own `<!doctype><head><body>` skeleton. That's why the file starts with `<title>` and `<style>`, with no html, head or body tags. If you host it elsewhere, either add a skeleton or leave it as is (browsers cope). Also add a `[hidden]{display:none!important}` rule, which the artifact skeleton normally supplies. It's already in the file's CSS.

## External dependencies

- **Google Fonts:** Alegreya (display), Alegreya Sans (body), Cutive Mono (data). All have fallbacks.
- **three.js r128 and OrbitControls:** loaded lazily, only when the Room view is first opened.
  - `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
  - `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`. This is the non-module `examples/js` build that attaches `THREE.OrbitControls`. It no longer exists after r148, so don't bump three without switching to ES modules.
- **Host restriction:** the artifact host only allows scripts from cdnjs, jsdelivr, unpkg and code.jquery.com, and stylesheets only from Google Fonts. Keep that in mind if the page goes back to an artifact.

## Code map (one `<script>`, in this order)

| Section | What it holds |
|---|---|
| `PAL` | Named palettes (Heriz, Tabriz, Kazak, Oushak, Qashqai, Tekke, Isfahan, Lotto, Hamadan, Baluch, Turquoise). Each has `c` (hex) and `n` (names). A loop afterwards pads every palette to **11 colours**, so any colourway index is valid with any palette. |
| `CW` | Colourways (0–7). Each maps *roles* to palette indices: `field, fA, fB, fC` (field ground and three motif colours), `med, m1, m2` (medallion), `spand` (spandrels, and the alternate medallion ground), `border, bA, bB, bC`, `guard, gA, gB`. `line` is always palette index 6 (dark outline). |
| `OPT` | Option labels for every select parameter. |
| `SPECS` | Parameter schema: `{k, g(group), t: 'sel'/'rng'/'bool', l(label), min, max, s(step)}`. The controls, mutation and randomisation are all driven from this. **To add a parameter, add it to SPECS, OPT (if a select) and DEFAULTS.** |
| `GROUPS` | Layout, Field, Medallion, Borders, Colour, Weave. Each group can be locked so Randomise and Explore leave it alone. |
| `DEFAULTS` | Reset target. Presets are applied as `Object.assign({}, DEFAULTS, preset)`. |
| maths | `hash2` (integer hash to [0,1)), `vnoise` (value noise), `seg`/`pl` (distance to segment/polyline), `clamp`, `hex2rgb`. |
| `M` | Field motifs. Signature `(x, y, h)`: x and y in [-1,1] with y down, `h` a per-cell hash for variants. Returns **0** = ground, **1–3** = colour roles fA/fB/fC, **4** = dark outline colour. Motifs: herati, boteh, minakhani, star, gul, eli, ram, palm, rose, rosette (4 variants by `h`), arrow, sprig, pinwheel, animal. |
| `BM` | Main-border motifs. Signature `(x, b, i, Lr)`: x runs along the border in band-width units over [-Lr, Lr], b runs across in [-1,1] with -1 the outer edge, and i is the repeat index. Returns 0–3. `bracket` returns 0–6 and has its own colour mapping in `build`. |
| `GM` | Guard-stripe motifs. Same signature as BM. `barber` and `slant` are special-cased in `build`. |
| `build(p)` | **The core.** Computes the knot grid and returns `{W, H, C: Uint8Array of palette indices, D: depth for outlines, cw, bands, total, mainW, gW}`. See below. |
| `render(cv, rug, p, k, mode)` | Flat renderer: one square per knot. Used for the Cartoon view (graph-paper grid, with the weaver's quarter in full colour) and for the eight exploration thumbnails. |
| `renderPile(rug, p, kp)` | Realistic wool renderer. Returns `{canvas, kp, KW, KH, m, ke, FLk}`. See below. |
| `Room` | 3D room module: `show(host, pile, p, rug)`, `hide()`, `update(...)`. Lazy-loads three.js. Builds the room around the rug's physical size (procedural wood-floor texture; walls as a BackSide box so the near wall disappears when you orbit outside; a window; furniture; a sun with shadows). The rug is a plane with the pile canvas as both `map` and `bumpMap`. Rendering is on demand: it re-renders only when `controls.update()` reports movement or `dirty` is set. |
| state, `mutate`, `commit` | `p` is the live parameter set and `committed` the last committed one. `hist` is the Back stack (80 deep). `mutate(base)` changes unlocked parameters with probability scaled by the Step slider: ranges get a gaussian nudge, selects a random option, bools flip. It guarantees at least one change. |
| `buildControls` / `syncControls` | Generate the parameter panel from SPECS. A slider's `input` event triggers a *draft* render. Its `change` event commits to history and regenerates the variants. |
| `renderMain(draft)` | Dispatches on `view` ('rug', 'cartoon' or 'room'). Draft renders use a low pixels-per-knot value, and a full render follows 260 ms later. `pileKp()` picks pixels per knot under a pixel cap (2.4 M full, 0.7 M draft). Also writes the caption: knots × rows, metres, knots per square inch with a grade label, and knot type. |
| variants | Eight `mutate(p)` results drawn with the flat renderer. The label under each lists what changed. |
| `renderGrammar` | The "Grammar of this rug" parse tree. One branch per layout. Update it when you add layouts. |
| `LEX` / `drawLex` | Motif lexicon at the bottom of the page, with traditional meanings. |
| `PRESETS` | Reference rugs (below). `drawPresets`/`markPreset` build the buttons. |
| wiring | Button handlers, view switching, recipe copy/apply (JSON of `p`; apply validates against SPECS), resize. At startup the app loads `PRESETS[0]`. |

### How `build` works

1. **Border system.** Built as a list of `bands`, from the outside in:
   - line (pearled if `pearls` is on)
   - then, `guards` times: guard, line
   - main
   - then, `guards` times: line, guard
   - line (pearled)
   - an optional inner `tooth` band

   Each band has a width in knots. A pixel's band is chosen by `e = min(x, y, W-1-x, H-1-y)`. The coordinate along the band is folded so each side mirrors about its midpoint. The repeat lengths `Lv`/`Lh` are fitted to whole repeats per side, which gives clean mitred corners.
   - **Slanted guards** (`guard: 'slant'`) deliberately use the *unfolded* coordinate so the slant runs continuously along each side.
   - **Tooth band:** `toothStyle` is 'zigzag' (a sawtooth line) or 'teeth' (reciprocal triangles).
2. **Field.** Field units: `u = (x-cx)/fw`, `v = (y-cy)/fw`, where `fw` is the field half-width in knots. So u runs over [-1,1] and v over [-A, A] with `A = fh/fw`. Most layouts work in folded coordinates `au = |u|, av = |v|`, which gives quarter symmetry, the way a cartoon is drawn. The prayer layout folds left–right only. The pole-medallion animal figure uses signed u and v so it isn't mirrored. `kn0 = 1/fw` is one knot in field units, used for line thicknesses.
3. **Layouts** (`switch (p.layout)`):
   - **`pole`:** canted corners; then lozenge; anchor; pole; central panel with comb outline, frame bands and `panelFill` contents; then fill.
   - **`medallion` / `stacked`:** medallions come from `medLevel()` (stepped/lobed diamond with rings and latch hooks), or, for stacked with `medShape: 'octagon'`, cut-corner rectangles with `medFill` 'rings' or 'octagons' (octagon lattice, central cartouche with quartered square, optional `medBlocks`). `sideFill` restricts field motifs to the strips beside the medallions.
   - **`allover`, `prayer`, `garden`, `guls`:** the remaining layouts.
4. **`fill(au, av, scale, dens)`.** The field repeat. Columns are spaced by `T = 2/tiles`, rows by `Tr = T * tileRatio`, with an optional half-drop (`brick`). `density` thins it randomly per cell. A second motif `fillB` is used either at random (`mix`) or on alternate rows (`alternate`).
5. **Outlines.** If `outline` is set, a knot gets the dark line colour when any 4-neighbour has a higher `D`.

### How `renderPile` makes it look like wool

- **Wavy edges.** Each pixel is mapped back to knot coordinates through edge wobble arrays `dl/dr/dt/db`. Village drawing (low `style`) wobbles more.
- **Pile pixels:**
  - fibre spill: the sample position is jittered by noise plus per-pixel hash, so colour bleeds across knot boundaries;
  - the pile leans slightly toward one end;
  - heathered yarn: per-pixel noise plus noise streaked along the warp;
  - two tufts per knot, from sine shading within the knot;
  - abrash bands, precomputed per colour per row in `abr`;
  - low-frequency sheen;
  - wear that reveals warp and weft.
- **Edges and ends.** The sides are overcast cord with diagonal wrap shading. The ends are a flatwoven band. The fringe is drawn afterwards as canvas strokes, knotted in groups.
- **Cost.** About 0.5 s at around 2.4 M pixels. Everything is per pixel in plain JS.

## Parameters (SPECS keys)

- **Layout:** `layout, knots (40–400), aspect, style (village→city)`
- **Field:**
  - `motif, tiles, tileRatio, density, fillB, mix, alternate, sideFill, brick, outline`
- **Medallion:**
  - size and shape: `medSize, medElong, lobes, lobeDepth, rings, hooks, medCount`
  - extras: `pendants, spandrels, medShape, medFill, medBlocks`
  - pole layout: `lozSize, panelFill`
- **Borders:** `mainBorder, guard, guards, borderWidth, guardRatio, pearls, tooth, toothStyle`
- **Colour:** `palette, colourway (0–7), abrash`
- **Weave:**
  - `texture, wear, fringe, seed`
  - `size` (width in metres)
  - `rowRatio` (rows per cm ÷ knots per cm). Used **only** in the caption and the knot-density figure. The drawing still treats knots as square.

## Reference presets

These presets come from Jeremy's own rugs, matched against photos side by side. **The photos are deliberately not in the app. Keep it that way.**

1. **Bells Corner.** Baluch-type pole-medallion rug.
   - **Design:** central red panel with an ivory comb outline, holding hooks, wheels and an animal; poles to stepped lozenges and small anchors; canted corners with camel chevrons; aubergine-black field with rows of octagonal rosettes, about 20% arrows; crossed serrated-leaf main border with an occasional ivory bird; slanted polychrome block guards; pearl stripes; orange sawtooth inner band; Baluch palette, colourway 6.
   - **Measured from the back:** about 200 knots across; about 2 knots/cm across and about 4 rows/cm along (`rowRatio` 2), which is about 52 knots per square inch at about 1.0 × 1.76 m.
   - **Construction:** probably asymmetric knots; ivory wool warps, grey-brown wool wefts, short ivory fringe, dark selvedge cord; probably synthetic dyes, mid-to-late 20th century.
2. **Polstead.** Caucasian-style stacked-medallion rug.
   - **Design:** five cut-corner medallions alternating mustard and aqua, each with an octagon lattice and a central cartouche containing a quartered square, plus check blocks; dark-brown field with alternating pinwheel stars and flowering sprigs beside the medallions; orange reciprocal teeth; aqua main border of multicoloured rosettes alternating with bracket hooks; zigzag guards; Turquoise palette, colourway 7.
   - **Unconfirmed:** the medallion count, overall size and knot count are guesses, because the photo showed only part of the rug.
3. **Heriz medallion, Kazak stacked, Tekke guls, Herati all-over, Anatolian prayer, Garden carpet.** Generic presets.

## Testing approach used so far

- **Syntax:** extract the script and run `node --check`.
- **Builder smoke test:** in Node, stub `document.createElement` / canvas, then run `build()` over every layout × motif × border combination and check that every value in `C` is a valid palette index.
- **Visual:** Playwright (headless Chromium) screenshots of `#rug`.
  - Route `**/fonts.googleapis.com/**` to an empty CSS file.
  - Route `**/three.min.js` and `**/OrbitControls.js` to a local `npm i three@0.128.0` copy, because the sandbox couldn't reach the CDNs.
  - WebGL needed `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
  - To compare with a reference photo, rotate the render 90° (the app draws the long axis vertically; the photos were landscape) and paste them side by side.

## Known limitations / next ideas

- **Mirror symmetry is forced.** Everything is mirrored about the centre, so directional motifs (Polstead's sprigs all point one way on the real rug) end up pointing toward the middle from both ends. Real village rugs also have irregular corners and miscounted repeats. An "improvised corners and drift" option would add authenticity.
- **Abrash only runs across the rug.** It makes crosswise bands only, and can't do Polstead's lengthwise streaks or Bells Corner's patchy fading.
- **Knots are always drawn square.** `rowRatio` should eventually squash the drawn knot grid as well as the caption. That means handling the vertical knot pitch separately in `build`, in the border coordinates (`e` measured physically), in `renderPile` and in the Room plane.
- **Single medallion shape.** `medShape` and `medFill` apply only to the stacked layout. The single `medallion` layout could use them too.
- **Fringe.** Length is fixed (about 5% of length) and the end band is always ivory. A fringe-length setting and an end-band colour would let Bells Corner match exactly: its end band is grey and the fringe is short.
- **Room.** No wool sheen (r128 has no sheen BRDF; a custom shader would fix that), and the furniture is primitive boxes.
- **Speed.** `renderPile` is the slow path. Porting it to a WebGL fragment shader would allow live slider dragging at full quality.
- **Persistence.** None: no saved recipes beyond the copy/paste JSON box. Light state could go in localStorage, wrapped in try/catch.

## Conventions to keep

- **Exploratorium controls:** keep Randomise, Reset, Back, the 8 variants, per-group locks and the Step slider.
- **Spelling and tone:** British spelling in the UI. Copy is plain and specific. Motif meanings are framed as traditional associations, not a code.
- **Theming:** colours are CSS tokens with light and dark themes (`prefers-color-scheme` plus `[data-theme]` overrides). The page needs a 16 px minimum side gutter and must work at phone width.
- **New layouts and motifs:** add the option to `OPT`, handle it in `build` and `renderGrammar`, and run the smoke test.
