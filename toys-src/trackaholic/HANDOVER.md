# Trackaholic (formerly Glimmerway)

Replaces Fall Line (the snowboard game). Fall Line was hard to play, and it had bugs: you could ride under the mountain, and trees floated.

Trackaholic is a car race through a magical dusk valley, played alone against bots or with phones joining over the same Wi-Fi. It is a single HTML file plus the car model, using three.js 0.160 ES modules from jsDelivr, plus qrcode-generator and jsQR. It is published at `jermolene.com/toys/trackaholic/` from `static-assets/toys/trackaholic/index.html`, which is edited in place.

Renamed from Glimmerway on 2026-10-30. Settings are stored under `trackaholic.*`, so old local settings and best times reset. The data channel is `trackaholic` and reply codes start `TA2A`, so devices must all run the same version.

## Car model

- “Car Concept” by Eric Chadwick / Darmstadt Graphics Group, from the Khronos glTF-Sample-Assets.
- Licence: CC BY 4.0, derived from a CC0 Sketchfab model by Unity Fan. The licence excludes the Khronos logos.
- Processed with gltf-transform:
  - removed the Khronos logo textures (licence plate, tyre sidewalls) and the hidden interior parts;
  - simplified to about 90k triangles;
  - converted textures to WebP at 1024 px;
  - quantised the geometry.
- Result: 3.1 MB.
- At runtime:
  - Paint 1 is set to the player colour, and Paint 2 / Interior 3 to a dark accent.
  - Transmission glass is replaced with transparent clearcoat glass.
  - Brake lights are emissive when braking.
  - Wheel nodes are steered, spun and moved with the suspension.
- The rejected alternative: the three.js `ferrari.glb`, whose licence couldn't be verified and which carries a real brand.
- Credit line is on the title screen.

## Why the old bugs can't recur

- The track is a closed Catmull-Rom loop through control points in angular order, so it never self-intersects. It is sampled every 2 m and has banking.
- The terrain is one heightfield. Physics samples the same triangles the renderer draws.
- On the road, physics ground = max(terrain, road plane).
- All props are placed at `terrainH(x,z)`.
- A hard clamp lifts any car whose centre of mass ends up under the ground.

## Hosting

Trackaholic isn't meant to be projected: the players gather round, each looking at their own device, and the host is one of them. So by default the host drives too (2026-10-30):
- The lobby has a "Drive on this device" switch (stored as `trackaholic.hostdrive`, on unless `'0'`) and a name field (shared with `trackaholic.name`). `HOST.me()` makes the host's entrant, id `host`, in the first colour no guest has; guests joining later skip that colour, so it doesn't change.
- The host enters the race first and is its local car (`meId: 'host'`), with the HUD, the touch pad and the chase camera; `relay()` sends its state with the bots'. The checks that picked the overview camera and leaderboard ask whether this device is driving (`!G.me`), not whether it's the host.
- While driving, the host's Join code and End race buttons sit in a column under the place counter (`body.hostdrive #tvBar`), clear of Back on track, the minimap and the pad.
- Switched off, the host watches as before, with the overview cutting between cars; Start is then disabled until there's a guest or a bot.
- The wording no longer mentions a big screen: phones hold their reply up to the host's camera.

## Physics

- Rigid body: 1250 kg.
- Four raycast struts, with springs, bump/rebound damping, bump stops and anti-roll bars.
- Tyres:
  - lateral force from slip angle on a Pacejka-like curve;
  - AWD drive (175 kW) and brakes;
  - a friction circle per wheel, scaled by load;
  - grass has lower grip and extra drag.
- Aero drag and downforce. Body corners collide with the ground.
- Auto-reset when flipped or lost.
- Manual reset: the R key, or the “Back on track” button.
- Simulation runs at 120 Hz.
- Phone controls: throttle is automatic; see Tilt, drift and nitro below for steering, braking and the nitro.

## Tilt, drift and nitro (2026-10-30)

