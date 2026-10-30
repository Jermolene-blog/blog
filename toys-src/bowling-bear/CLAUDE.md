# Bowling Bear — handover

A single-page, single-file three.js bowling game. Players sit round one device lying flat on a table: up to 4 at the corners of an iPad, or 2 at either end of a phone. Instead of the players passing the device round, the lane swings to point at whoever is bowling. The theme is bears, with an animated bear mascot (a CC-BY model) that runs, jumps and reacts.

Published as a claude.ai artifact: https://claude.ai/artifact/HdGAF283eXLtxrYgBgNTue (it was called "Bruin Bowl" before being renamed).

## Requirements as given by Jeremy

- Bowling game single-page app for up to 4 people at the corners of an iPad, or 2 people at either end of a phone.
- The lane swings round to the current player's corner, so nobody has to turn the device.
- As in the Marble Flick game, the opening screen lets each seat be set to human, computer or blank.
- Bear themed, using the attached model as a mascot that runs and jumps.
- Added later: an optional camera that follows the ball down to the pins and then pulls back to the overhead view.
- Added later: a "Follow ball" switch on both the pause menu and the opening screen. It defaults to **No**.
- Renamed to "Bowling Bear".

## Files

```
src/bowling-bear.src.html   the source: HTML, CSS and an ES-module script; contains the placeholder __BEAR_B64__
assets/bear.glb             the slimmed bear (~0.5 MB): 12 animations, meshopt, quantised, 512px webp textures
assets/bear-original/       the original Sketchfab glTF (13 MB, 80 animations) and license.txt
tools/slim.mjs              glTF-Transform pipeline: original glTF -> assets/bear.glb (KEEP = the animation whitelist)
tools/build.py              puts bear.glb into the source as base64 -> dist/bowling-bear.html
dist/bowling-bear.html      the build output: the one deliverable (~750 KB), published as the artifact
test/                       Playwright harness (headless Chromium, SwiftShader WebGL)
```

The workflow is: edit `src/`, run `python3 tools/build.py`, then test. Never hand-edit `dist/`.

To change which bear animations are kept, edit `KEEP` in `tools/slim.mjs` and run `npm run slim`, then rebuild. Kept: Run, Sprint, Trot, Walk, CanonBall, Stand_Idle_01, Stand_Breathing_01, StandHind_Idle_01, Trans_Stand_to_StandHind, Attack_StandAngry_01_High, Sitting_Idle_02, Hit_Sitting_F01. The full list of 80 animations is in the original glTF. Notes on the pipeline:
- Disposing an animation does not free its accessors. slim.mjs disposes the samplers' input and output accessors explicitly; without that the GLB stays at 3.4 MB.
- The original uses KHR_materials_pbrSpecularGlossiness, which three r160 no longer supports. `metalRough()` converts it; without it the bear renders white.

## Runtime dependencies (CDN, pinned, via importmap)

- three@0.160.0 (GLTFLoader, meshopt_decoder from `three/addons/`)
- cannon-es@0.20.0 (physics; `Cylinder` is Y-aligned in this version)
- Google Fonts: Bowlby One SC (display), Barlow Condensed (UI)

Artifact rules: scripts may only load from cdnjs, jsdelivr, unpkg and similar CDNs, and fonts only from Google Fonts. Everything else has to be inline, which is why the GLB is embedded as base64.

## Architecture (all in the one module script, in section order)

**Coordinates.** Everything on the lane lives in the `lane` group, in *lane-local* coordinates. In those coordinates x is lateral, y is up, the foul line is at z=0 and the pins are towards −z (head pin at `HEAD_Z = -4.6`). `lane` is a child of `pivot`, offset so that the middle of the lane sits at the pivot. `pivot.rotation.y` is the swing. Physics also runs in lane-local coordinates, so the swing is purely visual and never disturbs the simulation. The bear lives in world coordinates; use `laneToWorld()` to convert.

The lane is shortened (4.6 m foul line to head pin), while pins, ball and lane width are real size. Key constants are at the top: `LANE_HW, GUT_W, HEAD_Z, DECK_END, BACK_Z, BALL_R, PIN_COM, HOOK, R_VIEW, R_VIEW_ENDS`.

**Camera and seats.**
- The overhead camera points straight down with `up = (0,0,-1)`, so screen-up is world −z.
- `layout()` sets the camera height so that the distance from the screen centre to a seat equals `R_VIEW` world metres. A seat is a screen corner in corners mode, or the middle of a short edge in ends mode.
- `seatGeom(i)` returns the seat's screen point, the inward unit vector, `rot` (the CSS rotation that makes text face that seat) and `theta` (the lane angle for that seat).
- Seat order in corners mode is BL, TL, TR, BR (play goes clockwise). In ends mode it is near, then far.

