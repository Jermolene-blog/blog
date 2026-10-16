/*
CatActor: cut-out photographs of the cats, as sprites that can be dropped into
any page and animated.

  <script src="cat-actor.js"></script>

  const cat = new CatActor(element, { pose: 'sit', size: 200, x: 300, y: 500 });
  await cat.enter();                 // slide up from behind its own feet
  await cat.play('cheer');           // a named gesture
  cat.wear('crown');
  await cat.exit();

  const party = CatActor.party(element, { colors: ['#3a6fd8'] });   // the whole celebration
  party.stop();

The sprites are loaded from the `cat-sprites` folder next to this script, so the
script can be included from any page. `element` must be positioned, and usually
wants `overflow:hidden` so that cats can arrive from beyond its edges.

A cat is placed by its anchor, the spot on the ground beneath its body. The
anchor stays put when the pose changes, and is the pivot for `rot`, which turns
the cat so that its head points that many degrees clockwise from the top of the
screen. `size` is the height in CSS pixels of the seated cat; every pose is drawn
to the same scale, so a loafing cat comes out shorter and a begging one taller.

Everything that moves returns a promise that resolves to true when it finishes,
or false if `stop()` cut it short. With `prefers-reduced-motion` the cats still
appear and change pose, but hold still.
*/
(function () {
'use strict';

const BASE = new URL('cat-sprites/', (document.currentScript && document.currentScript.src) || location.href).href;
const UNIT = 560;   // sprite pixels in the height of the seated cat

// w, h: sprite size.  a: ground anchor.  top: crown of the head, where a hat sits (left out where one would not).
// head: width of the head as a fraction of the sprite's.  tilt: lean of the head, degrees clockwise.
// Positions are fractions of the sprite. Poses that share a photo session share a scale, so they can be cut between.
const POSES = {
  'sit':       { w: 503, h: 560, a: [0.62, 0.97], top: [0.72, 0.11], head: 0.37, tilt: 5 },
  'beg':       { w: 473, h: 683, a: [0.76, 0.97], top: [0.60, 0.085], head: 0.39, tilt: -8 },
  'look-up':   { w: 410, h: 582, a: [0.52, 0.97], top: [0.46, 0.05], head: 0.40, tilt: 4 },
  'look-away': { w: 403, h: 582, a: [0.55, 0.97], top: [0.51, 0.06], head: 0.52, tilt: 8 },
  'look-down': { w: 388, h: 560, a: [0.52, 0.97], top: [0.27, 0.10], head: 0.51, tilt: -15 },
  'upright':   { w: 338, h: 616, a: [0.52, 0.97], top: [0.66, 0.09], head: 0.56, tilt: 3 },
  'paw-up':    { w: 599, h: 594, a: [0.30, 0.95], top: [0.15, 0.07], head: 0.23, tilt: -12 },
  'paw-down':  { w: 494, h: 594, a: [0.32, 0.95], top: [0.30, 0.08], head: 0.33, tilt: 15 },
  'loaf':      { w: 484, h: 370, a: [0.34, 0.88], top: [0.38, 0.20], head: 0.34, tilt: -8 },
  'yawn':      { w: 484, h: 370, a: [0.34, 0.88], top: [0.44, 0.10], head: 0.32, tilt: 20 },
  'lounge':    { w: 663, h: 291, a: [0.50, 0.92], top: [0.12, 0.09], head: 0.19, tilt: 0 },
  'groom':     { w: 545, h: 448, a: [0.50, 0.95], top: [0.56, 0.08], head: 0.30, tilt: -3 },
  'roll':      { w: 651, h: 370, a: [1.00, 0.95] },   // cut off by the edge of the photo on its right: anchored there, to lie against a right-hand edge
  'pair':      { w: 856, h: 588, a: [0.50, 0.95] },   // two cats
  'stroll':    { w: 824, h: 532, a: [0.45, 0.95] },   // two cats
};

// Hats are drawn rather than photographed. Each is { svg(colour), aspect: height / width, scale: width relative to
// the head, sink: how far the brim sits below the crown of the head, as a fraction of the hat's height }
const HATS = {
  crown: {
    aspect: 0.7, scale: 0.86, sink: 0.2,
    svg: () => `<svg viewBox="0 0 100 70" width="100%" height="100%"><defs><linearGradient id="catCrownGold" x1="0" x2="0" y1="0" y2="1">
<stop offset="0" stop-color="#ffe78a"/><stop offset=".55" stop-color="#f2b92c"/><stop offset="1" stop-color="#c98a10"/></linearGradient></defs>
<path d="M9 64 L3 18 L27 38 L50 5 L73 38 L97 18 L91 64 Z" fill="url(#catCrownGold)" stroke="#8a5a07" stroke-width="3" stroke-linejoin="round"/>
<rect x="9" y="52" width="82" height="13" rx="3" fill="#e0a21c" stroke="#8a5a07" stroke-width="3"/>
<circle cx="50" cy="5" r="5" fill="#fff3c2" stroke="#8a5a07" stroke-width="2"/><circle cx="3" cy="18" r="4" fill="#fff3c2" stroke="#8a5a07" stroke-width="2"/><circle cx="97" cy="18" r="4" fill="#fff3c2" stroke="#8a5a07" stroke-width="2"/>
<circle cx="50" cy="58.5" r="4.5" fill="#d8314a"/><circle cx="28" cy="58.5" r="3.5" fill="#3a8fe0"/><circle cx="72" cy="58.5" r="3.5" fill="#3a8fe0"/></svg>`,
  },
  party: {
    aspect: 1.25, scale: 0.6, sink: 0.14,
    svg: color => `<svg viewBox="0 0 80 100" width="100%" height="100%">
<path d="M40 8 L73 90 Q40 102 7 90 Z" fill="${color}" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M30 33 L52 38 M24 50 L60 58 M17 68 L67 78" stroke="rgba(255,255,255,.75)" stroke-width="5" stroke-linecap="round"/>
<circle cx="40" cy="9" r="8" fill="#fff8ec" stroke="rgba(0,0,0,.35)" stroke-width="2"/></svg>`,
  },
};

const CSS = `
.cat-actor{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.cat-actor .cat-layer{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0}
.cat-actor img{position:absolute;max-width:none;display:block;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}
.cat-actor .cat-hat{position:absolute;transform-origin:50% 100%}
.cat-actor.cat-shadow .cat-flip{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}
.cat-party{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cat-party canvas{position:absolute;inset:0;width:100%;height:100%}
`;
let cssDone = false;
function injectCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
}
function layer(name, parent) {
  const d = document.createElement('div'); d.className = 'cat-layer ' + name; parent.appendChild(d); return d;
}
const reduceQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

class CatActor {
  // opts: pose, size, x, y, rot, flip, z, hidden, shadow (false to go without the drop shadow)
  constructor(parent, opts = {}) {
    injectCss();
    this.el = document.createElement('div'); this.el.className = 'cat-actor'; this.el.setAttribute('aria-hidden', 'true');
    this.slide = layer('cat-slide', this.el);      // arriving and leaving
    this.flipEl = layer('cat-flip', this.slide);   // mirroring, which takes the gestures with it
    this.body = layer('cat-body', this.flipEl);    // gestures, pivoting about the anchor
    this.imgs = {}; this.anims = new Set(); this.waits = new Set();
    this.x = 0; this.y = 0; this.rot = 0; this.size = 160; this.flip = false;
    this.poseName = null; this.hatEl = null; this.hat = null;
    if (opts.shadow !== false) this.el.classList.add('cat-shadow');
    if (opts.hidden) this.hide();
    this.place(opts); this.pose(opts.pose || 'sit');
    parent.appendChild(this.el);
  }

  /* --- where and how big --- */
  place(o = {}) {
    const resized = o.size !== undefined && o.size !== this.size;
    for (const k of ['x', 'y', 'rot', 'size', 'flip']) if (o[k] !== undefined) this[k] = o[k];
    if (o.z !== undefined) this.el.style.zIndex = o.z;
    this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rot}deg)`;
    this.flipEl.style.transform = this.flip ? 'scaleX(-1)' : '';
    if (resized && this.poseName) this.layout();
    return this;
  }
  get scale() { return this.size / UNIT; }
  get height() { return POSES[this.poseName].h * this.scale; }   // of the current pose, in CSS pixels
  get width() { return POSES[this.poseName].w * this.scale; }
  show() { this.el.style.visibility = ''; return this; }
  hide() { this.el.style.visibility = 'hidden'; return this; }
  get hidden() { return this.el.style.visibility === 'hidden'; }

  /* --- poses and hats --- */
  pose(name) {
    if (!POSES[name]) throw new Error('CatActor: no pose called ' + name);
    if (!this.imgs[name]) {
      const img = this.imgs[name] = new Image();
      img.alt = ''; img.draggable = false; img.src = BASE + name + '.webp';
      this.body.insertBefore(img, this.hatEl);
    }
    // every pose used so far stays in the document, so cutting between them never waits on a decode
    for (const n in this.imgs) this.imgs[n].style.visibility = n === name ? '' : 'hidden';
    this.poseName = name; this.layout();
    return this;
  }
  // kind: 'crown' or 'party' (which takes a colour); null to take it off
  wear(kind, { color = '#d8314a' } = {}) {
    if (!kind) { if (this.hatEl) this.hatEl.remove(); this.hatEl = this.hat = null; return this; }
    if (!this.hatEl) { this.hatEl = document.createElement('div'); this.hatEl.className = 'cat-hat'; this.body.appendChild(this.hatEl); }
    this.hat = HATS[kind]; this.hatEl.innerHTML = this.hat.svg(color); this.layout();
    return this;
  }
  layout() {
    const k = this.scale, p = POSES[this.poseName];
    for (const n in this.imgs) {
      const q = POSES[n], s = this.imgs[n].style;
      s.width = q.w * k + 'px'; s.height = q.h * k + 'px'; s.left = -q.a[0] * q.w * k + 'px'; s.top = -q.a[1] * q.h * k + 'px';
    }
    if (!this.hatEl) return;
    const s = this.hatEl.style;
    if (!p.top) { s.display = 'none'; return; }
    const hw = p.head * p.w * k * this.hat.scale, hh = hw * this.hat.aspect;
    s.display = ''; s.width = hw + 'px'; s.height = hh + 'px';
    s.left = (p.top[0] - p.a[0]) * p.w * k - hw / 2 + 'px'; s.top = (p.top[1] - p.a[1]) * p.h * k - hh * (1 - this.hat.sink) + 'px';
    s.transform = `rotate(${p.tilt}deg)`;
  }

  /* --- timing --- */
  // Web Animations on one of the layers; resolves true when done, false if stopped
  run(el, keyframes, opts) {
    const endless = opts.iterations === Infinity;
    if (CatActor.reducedMotion) return endless ? this.wait(Infinity) : this.wait(Math.min(opts.duration || 0, 160));
    return new Promise(resolve => {
      const a = el.animate(keyframes, opts);
      this.anims.add(a);
      a.onfinish = () => { this.anims.delete(a); resolve(true); };
      a.oncancel = () => { this.anims.delete(a); resolve(false); };
    });
  }
  // a gesture of the body about the anchor
  animate(keyframes, opts) { return this.run(this.body, keyframes, opts); }
  wait(ms) {
    return new Promise(resolve => {
      const w = { resolve, id: ms === Infinity ? null : setTimeout(() => { this.waits.delete(w); resolve(true); }, ms) };
      this.waits.add(w);
    });
  }
  // cut short whatever is in flight; the cat stays where it is, back in its resting shape
  stop() {
    for (const a of [...this.anims]) a.cancel();
    for (const w of [...this.waits]) { clearTimeout(w.id); w.resolve(false); }
    this.waits.clear();
    this.slide.style.transform = this.slide.style.opacity = '';
    return this;
  }
  remove() { this.stop(); this.el.remove(); }

  /* --- arriving and leaving --- */
  // from: 'below' (rising from behind its own feet), 'above', 'left', 'right', 'pop' or 'fade'
  enter({ from = 'below', duration = 380, distance, easing = 'cubic-bezier(.3,1.5,.5,1)' } = {}) {
    this.slide.style.transform = this.slide.style.opacity = '';
    this.show();
    return this.run(this.slide, [this.away(from, distance), { transform: 'translate(0px,0px) scale(1)', opacity: 1 }], { duration, easing });
  }
  async exit({ to = 'below', duration = 300, distance, easing = 'cubic-bezier(.5,0,.9,.5)' } = {}) {
    // the slide layer is parked at the far end first, so the cat is already out of sight when the animation lets go of it
    const away = this.away(to, distance);
    Object.assign(this.slide.style, away);
    const ok = await this.run(this.slide, [{ transform: 'translate(0px,0px) scale(1)', opacity: 1 }, away], { duration, easing });
    if (ok) { this.hide(); this.slide.style.transform = this.slide.style.opacity = ''; }
    return ok;
  }
  away(dir, distance) {
    const d = distance === undefined ? this.height * 1.08 : distance;
    if (dir === 'pop') return { transform: 'translate(0px,0px) scale(0)', opacity: 1 };
    if (dir === 'fade') return { transform: 'translate(0px,0px) scale(1)', opacity: 0 };
    const [dx, dy] = { below: [0, d], above: [0, -d], left: [-d, 0], right: [d, 0] }[dir];
    return { transform: `translate(${dx}px,${dy}px) scale(1)`, opacity: 1 };
  }

  /* --- gestures --- */
  play(name, opts) {
    if (!GESTURES[name]) throw new Error('CatActor: no gesture called ' + name);
    return GESTURES[name](this, opts || {});
  }
  // cut through poses: [['loaf', 250], ['yawn', 800], ...] holds each for that many milliseconds
  async frames(seq) {
    for (const [name, ms] of seq) { this.pose(name); if (!await this.wait(ms)) return false; }
    return true;
  }

  static get reducedMotion() { return reduceQuery.matches; }
  // add a gesture: fn(cat, opts) returns a promise, built from cat.animate(), cat.pose() and cat.wait()
  static define(name, fn) { GESTURES[name] = fn; }
  // the names of all the gestures that play() knows
  static get gestures() { return Object.keys(GESTURES); }
  // fetch and decode sprites ahead of time (all of them by default)
  static preload(names = Object.keys(POSES)) {
    return Promise.all(names.map(n => { const i = new Image(); i.src = BASE + n + '.webp'; return i.decode ? i.decode().catch(() => {}) : null; }));
  }
  static party(container, opts) { return new CatParty(container, opts); }
}
CatActor.POSES = POSES;
CatActor.HATS = HATS;

// translate, lean and squash about the anchor, always as the same list of functions so that keyframes interpolate cleanly
const T = (y = 0, rot = 0, sx = 1, sy = 1, x = 0) => `translate(${x}px,${y}px) rotate(${rot}deg) scale(${sx},${sy})`;

const GESTURES = {
  // a squash-and-stretch jump on the spot. height is in cat sizes
  hop(cat, { height = 0.22, duration = 420, lean = 0 }) {
    const H = -height * cat.size;
    return cat.animate([
      { transform: T() },
      { transform: T(0, 0, 1.06, 0.9), offset: 0.18, easing: 'ease-out' },
      { transform: T(H, lean, 0.96, 1.06), offset: 0.55, easing: 'ease-in' },
      { transform: T(0, 0, 1.07, 0.9), offset: 0.86 },
      { transform: T() }], { duration });
  },
  // several hops in a row, leaning one way then the other
  cheer(cat, { hops = 3, height = 0.2, duration = 360 * hops, lean = 7 }) {
    const H = -height * cat.size, kf = [{ transform: T() }];
    for (let i = 0; i < hops; i++) {
      const o = i / hops, w = 1 / hops, dir = i % 2 ? -1 : 1;
      kf.push({ transform: T(0, 0, 1.06, 0.9), offset: o + w * 0.16, easing: 'ease-out' });
      kf.push({ transform: T(H, lean * dir, 0.96, 1.06), offset: o + w * 0.55, easing: 'ease-in' });
      kf.push({ transform: T(0, 0, 1.07, 0.9), offset: o + w * 0.9 });
    }
    kf.push({ transform: T() });
    return cat.animate(kf, { duration });
  },
  // a leap with a full somersault about the middle of the body
  flip(cat, { height = 0.6, duration = 760, turns = 1 }) {
    const c = cat.height * 0.5, H = height * cat.size, A = 360 * turns;
    const f = (y, a, sx = 1, sy = 1) => `translateY(${-y - c}px) rotate(${a}deg) translateY(${c}px) scale(${sx},${sy})`;
    return cat.animate([
      { transform: f(0, 0) },
      { transform: f(0, 0, 1.08, 0.86), offset: 0.14, easing: 'ease-out' },
      { transform: f(H, A * 0.5, 0.95, 1.05), offset: 0.55, easing: 'ease-in' },
      { transform: f(0, A, 1.08, 0.88), offset: 0.88 },
      { transform: f(0, A) }], { duration });
  },
  // rocking from side to side about the feet
  wiggle(cat, { deg = 7, times = 3, duration = 220 * times }) {
    const kf = [{ transform: T() }];
    for (let i = 0; i < times; i++) { kf.push({ transform: T(0, deg) }); kf.push({ transform: T(0, -deg) }); }
    kf.push({ transform: T() });
    return cat.animate(kf, { duration, easing: 'ease-in-out' });
  },
  // a disapproving shimmy
  shake(cat, { amount = 0.05, times = 3, duration = 240 * times }) {
    const d = amount * cat.size, kf = [{ transform: T() }];
    for (let i = 0; i < times; i++) { kf.push({ transform: T(0, -3, 1, 1, -d) }); kf.push({ transform: T(0, 3, 1, 1, d) }); }
    kf.push({ transform: T() });
    return cat.animate(kf, { duration, easing: 'ease-in-out' });
  },
  // a slow, curious lean
  tilt(cat, { deg = 9, duration = 900 }) {
    return cat.animate([{ transform: T() }, { transform: T(0, deg), offset: 0.35 }, { transform: T(0, deg), offset: 0.7 }, { transform: T() }], { duration, easing: 'ease-in-out' });
  },
  // gentle breathing, for a cat with nothing better to do. Runs until stop()
  bob(cat, { duration = 1700 }) {
    return cat.animate([{ transform: T() }, { transform: T(0, 0, 1.012, 1.03) }], { duration, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  },
  // hop without end. Runs until stop()
  bounce(cat, { height = 0.14, duration = 520 }) {
    const H = -height * cat.size;
    return cat.animate([
      { transform: T(0, 0, 1.05, 0.93), easing: 'ease-out' },
      { transform: T(H, 0, 0.97, 1.04), offset: 0.5, easing: 'ease-in' },
      { transform: T(0, 0, 1.05, 0.93) }], { duration, iterations: Infinity });
  },
  // loaf, enormous yawn, loaf
  async yawn(cat, { hold = 850 }) {
    cat.pose('loaf'); if (!await cat.wait(260)) return false;
    cat.pose('yawn');
    cat.animate([{ transform: T() }, { transform: T(0, 0, 1.03, 1.07), offset: 0.3 }, { transform: T(0, 0, 1.03, 1.07), offset: 0.8 }, { transform: T() }], { duration: hold });
    if (!await cat.wait(hold)) return false;
    cat.pose('loaf'); return cat.wait(220);
  },
  // rear back with a paw raised, then bat at whatever is to the cat's left (its right, if flipped). onStrike fires as the paw lands
  async swipe(cat, { windup = 320, hold = 420, onStrike }) {
    const d = -0.09 * cat.size;
    cat.pose('paw-up');
    if (!await cat.animate([{ transform: T() }, { transform: T(0, 5) }], { duration: windup, easing: 'ease-out' })) return false;
    cat.pose('paw-down'); if (onStrike) onStrike();
    return cat.animate([{ transform: T(0, 5) }, { transform: T(0, -5, 1, 1, d), offset: 0.2, easing: 'ease-out' }, { transform: T() }], { duration: hold });
  },
};

/*
CatParty: a celebration that fills its container. Fireworks of confetti and paw
prints burst outwards, cats are flung spinning from the origin, and a crowd of
cats in party hats pops up round the edges in a wave and keeps bouncing until
stop(). Everything radiates from a point rather than falling, so it reads the
same from every side of a screen lying flat on a table.

opts: colors, origin {x, y} (default the centre), crowd and fountain (how many
cats), duration (ms of fireworks), size (of the crowd cats), z, and
onEvent(name), called with 'burst', 'fling' and 'pop' as each happens, for
sound.
*/
class CatParty {
  constructor(container, opts = {}) {
    injectCss();
    this.o = Object.assign({ colors: ['#f2c14e', '#d8314a', '#3a8fe0', '#2fa274'], crowd: 12, fountain: 10, duration: 9000, z: 10, onEvent: () => {} }, opts);
    this.container = container;
    this.el = document.createElement('div'); this.el.className = 'cat-party'; this.el.style.zIndex = this.o.z; this.el.setAttribute('aria-hidden', 'true');
    this.canvas = document.createElement('canvas');
    this.catLayer = document.createElement('div'); this.catLayer.style.cssText = 'position:absolute;inset:0';
    this.el.appendChild(this.catLayer); this.el.appendChild(this.canvas);
    container.appendChild(this.el);
    this.g = this.canvas.getContext('2d');
    this.bits = []; this.cats = new Set(); this.crowd = []; this.timers = []; this.live = true;
    this.onResize = () => { this.measure(); this.seatCrowd(); };
    addEventListener('resize', this.onResize);
    this.measure();
    this.start();
  }
  measure() {
    const w = this.el.clientWidth, h = this.el.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr; this.m = Math.min(w, h);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.ox = this.o.origin ? this.o.origin.x : w / 2; this.oy = this.o.origin ? this.o.origin.y : h / 2;
    this.catSize = this.o.size || Math.max(80, Math.min(170, this.m * 0.18));
  }
  later(ms, fn) { this.timers.push(setTimeout(() => { if (this.live) fn(); }, ms)); }
  start() {
    const o = this.o, still = CatActor.reducedMotion;
    this.t0 = performance.now(); this.last = this.t0;
    this.gatherCrowd();
    if (still) return;
    this.burst(this.ox, this.oy, 170, 1);
    for (let t = 450; t < o.duration; t += rand(330, 620)) this.later(t, () => this.burst(rand(0.12, 0.88) * this.w, rand(0.12, 0.88) * this.h, 60, 0.55));
    for (let i = 0; i < o.fountain; i++) this.later(250 + i * 170 + rand(0, 80), () => this.fling());
    const tick = now => {
      if (!this.live) return;
      this.step(Math.min(0.05, (now - this.last) / 1000)); this.last = now;
      if (now - this.t0 < o.duration + 400 || this.bits.length) this.raf = requestAnimationFrame(tick);
      else this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };
    this.raf = requestAnimationFrame(tick);
  }
  // clear everything away
  stop() {
    this.live = false;
    removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.raf); this.timers.forEach(clearTimeout);
    for (const c of this.cats) c.remove();
    this.cats.clear(); this.crowd.length = 0;
    this.el.remove();
  }

  /* --- fireworks --- */
  burst(x, y, n, power) {
    const cols = this.o.colors, speed = this.m * 0.95 * power, main = pick(cols);
    this.o.onEvent('burst');
    for (let i = 0; i < n && this.bits.length < 900; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.25 + Math.random() * 0.85), kind = Math.random() < 0.16 ? 'paw' : 'bit';
      this.bits.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, 6.3), vr: rand(-7, 7), ph: rand(0, 6.3), vph: rand(5, 13),
        w: kind === 'paw' ? rand(10, 16) : rand(6, 11), h: rand(9, 17), color: Math.random() < 0.6 ? main : pick(cols), t: 0, ttl: rand(2.2, 4.2), drag: rand(1.4, 2.1) });
    }
    for (let i = 0; i < n * 0.5 && this.bits.length < 900; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * 1.5 * (0.5 + Math.random() * 0.6);
      this.bits.push({ kind: 'spark', x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: Math.random() < 0.5 ? '#fff6d0' : main, t: 0, ttl: rand(0.5, 1.1), drag: 3.2 });
    }
  }
  step(dt) {
    const g = this.g, bits = this.bits;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    let n = 0;
    for (const b of bits) {
      b.t += dt; if (b.t >= b.ttl) continue;
      bits[n++] = b;
      const f = Math.exp(-b.drag * dt);
      b.vx *= f; b.vy *= f;
      const fade = Math.min(1, (b.ttl - b.t) / (b.ttl * 0.3));
      if (b.kind === 'spark') {
        b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = fade; g.strokeStyle = b.color; g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(b.px - b.vx * 0.03, b.py - b.vy * 0.03); g.lineTo(b.x, b.y); g.stroke();
        continue;
      }
      // confetti flutters: it turns over as it drifts, and wanders a little once it has slowed
      b.ph += b.vph * dt; b.rot += b.vr * dt;
      b.x += (b.vx + Math.cos(b.ph * 0.7) * 14) * dt; b.y += (b.vy + Math.sin(b.ph * 0.6) * 14) * dt;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = fade; g.fillStyle = b.color;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
      if (b.kind === 'paw') {
        const s = b.w / 10;
        g.scale(s, s);
        g.beginPath(); g.ellipse(0, 2.5, 4.6, 3.8, 0, 0, Math.PI * 2); g.fill();
        for (const [tx, ty] of [[-5.6, -2.2], [-2.1, -5.4], [2.1, -5.4], [5.6, -2.2]]) { g.beginPath(); g.ellipse(tx, ty, 1.9, 2.4, 0, 0, Math.PI * 2); g.fill(); }
      } else {
        g.scale(1, Math.cos(b.ph));
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
      g.restore();
    }
    bits.length = n;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  /* --- cats flung from the origin --- */
  fling() {
    const pose = pick(['loaf', 'sit', 'beg', 'lounge', 'groom', 'upright', 'look-up', 'yawn', 'paw-up']);
    const cat = new CatActor(this.catLayer, { pose, size: this.catSize * rand(0.75, 1.15), x: this.ox, y: this.oy, shadow: false, flip: Math.random() < 0.5 });
    this.cats.add(cat); this.o.onEvent('fling');
    const a = Math.random() * Math.PI * 2, reach = Math.hypot(this.w, this.h) * 0.62 + cat.size, c = cat.height * 0.5;
    const duration = rand(1500, 2300), spin = pick([-1, 1]) * rand(360, 900);
    // the body tumbles about its middle while the whole cat sails outwards, growing as if thrown up towards the viewer
    cat.animate([{ transform: `translateY(${-c}px) rotate(0deg) translateY(${c}px)` }, { transform: `translateY(${-c}px) rotate(${spin}deg) translateY(${c}px)` }], { duration });
    cat.run(cat.slide, [
      { transform: 'translate(0px,0px) scale(0.05)', opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: `translate(${Math.cos(a) * reach}px,${Math.sin(a) * reach}px) scale(1.5)`, opacity: 1 }], { duration, easing: 'cubic-bezier(.25,.6,.45,1)' })
      .then(() => { cat.remove(); this.cats.delete(cat); });
  }

  /* --- the crowd round the edges --- */
  // places round the perimeter, clockwise from the bottom left, keeping out of the corners
  seats() {
    const { w, h } = this, s = this.catSize, gap = s * 1.15, inset = Math.min(w, h) * 0.27, out = [];
    const edge = (len, at) => {
      const n = Math.max(1, Math.round((len - 2 * inset) / gap));
      for (let i = 0; i < n; i++) out.push(at(inset + (len - 2 * inset) * (i + 0.5) / n));
    };
    edge(w, d => ({ x: d, y: h, rot: 0 }));
    edge(h, d => ({ x: w, y: h - d, rot: -90 }));
    edge(w, d => ({ x: w - d, y: 0, rot: 180 }));
    edge(h, d => ({ x: 0, y: d, rot: 90 }));
    const n = this.o.crowd;
    return out.length > n ? Array.from({ length: n }, (_, i) => out[Math.floor(i * out.length / n)]) : out;
  }
  gatherCrowd() {
    const poses = ['sit', 'beg', 'look-up', 'look-away', 'upright', 'paw-up', 'look-down', 'beg', 'sit'];
    this.seats().forEach((seat, i) => {
      const cat = new CatActor(this.catLayer, { pose: poses[i % poses.length], size: this.catSize * rand(0.9, 1.1), hidden: true, shadow: false, flip: Math.random() < 0.5 });
      cat.wear('party', { color: this.o.colors[i % this.o.colors.length] });
      this.cats.add(cat); this.crowd.push(cat);
      this.later(500 + i * 130, async () => {
        this.o.onEvent('pop');
        if (!await cat.enter({ duration: 420 })) return;
        while (this.live && !CatActor.reducedMotion) {
          if (!await cat.play(pick(['hop', 'cheer', 'wiggle', 'hop', 'cheer']), { height: rand(0.14, 0.3) })) return;
          if (!await cat.wait(rand(150, 900))) return;
        }
      });
    });
    this.seatCrowd();
  }
  seatCrowd() {
    const seats = this.seats();
    // feet a little beyond the edge, so the cats look as though they are leaning in over it
    this.crowd.forEach((cat, i) => {
      const s = seats[i % seats.length], r = s.rot * Math.PI / 180, d = cat.size * 0.16;
      cat.place({ x: s.x - Math.sin(r) * d, y: s.y + Math.cos(r) * d, rot: s.rot });
    });
  }
}
CatActor.Party = CatParty;

window.CatActor = CatActor;
})();
