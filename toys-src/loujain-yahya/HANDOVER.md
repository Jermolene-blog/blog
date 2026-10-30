# Loujain & Yahya: handover

**2026-10-24: integrated into jermolene.com.** The game is now `static-assets/toys/loujain-yahya/index.html`: the fragment wrapped in the usual toy skeleton, with PWA links, a description, `toy-category` games and theme colour `#8fd6f5`, plus `icon.svg` and rendered icons. Edit that file directly. The PWA/offline wrapper suggested below is therefore done.

`loujain-yahya.html` is a single-file collection of 2D tap-only games for toddlers. It belongs to Jeremy's series of toddler single-page apps; Animal Island and Trundle World are siblings, but those two are 3D. It has no build step and no dependencies apart from the Google Fonts stylesheet for Baloo 2, which falls back to rounded system fonts. Open the file in a browser to run it.

## Brief and art direction

- The visual style is borrowed from the *look* of Hey Duggee (Studio AKA). That means flat, outline-free vector shapes, saturated plain backgrounds (sky blue, sunny yellow, pink), a green ground band with short darker-green dashes for grass, puffy white clouds, and a big flat sun. Characters are built from simple round shapes, with black dot eyes and a white glint, big open happy mouths with pink tongues, and pink cheek blushes.
- **Do not copy the show's characters, its badges, the woggle/scarf, or its multicoloured logo lettering.** Every character here is original.
- The main characters are two grey cats, **Loujain** and **Yahya**. Both have **the same grey fur** (`#a3aab7`, shade `#7a8190`, belly `#eef0f4`), plus forehead stripes and a collar with a yellow tag. The only thing that tells them apart is the collar colour: **Loujain is pink `#ff5d73` and Yahya is teal `#17b3a3`**. Jeremy explicitly asked for them to be the same colour, so keep it that way.
- Six friends also appear: duck, frog, rabbit, owl, mouse and snail.
- The audience is toddlers. Everything is tap-only, with no dragging, no reading needed, no fail states and no timers that punish. Wrong answers get a gentle response.

## Architecture (all in one `<script>`)

- **Stage**: a single `<svg id="stage" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">` with `overflow:visible`. Gameplay stays inside 1000×700. The background rects extend to ±3000 so that letterboxing on any aspect ratio still shows sky and grass.
- **Characters**: the `ART` object holds an SVG string per character, drawn in local coordinates with the feet at y=0. They are roughly 200–250 units tall and ±90 wide; the cats are about 215 tall. `cat(opts)` builds both cats. `CAST` maps each id to `{name, say, cat}`, where `say` is the spoken form, for example "a duck" or "an owl".
- **Wrapping**: `inner(id)` wraps the art as `.hopper > .idle > art`. `.idle` provides a gentle squash-breathe and `.eye` groups blink; a per-instance `--bd` gives each one a random delay. `.hopper` is where one-shot animations go (`hop`, `bigjump`, `munch`, `shake`), retriggered with `retrigger(el, cls)`. `critter(id, x, y, s, attrs)` places a character using a `transform` *attribute*. Rule: position with attributes and animate the inner groups with CSS, so that the CSS transforms never override the positioning.
- **Engine**: one `requestAnimationFrame` loop drives `loopFn(dt)`, which is per-screen, plus `tweens`. `later()` wraps setTimeout so timers get cleared. `screen(name, html, handlers)` resets all of those, swaps the stage contents, and sets the tap handlers.
- **Input**: one `pointerdown` listener on the stage is delegated to whichever element has the nearest `[data-act]`, and is dispatched to `handlers[act]`. `poke` is global: it makes a character hop, plays its sound and speaks its name.
- **Audio**: WebAudio synth effects are in `sfx`: pop, boing, boop, whoosh, munch, cheer, and a meow made from a sawtooth through a sweeping bandpass. Voice uses `speechSynthesis` with an en-GB voice where one exists, at pitch 1.25. Audio and speech are unlocked on the first tap, which iOS requires. Mute is stored in `localStorage` under the key `ps-muted`.
- **Effects**: `burst(x, y)` makes star confetti, `.ring` is the bubble-pop ring, and `.numpop` shows the counting numerals.
- `prefers-reduced-motion` turns off the idle, blink and cloud-drift animations.

## The four games

1. **Hide & Seek** (`hideSeek`): five hiding spots (bush, hedge, pot, crate, bucket from `SPOT`) with both cats and three random friends behind them. Each hider is clipped at ground level and rises with an overshoot transition when tapped. Once both cats are found there is a celebration, then everyone hides again in a new arrangement.
2. **Bubbles** (`bubbles`): up to 7 rising, swaying bubbles, each holding a random character. Tapping one pops it and the character falls with gravity, bounces, says its name and then fades out.
3. **Who's That?** (`whosThat`): an easel shows a silhouette made with the SVG filter `#sil`, and three choices stand below it. The right answer fades in the coloured version, gives a cheer, and moves to the next round. A wrong answer shakes and names that animal.
4. **Fish Supper** (`fishSupper`): a kitchen scene where tapping a cat, its bowl, or the basket throws a fish in an arc. The fish are counted aloud from one to five, with dots and numerals. At five the cat celebrates and the bowl empties. A random friend wanders across the back of the room every 7–11 seconds and can be tapped.

The home screen has four big tiles, and the cats and friends standing on the grass can be tapped.

## Known gaps / ideas

- **Speech has not been tested on a real iPad.** The en-GB voice may mispronounce "Loujain"; if so, give `CAST.loujain.say` (and the hard-coded sentences) a phonetic spelling while leaving `name` as it is.
- The original artifact was published as "Pebble & Smudge" and then renamed in place. The internal ids in this copy are already `loujain` and `yahya`.
- Possible additions: more games (for example rain clouds that grow flowers, a dress-up with hats, or a simple music game where tapping animals plays notes), a parental lock on the home button, and a PWA/offline wrapper for iPad.
- Wherever this one-file app is deployed, it needs no server code.
