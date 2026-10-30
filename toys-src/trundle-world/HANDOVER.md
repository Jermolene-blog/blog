# Trundle World handover

**2026-10-23: integrated into jermolene.com.** The game is now `static-assets/toys/trundle-world/index.html`, with the usual toy tags (PWA links, description, `toy-category` games, theme colour `#7cc8ff`), `icon.svg` and rendered icons. Edit that file directly. This folder (`toys-src/trundle-world/`) keeps the rest. `tools/screenshot.py` expects `index.html` and `node_modules` beside it, and Python Playwright isn't installed on this machine, so `tools/check.mjs` is a Node equivalent. With it, every size, night and Fly ran with no errors from `file://` and http.

Trundle World is a toy for young children: a floating low-poly island with roads, a railway, a waterfall, a volcano, dinosaurs, planes, balloons and weather. Everything reacts when tapped. It runs as a single page in a browser on phones, tablets and desktops.

## Status

The toy is feature-complete for its current scope, and it runs on desktop and phone layouts. Most features were checked with headless Chromium using SwiftShader. A few late tweaks were never rendered (listed under "Known issues").

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app: markup, CSS and one inline script (~1,300 lines). |
| `CLAUDE.md` | Short rules for working on it. |
| `tools/screenshot.py` | Headless Playwright screenshots of every size, plus the phone popups. Optionally captures the flying flock too. |
| `package.json` | Only pins `three@0.147.0`, so the screenshot tool can serve three.js offline. |

## What the toy does (feature inventory)

- **Island:** an orthographic, isometric-style camera, with OrbitControls for drag-to-rotate, pinch/scroll zoom and pan. The polar angle is clamped so the view stays above the island.
- **Road:** a closed loop sampled at equal arc lengths. Bridges are raised sections on pillars; pillars that would poke through a lower road are skipped. The kerbs are striped red and white, and there is a dashed centre line.
- **Cars:** car, bus, lorry (`truck` in code) and ice cream van. They follow each other with a gap-keeping rule, slow on uphill sections and puff exhaust. Tapping one makes it hop, spin, speed up and beep; the ice cream van plays a chime.
- **Railway:** a ring round the rim, with ballast, instanced sleepers and two torus rails. A steam loco pulls coaches, and every fifth coach is an open wagon of coloured balls. The loco puffs smoke. Tapping the train blows the whistle and sends a hop rippling down its length.
- **Waterfall cliff:** this sits *on* the railway. The track runs through a tunnel with stone portals, and its middle section is open at the front, so the train passes behind the falling water, which is semi-transparent.
  - In the L and XL towns the waterfall feeds a pool and a river, which winds under the road (with railings where it crosses) to a central duck pond.
  - In the S and M towns the waterfall pours straight into the duck pond.
  - Tapping the falls makes a splash, and the foam bursts.
- **Volcano** (M, L and XL only): erupts when tapped, or every 28–45 s.
  - An eruption brings a rumble, a little screen shake, smoke, and lava blobs that bounce once and then cool to pebbles.
  - The sheep jump when it goes off.
  - If tapped again too soon it just wobbles.
- **Diplodocuses:** they wander between candidate points in open meadow, avoiding roads, rails, water and buildings. Each one grazes (head down) and nudges trees, which wiggle, as it passes. Tapping one gives a happy hoot, a tail wag and a head toss. Each one has a different colour.
- **Aeroplanes** (biplanes): they share one circular flight path, spread out by phase, so they can never collide. Tapping one waggles its wings and drops a parachutist.
  - The parachutist freefalls, the canopy pops open, and they steer to a clear patch of grass.
  - After landing they wave, then vanish. At most six can be out at once.
- **Hot-air balloons:** they share one elliptical path, spread out by phase. Tapping one makes it rise briefly.
- **Clouds:** each tap alternates between rain and snow for 5 s.
  - Rain greys the cloud and the drops splash; when the rain stops, a rainbow appears.
  - Snow settles briefly on the grass and the volcano.
  - Rain and snow use instanced particles.
- **Other tappables:**

  | Thing | What tapping does |
  |---|---|
  | Houses | Doorbell, chimney puffs, wiggle |
  | Windmill | Spins up |
  | Trees | Rustle and wiggle |
  | Mushrooms | Pop |
  | Sheep | Baa and hop; they also wander their pasture |
  | Ducks | Quack and spin; they circle the pond |
