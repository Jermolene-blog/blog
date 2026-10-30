# Quizbuzz

Renamed from Hands on Buzzers on 2026-10-27 (title, QR prefix `HB1` → `QB1`, storage keys `hob.*` → `qb.*`, BroadcastChannel and bank key `hands-on-buzzers` → `quizbuzz`).

A Buzz!-style family quiz for Christmas: a late-60s colour TV studio on a projected iPad, a buzzer on everyone's phone, and a toddler button with real power. Single self-contained HTML file. To be hosted on jermolene.com.

Owner: Jeremy Ruston (Jermolene). British English everywhere: spelling, culture, questions.

## Build and run

```
python3 build.py                      # bank from questions/verified/*.json
```

Produces:
- `quizbuzz.html`: the page body as published to the Claude artifact (no doctype; the artifact wraps it)
- `quizbuzz-standalone.html`: same, as a full HTML document (what the tests open)
- `../../static-assets/toys/quizbuzz/index.html`: the published toy (see "On jermolene.com" below)

`src/game.html` is the single source file (`src/rtc.js` is its LAN transport, spliced in; edit it inside `game.html`). `build.py` inlines `vendor/qrcode.min.js` (qrcode-generator 1.4.4, MIT) and `vendor/jsQR.min.js` (jsQR 1.4.0, Apache-2.0) at `<!--__VENDOR__-->`, replaces `__BANK__` with the question bank (JSON, XOR-scrambled with the key `quizbuzz`, then base64, so answers are not readable by viewing source) and `/*__FONTS__*/` with base64 woff2 faces (Shrikhand display, Michroma labels, Jost body; all free, OFL).

## On jermolene.com