**Chase camera** (`cam`, `chaseTargets`, `startChase`, `updateCamera`):
- Only runs when `prefs.follow` is on.
- Blends position and quaternion (slerp) and fov between the stored overhead pose and a pose behind the ball. The chase pose is clamped to stop at `HEAD_Z + 0.9` while the pins fall.
- The chase view is rolled by the seat's `rot`, so the horizon is level for the bowler.
- Gotcha: use a *camera* as the lookAt helper. `Object3D.lookAt` aims +z, not −z.
- Fog near and far are set from the camera height in `layout()`.

**Physics** (cannon-es):
- Static boxes make up the lane bed, approach, gutters (a flat floor `GUT_DROP` below the lane), capping, kickbacks, pit and back cushion.
- Each pin is a compound of two cylinders, with the centre of mass `PIN_COM` above the base. The pin mesh is a lathe with vertex-coloured neck stripes plus little bear ears, nose and eyes.
- A pin counts as down if it tilts more than ~37°, drops, ends up in the gutter or goes past the deck (`pinIsDown`).
- Hook is a lateral force applied in `preStep`, ramping with progress². The ball's upward velocity is capped at 0.6 m/s so it doesn't hop over the pins.
- Fixed step 1/150, up to 8 substeps per frame. `world.allowSleep` is on, and racked pins are put to sleep.

**Game flow:**
- Async functions driven by a game clock. `wait(s)` and `until(fn, max)` resolve from `tickWaiters()` in the render loop, so pausing freezes the flow.
- `session` and `guard(id)` abort stale flows on restart. Old promises are simply dropped.
- `run` → `playFrame` (full ten-pin rules, including last-frame bonus balls; the game length is 3, 5 or 10 frames, and the last frame acts as the 10th) → `bowlOne` → `react` → `sweep`.
- Scoring is a pure function, `scoreFrames(rolls, N)`.

**Input:**
- Pointer events on the canvas, accepted only while a human's `aim` promise is pending.
- Drag near the ball to move it around the approach, then flick. Release velocity comes from the last 90 ms of samples, using `ev.timeStamp` and coalesced events.
- Aim follows the *chord* of the last 260 ms of the stroke; spin is the difference between the late tangent and the early chord. So a curved flick hooks rather than just veering off.
- Crossing the foul line releases the ball automatically.

**AI** (`aiPlan`, `aiThrow`):
- First ball aims at the pocket. Later balls aim at the front-weighted centroid of the standing pins.
- Adds Gaussian aim noise, with occasional big misses.
- The throw is animated as a slide, a pull back and a flick.

**Bear:**
- Loaded from base64 with GLTFLoader and MeshoptDecoder.
- Forward axis is worked out from the head and pelvis bones; scaled to 0.95 m long.
- Root-motion tracks (`RigRoot*.position`) are stripped. Their length is first used to compute each gait's natural speed, so the playback rate of Walk, Trot, Run or Sprint matches how fast the bear is actually moving.
- `bearGo(targetFn, {speed, idle, face})` steers towards a target that moves with the lane.
- `bearReact(name, {ts, hop})` plays a one-shot animation and resolves when it finishes. CanonBall gets a procedural hop arc.
- The bear climbs up onto the lane platform when it crosses it.
- Reactions: strike → CanonBall then roar (Attack_StandAngry); spare → rear up; gutter → Hit_Sitting; end of game → rear up beside the winner.
- `bearSide(seat)` picks whichever side of the lane has more room near that seat.

**UI (DOM overlays above the canvas):**
- Score cards face their seats. In corners mode they sit along the long edges, rotated 0/180° (landscape) or ±90° (portrait). In ends mode they sit beside the lane and switch to a compact layout when narrow.
- Toast messages face the current seat.
- Pause menu and results are shown as two copies facing the two halves of the table. Tapping a score card opens the full score sheet.
- Everything is clamped to safe-area insets (`clampSafe`).
- The setup screen has a seat badge per seat (tap to cycle Human, Computer, Empty), plus Frames, Table (4 corners or 2 ends) and Follow ball pills.
- Prefs are saved in localStorage under the key `bowlingbear`, wrapped in try/catch.

