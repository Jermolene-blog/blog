# Bear Beat — handover

Bear Beat is a single-page three.js app. One to four animated brown bears dance on a light-up disco floor, on the beat of whatever music they hear. The music can come from the microphone, a song file, a built-in demo groove or tap tempo. It was built in a claude.ai chat session and is published there as an artifact. This file is the handover for continuing in Claude Code.

## Files

```
index.html                 the whole app (HTML + CSS + one ES module, ~1270 lines)
assets/bear.glb            the model, converted (see tools/convert_model.sh)
assets/LICENSE-model.txt   CC BY 4.0 credit for the model; the page must keep showing it
tools/build.py             makes bear.json and dist/bear-beat-standalone.html
tools/convert_model.sh     how bear.glb was made from the Sketchfab glTF
tests/harness.mjs          headless Playwright checks: pose screenshots, beat accuracy, fake mic
tests/make_test_track.py   synthetic drum track with a known beat grid
```

`bear.json` and `dist/` are build outputs. Run `python3 tools/build.py` after any change to `index.html` or the model.

## Two deliverables, two hosting constraints

1. **claude.ai artifact.** Publish `index.html` with `bear.json` beside it. The host wraps the file in its own `<!doctype><head><body>` skeleton, so `index.html` has no html/head/body tags. It starts with `<title>`, `<style>` and so on. The host refuses `.glb`, so the model ships as base64 inside `bear.json`. The page fetches it with a progress bar and decodes it with `atob`. Artifacts **block `getUserMedia`**, and microphone isn't an available capability, so the Microphone button explains this and offers the other sources.
2. **Standalone file.** `dist/bear-beat-standalone.html` has the same page with the model inlined in `<script type="application/json" id="bearData">`, which `loadModel()` prefers when present. Opened locally in Chrome, Edge or Firefox, the microphone works.

The only external dependencies are three.js 0.160.0 from jsDelivr through an import map, plus Google Fonts (Monoton, Manrope, DM Mono). The artifact CSP allows only cdnjs, jsDelivr, unpkg and Google Fonts.

## The model

The model is "Realistic Animated Bear 3D Model" by WildMesh 3D on Sketchfab, licensed CC BY 4.0. Credit is required and is shown in the "Now dancing" card.

- **Clips:** 81, covering stand, locomotion (walk, trot, run, sprint, sneak, each with L/R turning variants), sit, lie, attack, hit, death and many transitions.
- **Rig:** 37 joints, a quadruped. Bone names look like `RigPelvis_02`, `RigSpine1_011`, `RigChest_013`, `RigHead_021`, `RigLFLeg1_015` (front leg = "arm"), `RigLBLeg1_03` (back leg) and `RigTail1_034`.
- **Root motion:** `RigRoot_01` carries real root motion (translation plus yaw). At boot, `measureAndStrip()` measures each locomotion clip's travel in world space, then rewrites the root tracks so those clips play in place. The moonwalk uses the measured stride (`strideWalk`).
- **Facing:** `fwd0` is the model's facing at heading 0, taken from the Walk clip's travel direction. Left/right limbs are detected geometrically (`lIsRight`) rather than trusted from the names.
- **Scale:** the bear is normalised to 2.1 m nose to tail.

## Architecture (sections of `index.html`, in order)

- **Scene:** a renderer with ACES tone mapping and soft shadows.
  - The floor is 14×14 `InstancedMesh` tiles. A material patch makes each tile's emissive colour follow its instance colour, so tiles glow and still take shadows.
  - `paintFloor()` runs four beat-synced patterns, switching each bar.
  - There's also a mirror ball, a key spotlight and two rim lights that pulse on the beat.
- **Model loading and bears:**
  - **Prototype:** the loaded glTF is kept out of the scene and used to measure at boot.
  - **Bears:** `makeBear(i)` creates four `SkeletonUtils.clone`s, each with its own `AnimationMixer`, cloned materials and bone map.
  - **Looks:** `LOOKS` gives each bear a coat (a shader patch recolours the fur texture by luminance), a height (`scale`) and an energy (`amp`).
  - **Line-up:** `SLOTS` places 1–4 bears. Bears on the left (`x < 0`) dance mirrored.
- **Bone overlay:** choreography is procedural, layered on top of a base clip.
  - **Body frame:** everything is expressed in the bear's body frame (`frame.f` forward, `frame.r` right, `UP`).
  - **Helpers:** `aim()` points a bone at a direction, `pyr()` applies pitch/yaw/roll, and `worldRot()` converts a world-space rotation into a bone-local one.
  - **Application:** `applyOverlay(bear, S, w)` applies the pose vector to one bear, covering spine, head, arms, hind-leg lifts, pelvis isolation and tail.
  - **Mirroring:** `mirrorS()` swaps left and right in the pose vector.
  - **Exaggeration:** `FLING` scales everything up for showmanship.
