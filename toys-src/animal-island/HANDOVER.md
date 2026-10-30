# Animal Island: handover

**2026-10-23: integrated into jermolene.com.** The game is now `static-assets/toys/animal-island/index.html`, with the usual toy tags (PWA links, description, `toy-category` games, theme colour `#5fbdea`), `icon.svg` and rendered icons, and a recipe in `build-screenshots.js` that presses Start before capturing. Edit that file directly. This folder (`toys-src/animal-island/`) keeps the rest of the bundle. `tests/smoke.mjs` still expects `index.html` in its parent folder, so point `root` at the toy folder before running it; with that change it passed from `file://` and http.

A 3D game for toddlers. Eight animals stand on a small round island. Tapping one makes it jump and spin, and a voice says its name and its noise ("Cow! Moooo"). A big word card shows "Cow / Moo! / C is for cow". A second mode asks "Where's the pig?" and gives a star when the child finds it. It is one of a series of toddler single-page apps, built in claude.ai chat and published there as an artifact. This bundle moves development into Claude Code.

## Files

| Path | What |
|---|---|
| `index.html` | The whole game. Open it directly in a browser, or serve the folder. |
| `CLAUDE.md` | Rules for working on it. |
| `tests/smoke.mjs` | Headless Playwright test: taps every animal and tree, opens the voice panel, enters Find mode, and checks for page errors. Covers desktop and phone widths. |
| `package.json` | `npm test`, `npm run shots`, `npm run serve`. Dev dependencies are three@0.128.0, which serves the CDN script offline in tests, and playwright. |
| `docs/*.png` | Reference screenshots of the current look. |

## Current state (v0.4)

**Scene**
- A round grass island (cylinder) in a flat sea with a pulsing foam ring.
- A pond with a pebble edge.
- A red barn and a short fence.
- Four apple trees and three palm trees.
- Grass tufts and flowers, scattered randomly on each load.
- Six slowly orbiting clouds.
- Sunlight with soft shadows (a 2048 map) and a hemisphere fill.

**Animals**
- Cow, pig, sheep, horse, duck, frog, lion and elephant.
- Each is built procedurally from smooth primitives using these helpers:
  - `ell` places a scaled sphere, giving ellipsoids;
  - `seg` makes a tapered capsule-like limb between two points;
  - `chain` makes multi-segment tails, trunks and necks;
  - `eyes` draws glossy eyes with a catch-light;
  - `fib` gives evenly spread points on a sphere, used for wool and the lion's mane.
- The cow's hide is a canvas texture (`spotTexture`).
- Builders face +z with their feet at y=0. They return `{ g, h, tail?, ears? }`: the body group, the head group (animated), an optional tail (swishes) and optional ears (elephant flap).
- `DATA` holds each animal's name, displayed noise, spoken noise text, speech pitch and rate multipliers, island position, and hit-sphere height and radius.
- Each animal has an invisible sphere (`hit`) that raycasts test against. It is stored on the animal object, and must stay there.

**Behaviour**
- Animals slowly turn to face the camera, with some per-animal wander.
- They breathe and bob their heads.
- The duck swims a circle in the pond.

**Interaction**, all through pointer events on the canvas:
- A drag of more than 12 px spins the camera around the island, with inertia. The mouse wheel zooms, from 0.4× to 1.2× of the auto-fit distance.
- **Tapping an animal**, in Play mode: a jump and 360° spin (skipped under reduced motion), a squash-and-stretch, the word card and speech.
- **Tapping an animal**, in Find mode:
  - The right animal gives a star burst, a fanfare, "You found it!" and a star count; the next target follows 3.6 s later.
  - A wrong animal says "That's the X… Where's the Y?".
  - After 2 misses, or 9 s, the target bounces on a glowing ring as a hint. The speaker button in the prompt repeats the question and also shows the hint.
- **Tapping a tree** (700 ms cooldown):
  - the tree shakes;
  - a rustle sound plays and leaves fall;
  - 2–3 apples or coconuts drop, bounce with a thud and roll, then fade after 8 s;
  - a small bird flies out chirping;
  - an "Apple" or "Coconut" card appears.
- **Tapping the pond**: a ripple ring and a low note.
- **Tapping the grass**: a flower pops up (up to 30 kept) and a random pentatonic note plays.