This folder lives at `toys-src/quizbuzz/` in the blog repo (until 2026-10-30 it was a separate repo in the gitignored `local/`; its history wasn't carried over). The toy at `static-assets/toys/quizbuzz/index.html` is a **build output**: edit `src/game.html` here and rerun `python3 build.py`, never the toy directly. The build adds the site's toy `<meta>` tags (description, `toy-category` games, theme colour), `../pwa.js` and the manifest/icon links; the site's shared service worker and generated manifest replace the handover's own `dist/sw.js` and manifest, which are gone. `icon.svg` lives in the toy folder; render it with `./build-icons.sh` in the blog repo. After a rebuild, run `node build-toys.js` and `node build-screenshots.js toys/quizbuzz` there.

Live at `https://jermolene.com/toys/quizbuzz/#host`.

## Page modes (URL hash)

| URL | What it is |
|---|---|
| `index.html` | **Studio**: stage + host controls + six in-page buzzer pads + toddler pad, joined by an in-page loopback. Robot players for testing alone. |
| `#host` | **The real thing.** Projector page only. Phones join over the LAN with QR codes (WebRTC); buzzer windows on the same device also work (`BroadcastChannel`). On the day: open `jermolene.com/…/#host` on the iPad and AirPlay it. |
| `#QB2O…*` | What a phone opens from the projector's QR: the host's WebRTC offer. Tap Join, show the reply QR to the iPad, then it becomes a buzzer. |
| `#pad` | One full-screen buzzer in another window on the same device. |
| `#toddler` | The toddler's phone: one circle per player to attack. |

Test hook: `?speed=6` runs the game clock and robots six times faster.

## Architecture

- **The host is the authority.** All state is in `H` (players, phase, round line-up, question, answers). Timing uses a pausable virtual clock (`Clock`, `after`, `later`, `autoNext`); `setPhase` bumps `H.gen` so stale timers die.
- **Phones are dumb.** After any change the host calls `sync()`, which sends every player a complete snapshot of their screen from `padView(p)` and the toddler `todView()`. Reconnection is therefore free: resend the snapshot.
- **Messages up** (phone → host): `hello`, `join {name}`, `ready {v}`, `ans {q, i}`, `bet {v}`, `choose {target}`, `chaos {target}` (toddler), `ping`.
- **Messages down**: a view object; `s` names the screen (`join`, `tut`, `msg`, `q`, `bet`, `verdict`, `choose`, `watch`, `toddler`).
- **Transport seam** (top of the script, "transports"): host side needs `send(pid, msg)` and `seen(pid)` (last-heard time for away detection); guest side needs `send(msg)` and calls back with each view. Implementations: `makeLoopback` (studio), `makeChannelHost` / `makeChannelGuest` (multi-window), `makeRtcHost` / `makeRtcGuest` (LAN), and `makeMultiHost` (channel + LAN together, used by `#host`). Away: silent for 6 s → podium dims, treated as no answer.

## LAN transport (done, adapted from Bowling Bear)

Bowling Bear's signalling (`Jermolene-blog/blog`, `static-assets/toys/bowling-bear/index.html`): compact SDP in a QR (`packSDP`/`unpackSDP`, the same codec as Bowling Bear's `pack`/`unpack`, prefix `QB2`), one invite at a time, the host scans the phone's answer QR. Differences here:
- The projector QR is a URL (`…/quizbuzz/#QB2O…*`), so phones scan it with the normal camera app and land straight in the game.
- **Compact codes (2026-10-29, `QB2`)**: only ufrag and password (6 bits a character), the sha-256 fingerprint, setup role and up to 3 host candidates (IPv4, then mDNS, IPv6 only if nothing else) as bytes; the rest of the SDP is rebuilt from a template. Encoded in a 41-character alphabet (`0-9A-Z+-./:`, three characters per two bytes) that is safe in a URL fragment and fits QR alphanumeric mode; `qrDataURL` puts the address part in a byte segment and the code in an alphanumeric one, error correction L. Join QR 81×81 → 41×41 modules, reply 33×33. Old `#j=QB1…` links get "from an older Quizbuzz".
- In `#host` mode the join card sits on the stage beside the screen (`#joinOv`, `syncJoinCard`), not inside it, with a 516px QR so it scans from 6–8 feet: throughout the lobby, and in a game when the host taps **Join code** (it then covers the right of the screen). The practice studio has no live card.
- The iPad's camera scans reply codes continuously (`startReplyCamera`, BarcodeDetector or jsQR). A small preview sits under the join QR, with a button to switch between the front and back cameras (`flipCamera`, remembered as `qb.cam`). Paste is not needed.
- After each connection a fresh invite replaces the QR. Two phones scanning the same code: the second needs to scan again.
- Phones send `hello {pid}` with a persistent id (localStorage), so a phone whose page was reloaded or discarded rescans the code (**Join code** button on the host bar during a game) and gets its own podium back.
- **Spare lines (2026-10-29)**: a dropped WebRTC link can't be revived from storage (each connection needs fresh keys and addresses swapped). So after every `hello` the host makes a spare offer for that phone and sends it over the live link (`{s:'spare',n,sdp}`); the phone answers it (`{t:'spare',n,sdp}`), both with their ICE candidates stripped (`noCands`), so the spare sits idle. When the live link dies the phone `addIceCandidate`s the host's saved candidates; the host learns the phone as a peer-reflexive candidate and the spare opens, then says `hello` and a new spare is made. Triggers on the phone: channel closed, connection `failed`, `disconnected` for 2.5 s, nothing heard for 6 s (the host answers `ping` with `{s:'pong'}`), or no pong within 1.5 s of the page becoming visible. Screen shows "Back in a moment" meanwhile; after 12 s without success, the old "Lost the studio" rescan message. Phones also hold a screen wake lock (`keepAwake`). `tests/rejoin.mjs` covers kill ×2, a spare idle for 60 s, and a silent link (`debug().mute()`). Not yet tried on a real locked iPhone.
- "This is the toddler's phone" on the join screen makes that phone the toddler.
- `primeCamera()` on both sides, because Safari only offers LAN ICE candidates after camera permission.

Tested headless across separate Chromium processes (`tests/lan.py`): three phones join, play, and one reconnects mid-game. **Not yet tested on real iPhones/iPad.** First real test: iPad on `#host`, two iPhones scanning.

## Rounds