- **Poses and choreography:**
  - **Pose objects:** a pose is `{ R, L, head, spine, hips, leg, paw, pelvis, tail }`.
  - **`ARM` library:** arm directions for the bear's right arm. `mir()` mirrors them, `keys()` keyframes them so each move lands on the beat, and `lerpPose()` blends between poses.
  - **`DANCES`:** a list of routines, each a list of segments: `{ name, beats, clip, map: {cycle|span|hold}, pre/post posture ('four'|'hind'), travel, travelSide, turn, pose(sb), noFlourish, stiff }`.
  - **Posture changes:** when one is needed, `TRANS.toHind` / `TRANS.toFour` are inserted automatically.
  - **Routines:** Freestyle, Moonwalk, Disco point, Y.M.C.A., Macarena, Gangnam Style, The Floss (+ dab), Twerk, Thriller and The Robot.
- **Beat clock:** `clock.beat` is a float beat count, which everything reads. Its sources:
  - `metro` (silent, default) and `tap`: a straight line in wall-clock time.
  - `demo`: an original synth groove scheduled ahead on the audio clock. The beat is computed exactly from `actx.currentTime`.
  - `song`: the decoded file is analysed offline. Spectral-flux onset envelope at 100 fps, autocorrelation tempo, Ellis-style dynamic-programming beat tracker, kick-band downbeat guess. Playback uses an `AudioBufferSourceNode`, so beat time comes from `actx.currentTime`.
  - `mic`: a `ScriptProcessorNode` stream gives sample-accurate flux at 100 fps, with timestamps from sample counts. Every 0.25 s `micAnalyse()` re-estimates tempo (stable tempo jumps are only accepted after 4 agreeing estimates) and phase (comb over recent beats, kick band weighted ×1.5). A phase-locked loop then nudges the clock line through `clock.pend`.
  - The `Sync offset` slider shifts what the dancers see by ±250 ms.
- **Choreography engine:**
  - **Segments:** `tickDance(beat)` advances segments and integrates heading and travel. It also adds a groove sway and a tucked-leg jump on the last beat of every 4 bars.
  - **Base clips:** `setBase()` / `pushLayer()` / `blendLayers()` blend base clips by hand, per bear.
  - **Clip timing:** `clipTime()` maps beats to clip time: `cycle` is phase-locked to the global beat, using a power-of-two number of beats per clip cycle chosen by `fitCycle()`; `span` scrubs across the segment; `hold` freezes one frame.
- **UI:**
  - **Panels:** dance list, "Now dancing" card, and a bottom deck with BPM, beat dots, sources, the Bears 1–4 buttons, status, tempo and sync offset.
  - **Keys:** T taps the tempo; 0–9 pick a dance.
  - **Song files:** can also be dragged onto the page.
- **Boot and loop:** per frame, the loop:
  1. steps the clock;
  2. ticks the dance;
  3. per bear: blends layers, sets clip times, restores the pre-overlay snapshot, runs the mixer and snapshots again;
  4. smooths the pose vector (τ = 35 ms);
  5. applies the overlay to each visible bear;
  6. paints the floor and updates the lights and HUD.

## Hard-won gotchas (don't undo these)

1. **The three.js mixer skips writing a bone whose sampled value hasn't changed** (`PropertyMixer.apply` compares against the last value it applied). With held clips (`hold` maps, frozen beats), resetting bones to rest each frame showed the bind pose. The fix: restore the *previous frame's pre-overlay snapshot*, run `mixer.update`, then snapshot again before overlaying. That's the `bear.rest` dance in `loop()`.
2. **Don't use `crossFadeTo` for base clips.** Rapid segment changes chain fades, and stale actions kept weight, blending a quadruped pose into an upright one. Layers are now blended by hand with explicit weights (`pushLayer` / `blendLayers`).
3. **The rig's chest skin tears when the upper arm leaves its natural hang.** It makes a bat-wing membrane from sternum to paw. `safeUpper()` keeps each upper arm in a cone pointing down (`y ≤ -0.7`), with at most 0.3 outward/inward and -0.3…0.7 forward. `safeLower()` folds any forearm outward component beyond 0.45 forward. Every gesture is therefore done with forearms and elbows: bear-sized moves, so the Y.M.C.A. letters sit at chest height. Check new poses with the harness before trusting them.
4. **Clock lines, not `dt`.** Free-running sources are `beat = ref.b + (now - ref.t) / period`. `rebase()` must evaluate the line at *now* (`lineBeat()`), not reuse the last frame's `clock.beat`, or every period change loses the time since the last frame. That bug made the mic phase drift by about 1/8 beat every 4 s. Phase errors are likewise measured on the line (`clock.ref`), not on the rAF-stale `clock.beat`.
5. **iPadOS/iOS audio.** An AudioContext only starts from inside a tap. `unlockAudio()` (create/resume plus a 1-sample silent buffer, and `navigator.audioSession.type = 'playback'` where supported) runs from every button that can lead to sound, plus a capture-phase `pointerdown`/`keydown` fallback. The song clock is only `active` while `actx.state === 'running'`, so dancers don't freeze on a negative song time. This was reported broken on an iPad and fixed blind, because headless Chromium doesn't simulate the suspension.
6. **File picker.** `accept="audio/*"` greyed out MP3s on the user's device. The input now lists extensions and MIME types explicitly.
7. **Onset timing.** The offline tracker credits an onset to the frame start, so beats are shifted by half a window (`Nf / 2 / sr2`, about 23 ms).
8. **Camera.** It stays at the front of the stage (`r0` / `f0`, the heading-0 frame). It doesn't follow the bears' heading, so turns read correctly: the twerk shows rumps, the Macarena shows its quarter turns.