**Sound**
- Web Audio is used for blips, the fanfare, boing, rustle, chirps and thuds. The AudioContext is created on the Start button, as autoplay rules require.
- Words and animal noises use the Web Speech API (`speechSynthesis`). The noises ("Moooooo") are spoken text, with a per-animal pitch and rate.

**Voice panel** (the gear button):
- Lists the device's English voices, grouped by accent: Scottish and Irish are detected for Fiona and Moira, and the rest come from the language code.
- A "Female voices only" filter, matched by name. The API has no gender field, so `FEMALE` and `MALE` are regexes of known voice names.
- Pitch and speed sliders that multiply each line's own pitch and rate.
- "Try it" and "Reset" buttons.
- Settings persist in `localStorage['animal-island-voice']`.
- The default voice prefers British, female, then names containing premium/enhanced/natural/neural/google.

**UI**
- A start screen (needed for audio unlock) and a top bar with the Play/Find toggle, the star count, the gear and mute buttons.
- The Find prompt pill and the bottom word card.
- Fonts: Grandstander for display, Nunito for body, from Google Fonts with fallbacks.
- One sunny palette with no dark mode, by design.

## Code map (index.html script, top to bottom)

1. Renderer, scene and lights.
2. Geometry helpers: `M` (material cache), `mesh`, `ell`, `seg`, `chain`, `eyes`, `fib`, `spotTexture`.
3. Island: sea, foam, island cylinder, pond and pebbles.
4. Trees: `appleTree` and `palmTree` push `{ g, kind, fruitPts, crown, shake, hit }` onto `trees`. `frondGeo` is the palm leaf. The barn, fence, grass and clouds follow.
5. Animal builders, `DATA`, and creation of `animals`, after which `hitTargets` combines animal and tree hits.
6. Effects: hint `ring`, star `sparks` pool, `growFlower`, `ripple`, `dropFruit`, `dropLeaves`, `releaseBird`.
7. Sound: voice selection, `say(parts, force)`, then `note`, `sweep`, `rustle` and the named sound effects.
8. UI: `showCard`, `state`, `setMode`, `nextFind`, `tapAnimal`, `tapTree`, the voice panel wiring and the Start button.
9. Camera and input: `resize` auto-fits the radius to the aspect ratio, then pointer handling and raycasting in `endPtr`, which prefers animals over trees when both are hit.
10. `tick()`: the camera, then animal idle and reaction animation, the hint ring, tree shake, fruit physics, leaves, birds, sparks, flowers, ripples and clouds.

## Known issues and limitations
- **Speech quality depends on the device.** Noises spoken by speech synthesis sound robotic on some platforms. The best results come from downloaded Enhanced/Premium voices on iPad or Mac (Settings → Accessibility → Spoken Content → Voices).
- **Voice gender is a guess from the name.** Unknown voices show no gender label and are excluded by "Female voices only".
- **Lion's mane.** Built from sphere clusters, it reads as a bit lumpy, like a pine cone. Wool on the sheep has the same limitation.
- **Barn and fence** are still blocky boxes, unlike the smooth animals.
- **No `claude.hot` snapshot,** so a republish while it is open resets the star count. This only matters for the artifact.
- **Large mesh count.** Each animal is dozens of separate meshes, with no merging or instancing. It runs fine on an M-series Mac; it hasn't been profiled on older iPads.
- **Find mode sticks to the one prompt.** It doesn't vary the question ("Which one says moo?") or teach colours or numbers.

## Ideas not yet done (unprioritised)
- Synthesised or recorded animal noises in place of spoken text, inlined as data: URIs or made with Web Audio.
- Find-mode variants: "Who says moo?", "Find the big one", counting ("tap 3 sheep"), colours, first letters.
- Day/night or weather toggle; an animal falls asleep if left alone.
- Idle wandering around the island, avoiding the pond, trees and each other.
- More animals: chicken, dog, cat, giraffe, monkey, penguin and so on.
- Merge static meshes per animal (`BufferGeometryUtils.mergeBufferGeometries`) to cut draw calls.

## Publishing
The live version is a claude.ai artifact titled "Animal Island". The artifact host wraps the file in its own document skeleton and injects a reset that includes `[hidden]{display:none!important}`. That's why the artifact copy has no `<!doctype>`/`<html>`/`<head>`. This `index.html` is the standalone version, with its own skeleton and the same reset, plus the `#test` hook. To republish as an artifact, strip the skeleton back to start at `<title>`. Leaving it in also works, but the host expects content only.