- **Fly! button:** every car and every train unit takes off like a flock of birds (boids round a moving leader), swoops round, then lands smoothly in a *new* position: the cars are respaced and the train moves further round the track. See "Flock flight".
- **Day/night:** lighting fades, windows, headlights, lamps and the plane's wingtip lights glow, and a star field appears (a CSS layer behind the canvas).
- **Watch (follow camera):** a chip for every followable thing (train, each car, plane, balloon and dinosaur), with an icon on a white chip ringed in that object's colour.
  - Tapping a chip follows that thing; tapping it again, or the house button, glides back to the full view.
  - When something is being followed, tapping another vehicle switches to it.
- **Add buttons:** car, carriage, aeroplane, balloon, dinosaur. Each size has caps (see below); a capped add just beeps.
- **Size switcher** (top right): S, M, L, XL. XL is hidden below 640px wide. The choice is remembered in `localStorage` (`trundle-world-size`) and the default is **S**. Switching makes the old town shrink and spin away, then the new one springs up.
- **Responsive UI:** on wide screens, `(min-width:900px) and (min-height:560px)`, the bar shows five separate add buttons and the Watch list is docked down the right edge. On narrower screens a single **+** button opens an add popup, and the **eye** button opens the Watch list as a popup. Both popups close when you tap outside or press Escape.

## Architecture

Everything lives in one IIFE inside `index.html`.

### Outer shell (persists across size changes)