## Testing

```
python3 tools/build.py
cd tests && npm install
python3 make_test_track.py test.wav 123        # ground truth: first beat 0.37 s
node harness.mjs beats test.wav 123 0.37        # song-file tracker accuracy
node harness.mjs mic test.wav                   # fake microphone, phase histogram
HIDEUI=1 node harness.mjs shots '[["ymca",9.5,"y",4],["twerk",5,"tw",1]]'   # writes tests/out/*.png
```

The page exposes `window.__bear` test hooks:
- `sim(danceId, beat)` fast-forwards the scheduler to a beat and freezes there;
- `setBears(n)` sets the number of bears;
- `poseOverride` (a pose object) replaces the choreography so you can probe raw poses;
- `micPhase()` and `dbg()` report state;
- `clock`, `state`, `song` and `mic` are exposed directly.

Results at handover, all headless, software WebGL and synthetic audio only:
- **Song file:** 122.7 BPM against a true 123; median beat error 6.8 ms, 90th percentile 10.8 ms.
- **Mic:** locks in about 6 s at 122.7 BPM. The phase histogram peaks in bin 7/0, so it's on the beat but roughly 30–60 ms early, with a secondary peak at the off-beat hats.
- **Not tested:** real music, a real room microphone, and a real iPad.

## Open items / ideas

- **Mic phase:** there's a small consistent early bias. Calibrate the 20 ms latency guess in `micChunk` against real hardware, or add a one-tap "clap to calibrate". On tracks with heavy off-beat bass it can still lock half a beat out; tapping along pulls it back.
- **ScriptProcessorNode is deprecated.** An AudioWorklet from a Blob URL would be the modern route for the mic stream. The standalone file can use it; artifacts can't use the mic anyway.
- **Downbeat detection** for songs is a crude kick-band guess (`song.down`). Bars may start on beat 2 or 4.
- **Arm range:** proper corrective skinning (or a better-weighted model) would allow real overhead arms: a true Y.M.C.A. or a Travolta point to the sky.
- **Choreography:** the bears dance in unison, with the left side mirrored. Canon, call-and-response or per-bear solo turns would be easy to add in `loop()`, by offsetting the beat per bear for the overlay.
- **Freestyle** picks routines at random. It could choose by detected tempo, since each dance has a reference BPM in `DANCES[].bpm`.
- **The user's usual pattern** for generative single-page toys is randomise, reset and 8-way parameter exploration. That isn't implemented here and may not fit; ask first.

## Conventions

- The page is dark-only: deliberate night-club styling, a single theme. Colour tokens are in `:root`.
- Respect phone width: at 760 px and below, dances become a horizontal strip, the info card shrinks and the deck stacks.
- Keep everything in one file. If you republish as a claude.ai artifact, keep the skeleton-less format and publish `bear.json` alongside.

## On jermolene.com (integrated 2026-10-25)

The published toy is `static-assets/toys/bear-beat/index.html` in the blog repo, and it is now the source to edit; this folder's `index.html` is the artifact version at handover and is not kept in step. Differences from the artifact version:

- A full `<!doctype><html><head><body>` skeleton, with the toys' PWA tags (manifest, theme colour, icons, `../pwa.js`), a description and `toy-category` trifles.
- The model is `bear-model.js`, which sets `window.BEAR_GLB` to the base64 GLB. `loadModel()` injects it as a script, because `fetch()` fails when the page is opened from disk. Regenerate it with `python3 tools/build_toy_model.py <blog>/static-assets/toys/bear-beat/bear-model.js`. The load bar now eases towards 90% instead of showing real progress.
- The microphone message no longer mentions artifacts or the standalone file, since the mic works on the site.
- `icon.svg` (bear face, mirror ball, disco floor) with PNGs from `build-icons.sh`.

To run the harness against the toy, point its page URL at the toy folder.