Line-up: Quick on the Draw, then 2/3/5 random middle rounds (Short/Standard/Long), then The Final Furlong. 5 questions per round (decision: keep 5 for now).

| id | Round | Rule |
|---|---|---|
| draw | Quick on the Draw | right answers score 500/400/300/250/200/150 by speed |
| pick | Pickpocket | right = 200; fastest right steals 300 from a chosen player |
| cracker | Pull the Cracker | holder answers; right passes it on; bang at 35–60 s costs 500; two goes |
| count | The Countdown | points drain 1000 → 50 over 15 s; wrong −250 |
| wager | Double or Nothing | category shown first; bet 100/250/500/all in; right +bet, wrong −bet |
| lives | Last One Standing | 3 hearts; wrong or none −1; 250 per heart left, +250 for sole survivor; if all would go out, nobody does |
| furlong | The Final Furlong | horse race; start ahead by up to 25% of the track in proportion to score; fastest right +0.24, other right +0.17; ends when someone finishes or after 10 questions; prizes 1500/750/300 |

Scores never go below zero.

## The toddler

Decision: real power, and the toddler chooses whom to attack. Their phone shows a big coloured circle (initial) per player. A tap throws something at that player's podium, then a 25 s recharge ring. During a question, if the target can still answer: one of **freeze** (their buttons iced for 6 s), **jumble** (their answer buttons reorder), or **pie** (−150). At other times always **pie**. In the lobby a tap just makes confetti. Turned off with the Toddler button setting.

## Host role

Chosen per game in the lobby: **Playing** (Jeremy is a contestant; nothing on the host screen reveals an answer early) or **Quizmaster** (does not score; can skip, flag, and tap a podium ±100). Flagged questions are kept in localStorage and can be copied from the lobby.

## Question bank

- `questions/verified/*.json`: **1,304 questions**, every one checked against a source by an agent other than its writer (logs alongside, in `verified/` and `checked-batch2/`). This is what `build.py` uses. By category: History 128, Geography 135, TV & Radio 124, Film 135, Pop Music 124, Sport 134, Food & Drink 131, Books & Words 131, Science & Nature 135, Christmas & Miscellany 132.
- `questions/superseded-batch2-drafts/`: the batch-2 drafts before the strict source check. Kept for reference only; do not build from them.
- `questions/briefs/`: the writing brief (British, 40+ audience, original, four options, difficulty 1–3) and the checking briefs. `CHECK4_BRIEF.md` is the strict one used for batch 2: every risky question confirmed against a source, or dropped.
- To add more: write a batch with `QUESTION_BRIEF.md` (give the writer `questions/verified/<cat>.json` so it avoids duplicates), check it with `CHECK4_BRIEF.md` in waves of four categories (web searches are capped per session turn, about 45 per checker), then append to `verified/`.
- Item format: `{"c":"hist","d":2,"q":"…","a":["…","…","…","…"],"k":0}`; ids are derived from a hash of the question text, so asked-question memory survives rebuilds.
- Target: 2,000–3,000 by December so nobody can learn them.

## Tests

`tests/` holds Playwright (Python) scripts; Chromium is preinstalled in Claude's cloud sandbox. Run from the repo root after `python3 build.py`:
- `full.py [width] [length]`: plays a whole game at 6× with robots and toddler attacks, screenshots every phase.
- `multi.py`: host + three phone windows + toddler over BroadcastChannel (needs `python3 -m http.server 8765` in the repo root), including a phone reload that rejoins.
- `lan.py`: real WebRTC joining between separate browser processes (needs `python3 -m http.server 8766`), handing each reply code to the host as the camera would; includes a mid-game rejoin.
- `join.py`, `tut.py`: lobby join walkthrough and phone tutorial screenshots.

Headless Chromium reports `prefers-reduced-motion: reduce`, so CSS animations collapse in screenshots. The toddler's recharge ring is deliberately exempt.

## Known gaps

- Untested on Safari/iPadOS and real phones.
- No neighbour relay: everyone queues briefly at the iPad camera.
- AirPlay mirroring shows the host controls too (move them to a quizmaster phone later).
- No picture or music rounds.