**Textures:** all procedural canvas — maple boards with paw-print target arrows, the approach, a forest-floor ground, the "BOWLING BEAR" sign over the pit, and per-player ball colours with a paw print.

**Audio:** synthesised with WebAudio: a rolling rumble, pin clacks triggered by collision impact velocity, a roar, a cheer and a "womp". It starts on the first user gesture.

`window.__bb` exposes internals for the tests.

## Testing

```
npm i && npx playwright install chromium    # if the browser isn't already present
python3 tools/build.py
node test/run.js ipad|ipadp|phone           # all-CPU game, screenshots to test/shots/
node test/human.js                          # human vs CPU with synthetic flicks, runs to game over, prints rolls and frames
node test/chase.js ipad|phone               # chase-camera sequence (needs follow on; set prefs in the harness)
node test/end.js ipad|phone                 # menu, sheet and results overlays (uses frames:1)
node test/bear.js                           # close-up of each bear reaction
```

How the harness works:
- `run.js` routes the jsDelivr URLs to local `node_modules` and aborts all other requests, so fonts fall back.
- It seeds prefs through localStorage.
- Launch flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

Things to know:
- SwiftShader is slow. Frames are long, `dt` is capped at 0.05, and game time runs at roughly half real time, so allow minutes for a full game.
- Playwright's `mouse.move` is too slow to register as a flick. `test/flick.js` dispatches synthetic PointerEvents in a busy-wait loop inside the page instead. That's also why the game uses `ev.timeStamp` for its samples.
- Note for `chase.js`: the follow default is now off. Add `follow: true` to its prefs before using it.

## Not yet done

- Not yet tried on a real iPad or iPhone. Things to check there:
  - the feel of the flick: the speed clamp is 1.6–8.5 m/s and `HOOK = 5`
  - frame rate with shadows (PCFSoft, 2048 map)
  - phone cards in portrait ends mode, which are narrow
- No hot-reload snapshot (`window.claude.hot`) is registered, so a republish restarts any game in progress.
- Possible next steps: computer difficulty levels, player name editing, a split/"Turkey" callout, and a bear cheering animation while the pins are still falling.

## Credit (required)

