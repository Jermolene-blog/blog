# Meadow Games: handover

Tap-only 3D games for toddlers, built with three.js and the CC0 Quaternius "Ultimate Animated Animals" pack.
Main target: iPad (Safari, and the Claude iOS app's web view). The finished pages are published as single-file
claude.ai artifacts, which shapes most of the technical choices below.

## What's here

| App | Source | Built page | Published artifact |
|---|---|---|---|
| Meadow Games: the toddler games (main project) | `games/` | `dist/meadow-games.html` | https://claude.ai/artifact/U4aXJh8hXjjjFayp3x5Tf2 |
| Animal Meadow: free-roam island sandbox | `meadow/` | `dist/animal-meadow.html` | https://claude.ai/artifact/L1iXw4ghWtr2ZS3KaPn6zc |
| Animal Lineup: viewer for comparing the 12 models | `lineup/` | `dist/animal-lineup.html` | https://claude.ai/artifact/VMGRoC4Tr9UQ9mRrMAi92L |

- `assets/animals/*.glb`: the 12 animals (Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu,
  Stag, Wolf). Converted from the pack's glTF with `gltf-transform optimize --compress meshopt` (36 MB → 5.2 MB).
  About 2,500 triangles each, flat vertex colours, no textures. CC0, by Quaternius (quaternius.com).
- `tools/build.py`: builds `dist/` from the sources.
- `tools/shot.mjs`: headless Chromium test harness.
- `tools/record-meadow-voice.sh`: Mac script the user runs to record the game's phrases in their own voice (see below).

## On jermolene.com

Since 2026-10-24 Meadow Games is also a toy on jermolene.com, at `/toys/meadow-games/`. This project lives in the
blog repo at `toys-src/meadow-games/`, and `python3 tools/build.py --site` writes the toy into
`static-assets/toys/meadow-games/` as `index.html` (page plus module) and `models.js` (the GLBs as base64 on
`window.MEADOW_MODELS`, which `games/app.js` prefers over the inline JSON block). After changing `games/`, run it,
then commit the toy in the blog repo. `models.js` only changes when the models do. The toy's `icon.svg` and PNG
icons live only in the blog repo. Animal Meadow and Animal Lineup are not published there.

## Build and test

```sh
npm install                      # three@0.160.0 and playwright, for testing only
python3 tools/build.py           # → dist/*.html
npx playwright install chromium  # if no browser is installed
node tools/shot.mjs dist/meadow-games.html out.png 1280 800 6000 steps.json
```

Each app is `shell.html` (title, CSS, markup) plus `app.js` (one ES module). The build concatenates the shell,
a `<script type="application/json" id="models">` block holding every GLB as base64, an import map for three, and
the module. Pages are about 7.2 MB, of which the models are roughly 7 MB.

Testing notes:
- SwiftShader WebGL runs at about 3.5 fps, and the game clamps `dt` to 0.05 s, so game time runs about 6× slower
  than wall time. In Meadow Games, run `{"eval":"(__meadow.dtCap=0.25,1)"}` first.
- `window.__meadow` exposes `start(key)`, `GAMES`, `S` (current game state), `targets` and `camera`. To tap a
  target, project its hit mesh to screen coordinates, then `mouse.click` there:
  `const v=t.hit.getWorldPosition(new t.hit.position.constructor()).project(__meadow.camera); [(v.x*.5+.5)*W, (-v.y*.5+.5)*H]`
- The harness serves three from `node_modules`, blocks all other network requests and wraps the page in the same
  skeleton the artifact host adds.
- Check phone portrait (390×844) as well as landscape. Layouts branch on aspect ratio.

## Constraints from the artifact sandbox (these explain the odd choices)

- Scripts may come only from cdnjs, jsdelivr/npm, unpkg, cdn.tailwindcss.com or code.jquery.com, with exact
  version pins. Stylesheets only from Google Fonts. No fetch or XHR to any other host.
- An artifact can't publish `.glb` as a supporting file, even with a content type, so the models are inlined
  as base64. Audio clips (`.mp3`, `.wav`, `.ogg`) can be supporting files, but inlining keeps a single file.
- 16 MB page limit.
- No `alert`, `confirm` or `prompt`, and no downloads the page starts itself. Sound needs a user gesture first;
  `audio()` resumes the AudioContext on the first tap.
- localStorage works, but wrap it in try/catch. It's used only for the chosen voice (`mg-voice`).
- If publishing through the Artifact tool: the page has no `<html>`, `<head>` or `<body>`. The skeleton is added
  at publish time.

## Meadow Games (`games/app.js`) architecture

Sections, in order:
1. **Constants:** `NAME`, `PLURAL`, `GROUPS`, `distinct(n, exclude)`. `GROUPS` lists lookalikes that must never
   appear as alternatives together: [Horse, Horse_White, Donkey, Deer], [Stag], [Wolf, Husky], [Cow, Bull],
   [Alpaca], [Fox, ShibaInu]. That leaves 6 groups, so no game can need more than 6 clearly different animals.
2. **Renderer and lights.** One persistent scene. Shadows come from `sun`, with the shadow camera covering ±15 units.
3. **Tasks:** `tween(dur, fn(k), {e, done})` and `after(sec, fn)`. Everything timed goes through these.
   `start()` clears all tasks, so game switches never leak timers. Cancel a task with `task.dead = true`.
4. **Sky:** `setSky('day' | 'dusk' | 'night', dur)` blends background, fog, both lights, stars and moon.
   `nightHooks` lets a game react to night (the barn window glow).
5. **Scenery builders:** `tree(kind)`, `makeBush()`, `makeHay()`, `makeBarn()` (returns `{g, doors, winMat, open(), close()}`)
   and `buildEnvironment()` (ground, trees in a ring, grass and flowers; built once).
6. **Animals:**
   - Templates are normalised at load: each model is wrapped and rotated so it faces +Z, using the Head node's
     position minus the Body node's, then centred with its feet at y=0.
   - `makeAnimal(id, size)` sets the size by `max(length, 1.1 × height)`. It adds an invisible hit sphere,
     a mixer, and `a.rest` (the looping state to return to).
   - `play(a, set, {once, fade, ts})` picks a clip from a named set: idle, calm, walk, gallop, jump, hit, death, eat.
   - `oneShot`, `hop` and `flinch` play a clip once and then return to `a.rest`.
   - `goTo(a, points, {gait, onArrive})` steers along waypoints.
   - `popIn` and `popOut` scale an animal in or out. `removeAnimal` takes it out of the scene.
   - To make an animal get up, play its Death clip backwards (negative `timeScale`); the pack has no get-up clip.
   - Clip names vary slightly by species: `Jump_toIdle` vs `Jump_ToIdle`, `Idle_Headlow` vs `Idle_2_HeadLow`,
     `Attack_Headbutt` vs `Attack`. Always go through the `SETS` lists.
7. **Particles:** `burst(pos, n, colours, {speed, up, size})` with the `CONFETTI`, `LEAVES` and `HAY` palettes.
   One InstancedMesh pool of 360.
8. **Sound:** `sfx.*` are WebAudio synth blips (no audio files). `say(text, caption, holdSecs)` shows the caption
   bubble and speaks through Web Speech using the picked voice. The voice picker lists English voices.
9. **Camera:** a fixed camera per game. Set `view.target`, `view.el` (elevation in radians), `view.hw` and
   `view.hh` (half-extents to fit), then call `fit()`. It refits on resize but doesn't re-lay-out.
10. **Game switching and taps:**
    - `start(key)` tears down the old game, resets state and calls `GAMES[key].start()`.
    - Each game is an object with `start`, `tap(target)`, optional `tick(dt)`, `title`, `blurb`, `thumb`,
      `sky` and `action` (label for the big bottom button, which calls `tap(null)`).
    - Register tappable things with `addTarget(hitMesh, data)`.
    - Taps fire on **pointerdown**. If the ray misses, the nearest target within 13% of the screen's short side
      counts (forgiving for toddler fingers). No dragging anywhere.
11. **The games**, in order on the home screen (`ORDER`, easiest first):
    - `peek` (Peekaboo): 2×2, 1×3 or 1×4 bushes depending on aspect. Tap a bush and it collapses, the animal hops
      and is named; the bush regrows with a new animal. Idle bushes rustle.
    - `fall` (All fall down): 5–6 animals walk round a ring. Any tap or the button makes them fall in a ripple,
      then get up.
    - `bed` (Bedtime): dusk. Tapping an animal sends it galloping into the barn. When all are in, night falls with
      a lullaby; a "Good morning!" button lets them out and the cycle repeats.
    - `same` (Find the same): a target animal on a podium, with 2, then 3, then 4 choices (4 only in landscape).
      Wrong taps name the animal tapped. After 8 seconds idle the prompt repeats with a hint hop. Stars every
      correct answer; 10 stars gives a confetti shower.
    - `pairs` (Pairs): haystack memory game with 2, 3, then 4 pairs. Matches get "Two foxes!", stars and confetti.
    - `home`: the herd grazes behind the menu tiles. Tile thumbnails are rendered at load with a second, temporary
      WebGLRenderer.

## Animal Meadow (`meadow/app.js`)

- A free-roam island with MapControls (pan, zoom, rotate) and wandering animals.
- Steering avoids obstacles and other animals and keeps them away from the shore.
- Tapping an animal hops it and shows its name; "Follow" keeps the camera on it.
- An "All fall down" button, a herd size of 1–3 per species, and a cog with a size slider (1–6×, default 4).
  The slider shrinks the island (`R = 34·U/S`) and regenerates it from the same seed, rather than scaling the
  models.

## In progress: the user's recorded voice

Web Speech on iPad only exposes Apple's built-in compact voices; downloaded Enhanced or Premium voices are hidden
from web pages (WebKit bug 290497). The user is recording all 94 phrases with `tools/record-meadow-voice.sh`.
They'll provide `meadow-voice.zip` containing `<id>.m4a` files (AAC, mono, 64 kbps) and `phrases.txt` (`id|text`).

To integrate:
- Inline the clips as base64, like the models, at roughly 1 MB. Decode once with `AudioContext.decodeAudioData`
  after the first tap; iOS needs the context resumed during a gesture.
- Play through WebAudio rather than `<audio>` elements, for low latency on iOS.
- Change `say()` to take a clip id and fall back to Web Speech when that clip is missing.
- Keep the voice picker, but only for the fallback. Consider hiding it when every clip is present.

Clip ids for each `say()` call (`<k>` is the animal key: cow bull horse whitehorse donkey alpaca deer stag fox
wolf husky shiba):

| Where | Clip id |
|---|---|
| Name alone (home tap, Peekaboo re-tap, Pairs reveal or re-tap) | `name-<k>` |
| Sound toggle "Hello!" | `hello` |
| Peekaboo intro / reveal | `peek-intro` / `peek-<k>` |
| All fall down intro / fall | `fall-intro` / `fall-down` |
| Bedtime intro / tap animal | `bed-intro` / `night-<k>` |
| Bedtime night / morning / repeat | `bed-sleep` / `bed-morning` / `bed-again` |
| Find the same prompt / correct / wrong | `find-<k>` / `yes-<k>` / `thats-<k>` |
| Pairs intro / match / win | `pairs-intro` / `two-<k>` / `pairs-win` |

The voice picker's test phrases ("Hello! I am the cow.", "Peekaboo! Fox!") have no clips; use `hello` and
`peek-fox`. Caption text stays as it is now.

## Known rough edges and ideas

- Foot sliding: walk and gallop speeds are estimates (about 0.8× and 2.3× animal height per second).
- Bedtime: animals coming out in the morning can bunch together near the door.
- Pairs in phone portrait is fairly small, because width limits the zoom.
- The meadow's facing comes from the Head/Body bones; if a model ever walks sideways, check that first.
- Background models: the user wants Quaternius **Ultimate Stylized Nature** (CC0, quaternius.com/packs/ultimatestylizednature.html).
  It's hosted on Google Drive, which was unreachable from the previous environment. It's textured with normal
  maps, unlike the flat-colour animals, so it may need flattening to vertex colours to match their style. The
  scenery is currently procedural (icosahedron trees, bushes, rocks).
- Game ideas not yet built (all must be tap-only): tap to count ("one, two, three cows"), feed the hungry
  animal, animal noises (would need CC0 recordings).

## The user

- Jeremy (GitHub: Jermolene), building a series of single-page toddler games.
- Prefers concise, technically precise communication.
- For generative or toy pages Jeremy's "usual instructions" are: randomise, reset, and 8-way exploration of the
  parameter space.
