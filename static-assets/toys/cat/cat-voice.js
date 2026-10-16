/*
CatVoice: the cats' voices, synthesised with Web Audio.

  <script src="cat-voice.js"></script>

  CatVoice.meow(ctx, out);                      // out: any AudioNode, such as a page's master gain
  CatVoice.voice(ctx, out, [420, 760, 520], 0.65, 0.35, ctx.currentTime + 0.2);
  CatVoice.purr(ctx, out, 4);

A voice is a sawtooth swept through [start, peak, end] Hz, shaped by a formant
that opens and closes with it. Everything is scheduled on `ctx` and connected
to `out`, so the page keeps its own mixing, panning and muting.
*/
(function () {
'use strict';

function voice(ctx, out, pitch, dur, vol = 0.35, t0 = ctx.currentTime) {
  const n = t0, o = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch[0], n); o.frequency.linearRampToValueAtTime(pitch[1], n + dur * 0.3); o.frequency.linearRampToValueAtTime(pitch[2], n + dur);
  f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(700, n); f1.frequency.linearRampToValueAtTime(1300, n + dur * 0.33); f1.frequency.linearRampToValueAtTime(800, n + dur);
  f2.type = 'lowpass'; f2.frequency.value = 3000;
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + Math.min(0.05, dur * 0.25)); g.gain.setValueAtTime(vol, n + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
  o.connect(f1).connect(f2).connect(g).connect(out); o.start(n); o.stop(n + dur + 0.05);
}

// a purr breathing in and out every 1.3 seconds for `dur` seconds
function purr(ctx, out, dur, t0 = ctx.currentTime) {
  const n = t0, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 27; f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, n);
  for (let t = 0; t < dur; t += 1.3) { g.gain.exponentialRampToValueAtTime(0.5, n + t + 0.5); g.gain.exponentialRampToValueAtTime(0.22, n + Math.min(dur, t + 1.3)); }
  g.gain.exponentialRampToValueAtTime(0.0001, n + dur + 0.4);
  o.connect(f).connect(g).connect(out); o.start(n); o.stop(n + dur + 0.5);
  return { stop(at = ctx.currentTime) { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0.0001, at, 0.15); try { o.stop(at + 0.6); } catch (e) {} } };
}

window.CatVoice = {
  voice,
  purr,
  meow: (ctx, out, k = 1) => voice(ctx, out, [420 * k, 760 * k, 520 * k], 0.65),
  chirp: (ctx, out, k = 1) => voice(ctx, out, [520 * k, 1050 * k, 940 * k], 0.2, 0.3),
  yawn: (ctx, out) => voice(ctx, out, [760, 700, 300], 0.85, 0.2),
};
})();