This work is based on "Realistic Animated Bear 3D Model" (https://sketchfab.com/3d-models/realistic-animated-bear-3d-model-bffc3c87d2d148ff8533e1cc8a11c9f1) by WildMesh 3D (https://sketchfab.com/WildMesh_3D), licensed under CC-BY-4.0. The credit is shown on the setup screen; keep it there.

## Merged into jermolene.com (2026-10-25)

This game is now the "Play round this device" mode of `static-assets/toys/bowling-bear/index.html` in the blog repo, which is the file to edit. `src/` and `dist/` here are the artifact version at handover and are no longer kept in step. The page also keeps the earlier LAN game (host/join by QR code, practise alone) with its bowler's-eye view and its own pin simulation.

What changed in the merge:
- **One page, one renderer.** The table game lives in `initTable(renderer, onLeave)`, called the first time the table is opened. It loads cannon-es by dynamic import, builds everything inside that closure and returns `enter()` and `frame(t)`. The alley's `setAnimationLoop` calls `table.frame()` while `inTable` is set. Its DOM ids are prefixed `t-` and its CSS is scoped to `#table`; the lobby's generic rules are scoped to `:is(#lobby,#scanner)`.
- **Colour management.** The alley was ported from three r128 to r160 with `THREE.ColorManagement.enabled = false` (and light intensities ×π, spotlight decay 1) so that it looks as before. `openTable()` turns it on, since the table's colours assume it; `closeTable()` turns it off and sets tone mapping back to none.
- **Input.** The drag-and-flick is gone. The table uses the alley's swipe, measured in lane-local metres: a swipe starts anywhere on the bowler's half of the lane; its start across the lane sets the ball's line; forward speed over the last 90 ms sets the pace (`1.8 + v × 0.5`, clamped 2.4–8.5 m/s); the slant of the whole swipe nudges the aim (±0.14 rad); and curving the end hooks (`spin = (tail − chord) × 2.2`). The finger trail is drawn on the alley's `#trail` canvas.
- **Computer players** slide the ball to their line and bowl, with no pull back.
- **No chase camera** and no Follow ball setting. The menu and setup screen have Leave/Back buttons that return to the lobby. Prefs are stored under `bowling-bear.table`.
- **The bear** is shared code: `makeBear(length, groundY)` parses a fresh copy from `bear-model.js` (`window.BOWLING_BEAR_GLB`; regenerate with `python3 tools/build_toy_model.py <blog>/static-assets/toys/bowling-bear/bear-model.js`). The table uses it at 0.95 m with `bearGround()` for climbing onto the lane. The alley has a 1 m bear beside the lane that runs alongside the ball and reacts to strikes, spares and gutters. To give it time, the end of each roll is held in view for 1.8 s (`hold`) before the camera pulls back.

The test harness in `test/` targets `dist/`; the toy's table internals are on `window.__bbTable`.

## Dancing and keeping the bear in view (2026-10-29)

- `BearDance` (just above `makeBear` in the toy) is Bear Beat's pose overlay, cut down: after the mixer poses the skeleton, procedural rotations for arms, head, spine, pelvis, tail, hind legs, jaw and ears are layered on top (`restore`/`capture` around `mixer.update`, then `ease` and `apply`). Routines are functions of the beat in `BearDance.R`; `forResult(res, knocked)` picks a list of `[routine, beats]` for a strike, spare, gutter, miss, open frame or the end of a game.
- `bear.dance(list, {bpm, face, music})` rears up (the `Trans_Stand_to_StandHind` clip) for hind-leg routines, drops back down by playing it in reverse, and resolves when done. `bear.cancel()` stops a dance at once (the alley does this when the next ball is bowled). A sitting bear grooves along on its own (`groove`).
- `bear.fit(point)` moves a ground point to somewhere the camera can see; it is applied to the steering target and, as a hard limit, to the bear's position every frame. The table uses a projection clamp (`tableFit`); the alley uses `nbFit`, which keeps the bear far enough ahead of the camera for its distance off the lane centre, moving it in to the capping on narrow screens.
- In the alley the jump or pratfall happens at the pins while the camera lingers there; the dance happens back at home once the camera has returned. The table dances where the bear is, with `sfx.groove` under the big ones.

## Rejoining after a phone locks (2026-10-29)

A dropped WebRTC link can't be revived from storage: each connection needs fresh keys and addresses swapped, and the QR codes are the only way to swap them. So while a guest is connected, the host sets up a pool of `SPARES` (4) spare links with it over the live one (`makeSpares`, `{t:'spare',n,sdp}` down, the answer back up), both sides stripping their ICE candidates (`noCands`) so the spares sit idle. When the live link dies the guest feeds the host's saved candidates into the first spare (`rescue`/`tryNext`); the host learns the guest as a peer-reflexive candidate and the spare opens (`bringBack`), the guest says `hello` again and gets a fresh pool. If the host is the one away, an attempt fails after up to `TRY_MS` (20 s) and the guest moves to the next spare, so the pool covers about 80 s of host absence; coming back into view retries the current one at once.
- Guest triggers: channel closed, `failed`, `disconnected` for 2.5 s, nothing heard for 6 s (guest pings every 2 s, host answers `pong`), no pong within 1.5 s of becoming visible. Note at the bottom: "Lost the host. Reconnecting…". Pool exhausted → the old Join screen.
- Host: a lost guest keeps their place for `GRACE` (2 min, `peerLost`, note "X has lost the connection. Keeping their place…"), then `peerGone` as before. Their turn waits meanwhile.
- Guests send a persistent `pid` (`bowling-bear.pid`) in `hello`; a guest whose page reloaded and rejoins through a fresh invite is re-keyed onto their old player (`rekey`), even after being marked gone.
- Both sides hold a screen wake lock (`keepAwake`).
- Test: scratchpad `bbrejoin.mjs` pattern (two Chromium processes, `__n` injected by the test server, exposing `G`): kill, first spare unreachable (host away), silent link, reload + reinvite, pool emptied. Not yet tried on real locked phones.

## Join link and smaller codes (2026-10-29, `BB3`)

The host's QR is now a link (`…/bowling-bear/#BB3O…*`), as Quizbuzz's is: a phone scans it with its own camera app and lands on the `invited` screen (name, Join), which calls `joinWith`; the hash is cleared so a reload doesn't reuse a stale offer. In-app scanning still works and accepts the link (`codeOf` takes what follows `#`). Codec: Base45 replaced by a 41-character alphabet (`0-9A-Z+-./:`, safe in a URL fragment and in QR alphanumeric mode), ufrag/pwd packed 6 bits a character, mid omitted when `0`, at most 3 candidates; `drawQR` uses a byte segment for the address and an alphanumeric one for the code, error correction L. Host link 41×41 modules on jermolene.com, reply 33×33. `BB1`/`BB2` codes get "from an older Bowling Bear".