- **Tilt steering** is the default wherever it's available (`TILT_ABLE`: a touch screen and `DeviceMotionEvent`). `onMotion` keeps the angle of gravity in the plane of the screen, `atan2(g.x, g.y)` from `accelerationIncludingGravity`; `tiltSteer` measures it from `tilt.zero`, taken when the countdown starts and again at Go. Turning the device like a wheel is a rotation about the screen's normal, so this works in portrait or landscape and however far the device leans back, and iOS and Android reporting gravity with opposite signs (a half turn) cancels out. Full lock at 28°, a 1.5° dead zone, smoothed. Turning the device between portrait and landscape is itself a quarter turn about that axis, so when the screen rotates (`screen.orientation` change, `orientationchange`, or the viewport flipping between portrait and landscape) `tiltRotated()` holds the steering centred for 0.6 s and measures from wherever the device is then held; and a reading beyond 65° for 0.8 s of real time (a turned device with its screen locked) re-centres too. Below 2.5 m/s² in the screen's plane (lying nearly flat) the last angle is kept.
- iOS needs permission: `askTilt()` calls `DeviceMotionEvent.requestPermission()` from the taps that start or join a race (Race, Join, the host's Start) and from the Steering pill. Refused, it falls back to drag. The pad only switches to tilt (`#pad.tilt`) once a reading has arrived (`tilt.ok`), so a device without the sensor keeps the drag controls.
- The "Steering: Tilt / Drag" pill sits beside Sound on touch devices; the choice is stored as `trackaholic.steer`.
- **Controls with tilt:** holding the left half of the screen (`#tiltL`) brakes, and in a bend at speed drifts; holding the right half (`#tiltR`) fires the nitro. With drag steering, the brake button drifts too, and a Nitro button sits above it. Keyboard: Space drifts, Shift or N for nitro.
- **Drift** (`inp.drift`, sent only when braking while steering more than a quarter lock above 9 m/s): the brake drops to a quarter, the throttle stays on and the rear tyres' grip falls to 0.62 of the fronts', so the back steps out; the existing skid smoke and squeal follow. Holding it when stopped still reverses.
- **Nitro** (`inp.nitro`): `c.nitro` is a tank from 0 to 1, full at the start, drained in 2.6 s while boosting and refilled in 9 s, faster (an extra 1 per 2.5 s) while drifting. Boosting gives 75% more power and 35% more maximum drive force, widens the chase camera by 10° and adds wind noise. The meter (`#hNitro`) is under the lap counter.
- Bots never send `drift` or `nitro`, so they drive as before. Neither is in the network packet: other devices see a drifting or boosting car only through how it moves.

## Gameplay test and handling (2026-10-30)

`toys-src/trackaholic/test/gameplay.mjs` drives single cars round six fixed tracks for 150 s each through the game's own physics (`stepCar`), headless and without rendering (`?norender`), in about ten seconds. It needs only Playwright from `toys-src` (`cd toys-src && npm install`); the toy's CDN libraries are cached in `test/.cache` (not committed) on the first run, so later runs don't need the network.

- Drivers: the game's bot, as a reference, and a model person steering by tilt, by drag and by keyboard. The person corrects by feel (device angle or thumb offset in proportion to the angle to a point on the road ahead), with a 0.2 s reaction delay, a lagging hand and a tremor, through the game's own `tiltCurve` and `autoGas`; brakes by eye, entering corners about 10% too fast; the tilt driver uses the nitro on straights. Random numbers are seeded, so runs repeat exactly.
- Measures: distance covered, lap time, time off the road, flips, resets (and how many were for being lost), jumps and how many landed on their wheels, spins, and how hard the steering works. The header of the script defines each.
- `node toys-src/trackaholic/test/gameplay.mjs` compares with the committed `test/baseline.json` and marks each change ✓ or ✗; `--save` makes the current results the baseline; `--detail` shows each track; `--set key=value` (repeatable, eg `--set tip.k=0`, `--set mu=1.3`) tries other values of `CAR`'s settings without editing the toy. After changing the physics or the controls, run it, and save a new baseline when the change is committed.
- `window.GW` exposes what it needs: `rebuildCourse`, `newCar`, `placeCar`, `stepCar`, `botInput`, `trackQuery`, `tiltCurve`, `autoGas`, `CAR`, `HZ`, `HALF_W`. It waits for the car model before starting, since the model sets the wheels' positions and size.

What it found, and what changed (all in `CAR`, which documents each setting):
- Cars that went far from the road (more than 30 m) got a `NaN` road position from `trackQuery`, which then dropped the nearby search but kept its best distance; their progress went `NaN` and they were never reset as lost. Fixed.
- Coming into a corner faster than it could take, the car ran wide off the road (the front tyres were saturated, so more lock did nothing), and on touch screens, where the throttle is automatic, the player couldn't lift off. Off the road it rolled over easily on the hillsides, and jumps often ended on the roof.
- Changes: more grip (`mu` 1.18 → 1.45, `muGrass` 0.78 → 0.95); on touch screens the automatic throttle also slows for the corner ahead (`assist` 1.05: it aims for 1.05 times the corner speed the bots use, looking as far ahead as the car needs to brake); in the air the car is turned to match the ground below and its rolling and pitching damped (`air`), so it flies and lands on its wheels; and a car tipped past 20° on the ground is pushed back upright (`tip`). Keyboard players keep their own throttle. Tried and not kept: easing the automatic throttle on full lock, more steering lock at speed, stronger air and tip settings (no consistent gain).
- Results, before → after, summed over the six tracks:

  | driver | off the road | flips | resets | jumps landed |
  |---|---|---|---|---|
  | tilt | 52% → 27% | 18 → 3 | 23 → 6 | 65% → 82% |
  | drag | 24% → 6% | 7 → 1 | 8 → 0 | 68% → 87% |
  | keys | 48% → 24% | 21 → 1 | 26 → 7 | 65% → 87% |

  The bot was unaffected (it never exceeds its corner speeds). The model people are a rough stand-in: the numbers show direction, not how it feels, and the tilt curve itself (`tiltCurve`: full lock at 28°) hasn't been tuned against real players yet.

## Network

- Bowling Bear signalling, with the host as hub.
- `start.spec` and `lobby` carry `laps`.
- The state packet holds: position, quaternion, velocity, steer, flags, 4× suspension compression, progress and throttle.

## On jermolene.com

The toy must also work opened straight from disk, where `fetch()` of a local file fails, so the car arrives as `car-model.js`, a script that sets `window.CAR_GLB` to the base64 GLB, which `loadCar()` loads with a script tag (the same arrangement as Bear Beat's `bear-model.js`). `toys-src/trackaholic/assets/car.glb` is the processed model; after changing it, rewrite the script with:

```
python3 tools/build_car_model.py ../../static-assets/toys/trackaholic/car-model.js
```

(In the claude.ai artifact, whose host wouldn't serve `.glb`, the model was base64 in `car.txt`; that fallback has gone.)

Other changes made when the toy joined the site:

- The toy tags in the `<head>`: description, `toy-tagline`, `toy-category` (games), the web app manifest, `apple-touch-icon` and `../pwa.js`. Its icon is `icon.svg`, rendered by `build-icons.sh`.
- The title is capped at 80px rather than 88px: at 88px “TRACKAHOLIC” in Cinzel was wider than its 620px box, and `background-clip:text` cut off the final C.
- `build-screenshots.js` captures the title screen as the thumbnail, and for the social media card starts a solo race and holds the accelerator. The track is random, so each recapture differs.

## Verified (headless Chromium)

- Six-bot races on three seeds:
  - 50–70 s laps;
  - 140–150 km/h peaks;
  - no flips;
  - body never closer than 0.33 m to the ground.
- Two-process LAN test, re-run after the rename:
  - join;
  - race;
  - matching results on both devices;
  - reconnect;
  - second race.

## Not yet verified

- Real iPad and iPhones: frame rate with 8 cars, Safari ICE, camera reading reply QRs.
- As an installed web app: `pwa.js` adds a small “back to the toys” button in the bottom-left corner when the toy is opened from the installed toys app, which may sit under the steering thumb on a phone.