- `SIZES`: the per-size configuration table (see below).
- One shared `THREE.WebGLRenderer` on `#c` (transparent, so the CSS sky gradient shows through; PCF soft shadows).
- Audio: `audio()` creates the context lazily on the first gesture. `tone(freqs,dur,type,vol,slide,delay)` and `noise(dur,vol,bandpassFreq,delay)` build every effect in `sfx`.
- Global UI state: `muted`, `night`, the star field, the hint, the night/sound buttons, the popups (`POPS`, `togglePop`, `closePops`), `ICON`/`NAMES` for the Watch chips, and `isWide()`.
- Size switching: `setSize`, `markSize` and the `loop()` RAF driver. The loop handles the outro (the old town's group scales to 0 with a spin over 0.42 s), then disposes it and builds the new town, then plays the intro (`easeOutBack` over 0.9 s). All of this respects `prefers-reduced-motion`.

### `buildTown(SIZE)` → `{world, frame, dispose}`

This builds one complete town and returns `world`, `frame(dt)` and `dispose()`. Each town has its own:

- seeded RNG (`rnd`, `rr`, `pick`), always seed `20261017`;
- `THREE.Scene` (`stage`) holding a `THREE.Group` that the code calls **`scene`**. Everything is added to that group so the town can be scaled as a whole during transitions;
- camera, OrbitControls, lights and material cache (`mat(color, opts)`, with `box()` and `cyl()` helpers);
- event listeners, registered with an `AbortController` signal so `dispose()` removes them;
- button handlers (`bAdd`, `bCarriage`, `bPlane`, `bBalloon`, `bDino`, `bFly`, `bHome`), reassigned on every build. `bAddMenu`, `bFollow`, `bNight`, `bSound` and the size buttons are wired once in the shell.

Build order matters, because placement is first come, first served. In order:

1. Road
2. Pillars
3. Island
4. Placement registry
5. Water textures
6. Cliff/tunnel
7. Railway
8. Pond (and river)
9. Volcano
10. Houses
11. Windmill
12. Trees
13. Rocks and mushrooms
14. Flowers
15. Lamp posts
16. Sheep
17. Ducks
18. Clouds
19. Balloons
20. Planes and jumpers
21. Puffs
22. Cars
23. Train
24. Flock
25. Dinosaurs
26. Taps and input
27. Buttons and Watch
28. Weather
29. Volcano activity
30. `frame`

`frame(dt)` advances everything and renders: traffic, train, flock, dinosaurs, volcano, planes, jumpers, weather, water texture scroll, windmill, clouds, balloons, ducks, sheep, wiggles, puffs, the day/night blend, then the follow/home camera and the shake. `dt` is capped at 0.05 s.

### Coordinates and scale

- Units are arbitrary world units, with y up and the island centred on the origin.
- `K` is the component scale (vehicles, houses, trees, rails, the cliff and so on). It is larger in smaller towns so things read at toddler size.
- `FW = (R+2)/25` is the world factor: the island size relative to L. It scales the camera framing (`CAM = FW*cam`), the sky heights, the placement search extents and the shadow camera.
- In M and S the layout is designed in a camera-aligned frame, `FR(u, y, w)`: `u` runs side to side and `w` runs from the back (the waterfall at `w = -rail`) to the front (towards the camera at +x+z).
- The S/M dinosaur meadow is reserved early (`reserved[]`, `CFG.dinoHome`) so houses and trees don't fill it.

### Size table (`SIZES`)

| | S (default) | M | L | XL |
|---|---|---|---|---|
| Island radius / rail radius | 12.5 / 10.4 | 17 / 14.6 | 23 / 20 | 32 / 28.6 |
| Component scale `K` | 1.3 | 1.15 | 1 | 1 |
| Road | Flat oval | Figure-of-eight, one bridge | Trefoil knot, 3 crossings | (2,5) torus knot, 5 crossings |
| River | No (falls feed the pond) | No | Yes | Yes |
| Volcano | No | Yes | Yes | Yes |
| Start cars / max | 3 / 5 | 4 / 8 | 6 / 12 | 10 / 20 |
| Start coaches / max | 2 / 18 | 3 / 28 | 3 / 40 | 5 / 60 |
| Max planes / balloons / dinosaurs | 2 / 3 / 2 | 3 / 4 / 3 | 4 / 5 / 4 | 6 / 6 / 6 |

Other per-size keys:

- **Counts:** `trees`, `houses`, `sheep`, `ducks`, `clouds`, `flowers`, `rocks`, `mush`, `meadows`.
- **Scales:** `dino` (dinosaur scale), `cliffH` (cliff height factor; the tunnel height itself is fixed), `cam` (extra zoom-out), `houseK` and `houseGap`.
- **Sky:** `cloudY`, `plane: [radius, y]`, `balloon: [rx, rz, y]`, `flock: [radius, y]`, `trainSpeed`.

Road shapes are in the `ROADS` table:

- `knot` is the original trefoil: `S=5.2`, height `0.18+1.7(1-sin3t)`.
- `torus5` uses `r = 17.5 + 5.5cos5t`, `φ = 2t`, `y = 0.18 + 1.5(1-sin5t)`. This was checked numerically: about 2.9 units of vertical clearance wherever strands pass within 2.4 units, and a minimum bend radius of about 6.5.
- `eight` and `oval` are built in the `FR` frame.

Clearances for M and S were checked numerically when they were designed (road against rail, and road against pond).

### Key subsystems

- **Road sampling:** `P`, `T` and `LF` (position, tangent and horizontal left vector) at `M = 1600` equal-arc samples. `sampleAt(s)` and `roadPose(s, pos, quat)` place anything at arc length `s`. `strip(a, b, top, bottom, colourFn)` extrudes road bands; a colour function that returns `null` skips segments, which is how the dashes and the railings work. `trackDist` and `trackDistLow` give the distance to the road centreline (the "Low" version ignores raised sections).
- **Placement:** `free(x, z, r, gap)` rejects anything off the island, overlapping `placed[]` or `reserved[]`, too near the road (allowing for `RX`, the extra road width at `K > 1`), the river or the rail. `findSpot()` does random rejection sampling and records the result.
- **Cliff/tunnel:** a group of columns, each with a back wall, a roof over the tunnel and front pillars on the outer columns only, giving the open gallery in the middle. It has dark lining planes, stone portals at x = ±3.05, a stream channel on top and a waterfall plane at z = 2.05. Local +z faces the island centre. The group is scaled by `K`; `cliffH` lowers the columns in small towns. The tunnel width allows for the rail's curvature sagitta over the tunnel length.
  - L/XL search angles for the most clearance from the road, biased towards the back of the default view.
  - M/S place the cliff at the back of the `FR` frame.
- **Train:** `poseRail(s)` places at arc length `s` on the circle. Each unit sits at `train.headS - unit.off`.
- **Flock flight** (`launchFlock` / `updateFlock`): each flyer has a `ghostAt(dtAhead, pos, quat)` (its road or rail pose) and a `speedNow()`. There are three phases:
  1. `wait`: a staggered take-off.
  2. `air`: boids, meaning a seek towards a leader point on a Lissajous-ish loop, plus separation, alignment and cohesion, with a floor. Banking comes from lateral acceleration.
  3. `land`: a cubic Hermite from the current state to the predicted ghost pose `R` seconds ahead. The last 30% blends to the live ghost pose and the orientation slerps to the road orientation.

  Once every flyer has lifted off, the cars are respaced evenly and `train.headS` jumps 30–70% of a lap, which gives each one its "new position".
- **Dinosaurs:** candidate grid points (`dCands`, filtered by `dOk`) and straight-segment validity (`dSegOk`). `pickTarget` avoids targets near other dinosaurs. The neck and tail are chains of spheres positioned on quadratic Béziers each frame, and the legs swing on hip pivots.
- **Planes and balloons:** a shared phase angle (`planeA`, `balloonA`) plus a per-object `off` chosen by `gapPhase()`, the midpoint of the largest gap. Each object also gets an altitude offset `dy`. New ones pop in via `grow` with `pop()` (ease-out-back).
- **Watch:** `followables()` returns the train loco, cars, planes, balloons and dinosaurs. Every followable has `root`, `kind` (a key into `ICON`/`NAMES`) and `color`. `refreshFollow()` rebuilds the chips (call it after adding anything) and `setFollow(o | null)` updates state and chip classes. The camera follows `root.getWorldPosition()` and eases the zoom to 2.
- **Puffs:** a pool of 170 meshes. `puff(worldPos, life, colour, grow, vy)` converts to group-local space.
- **Weather:** two `InstancedMesh` pools (rain 600, snow 800) rebuilt each frame. `groundAt()` includes the volcano's height profile so snow and lava settle on its slopes.
- **Wiggle:** a generic squash animation that preserves non-uniform base scales (the volcano is taller than it is wide).

## Testing

```
npm install
pip install playwright   # Chromium: use an existing one via PLAYWRIGHT_BROWSERS_PATH or `playwright install chromium`
python3 tools/screenshot.py index.html            # shots/S.png M.png L.png XL.png phone_add.png phone_watch.png
python3 tools/screenshot.py index.html --sizes S --fly
```

SwiftShader runs at a few fps and `dt` is capped, so simulated time runs about 4–5× slower than wall-clock time. The waits in the script allow for this. To test a timed event (an eruption, the rainbow, landing), either wait longer or temporarily patch a timer in a copy: for example, the volcano's `next:22` is the seconds until its first eruption. Two WebGL pages in one browser can starve SwiftShader, so test pages one at a time.

## Known issues and rough edges

- **Late tweaks never rendered:**
  - the larger raindrops and snowflakes;
  - the rainbow, which has never been seen in a test render because the timing was too slow under SwiftShader.

  The rainbow logic is simple, but it's worth a look.
- **Small town:** three balloons crowd the sky over the waterfall. Consider `maxBalloons: 2` for S.
- **Medium and small towns:** the waterfall cliff's top sits close to the top edge of the default view. `cam` was raised to compensate.
- **Lava blobs** and the flock ignore the raised roads, so they can pass through bridges.
- **Parachutists** sometimes land near trees (`free()` uses trees' rough radii).
- **A second dinosaur** in S overlaps the scenery a little, because the reserved meadow only fits one comfortably.
- **Size switching** rebuilds the town from scratch, so added cars, carriages, planes and so on are lost. It's a deliberate simplicity, not a bug.
- **Transitions** are shrink-and-grow, not a morph between road layouts.
- **Performance:** XL has about 150 trees as separate meshes and 4096² shadows. It's fine on desktop GPUs and untested on low-end tablets. Instancing the trees would be the first optimisation if needed.

## Ideas that were discussed or would fit

- More vehicle types (a fire engine with a siren, a tractor), a level crossing where the road meets the rail (none exist yet), a station.
- Counting or naming moments for slightly older children, though the toy deliberately has no text inside the scene.
- Persisting added objects per size in `localStorage`.

## Provenance

The toy was built iteratively in Claude chat sessions on 16–23 October 2026. The latest published version is a private Claude artifact titled "Trundle World", and `index.html` is that page with a standard HTML skeleton added.
