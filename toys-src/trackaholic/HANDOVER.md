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
- Phone controls: throttle is automatic, the left thumb steers, and the right thumb brakes (which reverses when stopped).

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
