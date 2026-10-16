/*
CatPuppet: jointed puppets of a cat, each made from a single photograph.

  <script src="cat-puppet.js"></script>

  const cat = new CatPuppet(element, { size: 200, x: 300, y: 500 });
  cat.play('walk');                      // on the spot; cat.velocity says how fast the floor should pass
  await cat.walkTo(600, 500);            // or let it carry itself there
  await cat.play('pounce');
  cat.tweak.head = 20;                   // any joint can be turned by hand on top of whatever is playing

There are three puppets, chosen with the `rig` option:

  walker   a cat standing side-on, facing left, that walks, trots, bats and pounces
  upright  a cat sitting up on its haunches with both front legs free, to clap, cheer, wave and despair
  arm      a single front leg that stretches as far as it is asked to, to reach, pat, swat and flick

The photograph is draped over a mesh for each part of the cat, and every mesh is
skinned to a skeleton, so joints bend rather than hinge. Parts overlap generously
and fade out where they are cut from their neighbours, so that fur blends into
fur. The walker's legs are placed by where their feet should be, and the knees
and elbows worked out from that, which keeps feet planted while the body moves.

A puppet is placed like a CatActor: by an anchor (on the floor beneath the body,
or at the shoulder of the arm), with `rot` turning it about that point, `flip`
mirroring it, and `size` the height of a seated cat, so that a puppet and a
CatActor of the same size are the same cat. `element` must be positioned.

The photographs are loaded from the `cat-puppet` folder next to this script.
Each is wrapped up as a script, because WebGL will not take an image file from a
page that has been opened straight from the disk. With `prefers-reduced-motion`
the walker and the upright cat hold still.
*/
(function () {
'use strict';

const BASE = new URL('cat-puppet/', (document.currentScript && document.currentScript.src) || location.href).href;

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const reduceQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

/* The rigs, each in pixels of its photograph.
   unit: photograph pixels in the height of a seated cat.  origin: the anchor.  view: the canvas, relative to the
     anchor, with room for everything the puppet can do.
   bones: each turns about `at`, carrying its children with it.
   legs: the three bones from shoulder or hip down (upper arm, forearm and paw; or thigh, shank and foot), where the
     wrist or hock rests when standing, and which way the middle joint folds (1: towards the tail, as an elbow does;
     -1: towards the head, as a knee does). The upper bones lie hidden in the fur of the body.
   parts: drawn in order. Each is the photograph within `poly`, fading out over `feather` pixels inside its edge;
     polygons are drawn well outside the cat's outline, so only the cuts through fur fade. Its mesh follows the bones
     of `chain`, from the bone it hangs from down to `tip`, blending from one to the next over `blend` pixels.
   calm: the animation that stands in for all the others when motion is to be reduced. */
const RIGS = {
  // the cat faces left, with its near (left) legs towards the camera
  walker: {
    image: 'walker', width: 1200, height: 763, unit: 800, origin: [520, 697], view: [-700, -860, 760, 60], calm: 'stand',
    bones: {
      hips: { at: [770, 385] },
      chest: { parent: 'hips', at: [540, 370] },
      head: { parent: 'chest', at: [215, 240] },
      tail1: { parent: 'hips', at: [872, 432] },
      tail2: { parent: 'tail1', at: [935, 497] },
      tail3: { parent: 'tail2', at: [1000, 522] },
      tail4: { parent: 'tail3', at: [1068, 538] },
      foreL1: { parent: 'chest', at: [268, 430] }, foreL2: { parent: 'foreL1', at: [258, 540] }, foreL3: { parent: 'foreL2', at: [200, 655] },
      foreR1: { parent: 'chest', at: [350, 440] }, foreR2: { parent: 'foreR1', at: [358, 535] }, foreR3: { parent: 'foreR2', at: [372, 645] },
      hindL1: { parent: 'hips', at: [738, 428] }, hindL2: { parent: 'hindL1', at: [615, 545] }, hindL3: { parent: 'hindL2', at: [640, 630] },
      hindR1: { parent: 'hips', at: [822, 425] }, hindR2: { parent: 'hindR1', at: [803, 518] }, hindR3: { parent: 'hindR2', at: [836, 608] },
    },
    legs: {
      foreL: { bones: ['foreL1', 'foreL2', 'foreL3'], stand: [275, 655], fold: 1 },
      foreR: { bones: ['foreR1', 'foreR2', 'foreR3'], stand: [352, 645], fold: 1 },
      hindL: { bones: ['hindL1', 'hindL2', 'hindL3'], stand: [722, 630], fold: -1 },
      hindR: { bones: ['hindR1', 'hindR2', 'hindR3'], stand: [830, 608], fold: -1 },
    },
    parts: [
      { name: 'hindR', tint: 0.8, feather: 8, step: 11, blend: 30, chain: ['hips', 'hindR1', 'hindR2', 'hindR3'], tip: [800, 683],
        poly: [[775, 440], [862, 440], [866, 560], [876, 610], [872, 705], [768, 705], [772, 610], [780, 540]] },
      { name: 'foreR', tint: 0.8, feather: 8, step: 11, blend: 30, chain: ['chest', 'foreR1', 'foreR2', 'foreR3'], tip: [348, 683],
        poly: [[300, 430], [420, 430], [418, 640], [415, 700], [318, 700], [322, 640], [300, 560]] },
      { name: 'torso', feather: 14, step: 16, blend: 130, chain: ['hips', 'chest'], tip: [300, 350],
        poly: [[45, 225], [80, 185], [130, 160], [190, 150], [240, 152], [275, 170], [300, 190], [350, 170], [450, 165], [600, 172], [705, 200],
          [810, 240], [865, 280], [905, 365], [892, 440], [865, 500], [850, 522], [800, 512], [760, 535], [705, 562], [640, 548], [575, 530],
          [520, 512], [450, 498], [405, 512], [400, 524], [320, 526], [300, 528], [240, 512], [200, 462], [130, 360], [80, 300]] },
      { name: 'tail', feather: 14, step: 13, blend: 34, chain: ['hips', 'tail1', 'tail2', 'tail3', 'tail4'], tip: [1140, 558],
        poly: [[850, 360], [905, 345], [965, 415], [1010, 432], [1060, 437], [1115, 450], [1170, 515], [1172, 615], [1070, 635], [945, 615],
          [905, 580], [858, 550], [835, 480]] },
      { name: 'hindL', feather: 14, step: 11, blend: 32, chain: ['hips', 'hindL1', 'hindL2', 'hindL3'], tip: [575, 682],
        poly: [[585, 462], [690, 492], [742, 545], [700, 600], [672, 640], [665, 705], [525, 705], [525, 645], [540, 600], [552, 540], [565, 498]] },
      { name: 'foreL', feather: 8, step: 11, blend: 32, chain: ['chest', 'foreL1', 'foreL2', 'foreL3'], tip: [160, 705],
        poly: [[210, 395], [322, 395], [320, 500], [316, 560], [300, 600], [280, 650], [262, 700], [240, 735], [125, 735], [118, 665], [160, 600],
          [182, 540], [190, 470]] },
      { name: 'head', feather: 14, step: 13, blend: 42, chain: ['chest', 'head'], tip: [150, 100],
        poly: [[20, 20], [275, 20], [285, 150], [268, 215], [235, 270], [170, 310], [105, 315], [55, 270], [25, 200]] },
    ],
  },
  // sitting up on its haunches in profile, facing left, with both front legs held out
  upright: {
    image: 'upright', width: 1010, height: 969, unit: 740, origin: [520, 930], view: [-580, -1060, 520, 45], calm: 'idle',
    bones: {
      hips: { at: [540, 780] },
      chest: { parent: 'hips', at: [480, 520] },
      head: { parent: 'chest', at: [420, 275] },
      armU1: { parent: 'chest', at: [320, 365] }, armU2: { parent: 'armU1', at: [205, 348] }, armU3: { parent: 'armU2', at: [110, 335] },
      armL1: { parent: 'chest', at: [335, 485] }, armL2: { parent: 'armL1', at: [215, 460] }, armL3: { parent: 'armL2', at: [115, 440] },
      tail1: { parent: 'hips', at: [720, 735] },
      tail2: { parent: 'tail1', at: [820, 745] },
      tail3: { parent: 'tail2', at: [920, 755] },
    },
    parts: [
      { name: 'tail', feather: 12, step: 13, blend: 36, chain: ['hips', 'tail1', 'tail2', 'tail3'], tip: [1005, 762],
        poly: [[705, 695], [750, 688], [1008, 730], [1008, 795], [750, 790], [705, 772]] },
      { name: 'armU', tint: 0.9, feather: 9, step: 11, blend: 30, chain: ['chest', 'armU1', 'armU2', 'armU3'], tip: [60, 330],
        poly: [[360, 310], [365, 420], [270, 415], [120, 386], [60, 372], [25, 350], [25, 285], [120, 282], [270, 305]] },
      { name: 'torso', feather: 14, step: 16, blend: 110, chain: ['hips', 'chest'], tip: [400, 280],
        poly: [[270, 270], [320, 235], [400, 220], [490, 225], [560, 245], [585, 245], [648, 365], [705, 460], [735, 620], [742, 720], [735, 755],
          [725, 785], [780, 880], [770, 925], [620, 965], [490, 965], [320, 915], [235, 835], [290, 750], [318, 720], [335, 690], [350, 650],
          [365, 600], [322, 545], [285, 440], [275, 330]] },
      { name: 'head', feather: 14, step: 13, blend: 42, chain: ['chest', 'head'], tip: [380, 120],
        poly: [[250, 0], [500, 0], [560, 80], [570, 220], [550, 290], [460, 330], [350, 320], [290, 285], [245, 220], [245, 120]] },
      { name: 'armL', feather: 9, step: 11, blend: 30, chain: ['chest', 'armL1', 'armL2', 'armL3'], tip: [45, 425],
        poly: [[370, 420], [375, 560], [320, 565], [120, 505], [25, 490], [25, 380], [60, 372], [120, 386], [270, 415]] },
    ],
  },
  // a front leg hanging straight down from its shoulder, which is the anchor
  arm: {
    image: 'arm', width: 400, height: 683, unit: 1190, origin: [210, 150], view: [-330, -130, 330, 3600],
    bones: {
      arm1: { at: [210, 150] },
      arm2: { parent: 'arm1', at: [208, 270] },
      arm3: { parent: 'arm2', at: [205, 385] },
      paw: { parent: 'arm3', at: [200, 490] },
    },
    parts: [
      { name: 'arm', feather: 12, step: 12, blend: 40, chain: ['arm1', 'arm1', 'arm2', 'arm3', 'paw'], tip: [198, 640],
        poly: [[150, 95], [210, 62], [270, 95], [302, 175], [302, 290], [300, 480], [305, 680], [90, 680], [92, 560], [118, 480], [118, 175]] },
    ],
  },
};

/* --- a rig's skeleton, as arrays in dependency order --- */
function compile(rig) {
  const names = rig.names = Object.keys(rig.bones), index = rig.index = Object.fromEntries(names.map((n, i) => [n, i]));
  rig.parent = names.map(n => rig.bones[n].parent === undefined ? -1 : index[rig.bones[n].parent]);
  const at = rig.at = names.map(n => rig.bones[n].at);
  rig.tips = Object.fromEntries(rig.parts.map(p => [p.chain[p.chain.length - 1], p.tip]));
  // the direction each bone lies in the photograph, towards its first child or its tip, along which it can be stretched
  rig.axis = names.map((n, i) => {
    const child = rig.parent.indexOf(i), to = child >= 0 ? at[child] : rig.tips[n];
    if (!to) return [1, 0];
    const dx = to[0] - at[i][0], dy = to[1] - at[i][1], d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  });
  rig.legs = rig.legs || {}; rig.legNames = Object.keys(rig.legs);
  for (const leg of Object.values(rig.legs)) {
    const [a, b, c] = leg.bones.map(n => at[index[n]]);
    leg.index = leg.bones.map(n => index[n]);
    leg.len1 = Math.hypot(b[0] - a[0], b[1] - a[1]); leg.len2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    leg.rest1 = Math.atan2(b[1] - a[1], b[0] - a[0]); leg.rest2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  }
  rig.anims = {};
}
for (const rig of Object.values(RIGS)) compile(rig);

// A leg reaching for somewhere nearer than its length would have to fold up. Instead it mostly foreshortens, as a leg
// swinging towards or away from the camera does: it is squashed along its bones to no less than SQUASH, keeping REACH
// of its (squashed) length between shoulder and wrist so that the joint always has a little bend in it
const REACH = 0.95, SQUASH = 0.74;

/* --- meshes --- */
function insideDistance(poly, x, y) {
  // distance to the nearest edge for a point inside the polygon; 0 outside
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[j];
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
    const dx = x2 - x1, dy = y2 - y1, t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(x - x1 - dx * t, y - y1 - dy * t));
  }
  return inside ? best : 0;
}
// how much each bone of a part's chain moves a point: found from how far along the chain the point lies
function chainWeights(rig, part, x, y) {
  const pts = part.chain.slice(1).map(n => rig.at[rig.index[n]]).concat([part.tip]), n = pts.length - 1, cum = [0];
  let best = Infinity, u = 0;
  for (let k = 0; k < n; k++) {
    const [x1, y1] = pts[k], dx = pts[k + 1][0] - x1, dy = pts[k + 1][1] - y1, len = Math.hypot(dx, dy);
    cum.push(cum[k] + len);
    let t = ((x - x1) * dx + (y - y1) * dy) / (len * len);
    t = clamp(t, k === 0 ? -Infinity : 0, k === n - 1 ? Infinity : 1);   // the ends of the chain run on past its joints
    const d = Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
    if (d < best) { best = d; u = cum[k] + t * len; }
  }
  const b = part.blend, w = [1 - smooth(-b, b, u)];
  for (let k = 0; k < n; k++) w.push(smooth(cum[k] - b, cum[k] + b, u) * (k === n - 1 ? 1 : 1 - smooth(cum[k + 1] - b, cum[k + 1] + b, u)));
  const total = w.reduce((a, v) => a + v, 0), out = [];
  w.forEach((v, k) => { if (v / total > 0.004) out.push(rig.index[part.chain[k]], v / total); });
  return out;
}
// a grid of triangles over the part, keeping only the cells that hold some of the cat
function buildMesh(rig, part, opaque) {
  const g = part.step, xs = part.poly.map(p => p[0]), ys = part.poly.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), nx = Math.ceil((Math.max(...xs) - x0) / g), ny = Math.ceil((Math.max(...ys) - y0) / g);
  const alpha = new Float32Array((nx + 1) * (ny + 1)), id = new Int32Array((nx + 1) * (ny + 1)).fill(-1);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) alpha[j * (nx + 1) + i] = smooth(0, part.feather, insideDistance(part.poly, x0 + i * g, y0 + j * g));
  const rest = [], uv = [], fade = [], weights = [], tris = [];
  const vertex = (i, j) => {
    const k = j * (nx + 1) + i;
    if (id[k] < 0) {
      const x = x0 + i * g, y = y0 + j * g;
      id[k] = rest.length / 2; rest.push(x, y); uv.push(x / rig.width, y / rig.height); fade.push(alpha[k]); weights.push(chainWeights(rig, part, x, y));
    }
    return id[k];
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i;
    if (alpha[k] + alpha[k + 1] + alpha[k + nx + 1] + alpha[k + nx + 2] === 0 || !opaque(x0 + i * g, y0 + j * g, g)) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
    tris.push(a, b, c, b, d, c);
  }
  return { part, rest: new Float32Array(rest), uv: new Float32Array(uv), fade: new Float32Array(fade), weights, tris: new Uint16Array(tris), pos: new Float32Array(rest.length) };
}

// Each photograph arrives as a script that hands CatPuppet.photograph() a data: URL, and is fetched once however many puppets want it
const photos = {};
function loadPhoto(name) {
  if (!photos[name]) {
    const p = photos[name] = {};
    p.promise = new Promise((resolve, reject) => {
      p.deliver = url => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('CatPuppet: the photograph ' + name + ' would not decode')); img.src = url; };
      const s = document.createElement('script'); s.src = BASE + name + '.js'; s.onerror = () => reject(new Error('CatPuppet: could not load ' + s.src));
      document.head.appendChild(s);
    });
  }
  return photos[name].promise;
}
// a test for whether a square of the photograph has any cat in it, from a quarter-size copy of its transparency
function opacityTest(rig, img) {
  const s = 4, w = Math.ceil(rig.width / s), h = Math.ceil(rig.height / s), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  return (x, y, size) => {
    for (let j = Math.max(0, Math.floor(y / s) - 1); j <= Math.min(h - 1, Math.ceil((y + size) / s) + 1); j++)
      for (let i = Math.max(0, Math.floor(x / s) - 1); i <= Math.min(w - 1, Math.ceil((x + size) / s) + 1); i++) if (data[(j * w + i) * 4 + 3] > 8) return true;
    return false;
  };
}

const VERT = `attribute vec2 aPos; attribute vec2 aUV; attribute float aFade; uniform vec4 uView; varying vec2 vUV; varying float vFade;
void main(){ vUV = aUV; vFade = aFade; gl_Position = vec4((aPos.x - uView.x) * uView.z - 1.0, 1.0 - (aPos.y - uView.y) * uView.w, 0.0, 1.0); }`;
const FRAG = `precision mediump float; uniform sampler2D uTex; uniform float uTint; varying vec2 vUV; varying float vFade;
void main(){ vec4 c = texture2D(uTex, vUV) * vFade; gl_FragColor = vec4(c.rgb * uTint, c.a); }`;

const CSS = `
.cat-puppet{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none}
.cat-puppet div{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0}
.cat-puppet canvas{position:absolute;display:block}
.cat-puppet.cat-shadow .cat-flip{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}
`;
let cssDone = false;

class CatPuppet {
  // opts: rig, size, x, y, rot, flip, z, hidden, shadow (false to go without the drop shadow)
  constructor(parent, opts = {}) {
    if (!cssDone) { cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
    const rig = this.rig = RIGS[opts.rig || 'walker'];
    if (!rig) throw new Error('CatPuppet: no rig called ' + opts.rig);
    const div = (name, into) => { const d = document.createElement('div'); d.className = name; if (into) into.appendChild(d); return d; };
    this.el = div('cat-puppet'); this.el.setAttribute('aria-hidden', 'true');
    this.slide = div('cat-slide', this.el);       // arriving and leaving
    this.flipEl = div('cat-flip', this.slide);    // mirroring
    this.canvas = document.createElement('canvas'); this.flipEl.appendChild(this.canvas);
    this.x = 0; this.y = 0; this.rot = 0; this.size = 160; this.flip = false;
    this.tweak = {};          // degrees added to any bone by name, on top of the animation
    this.showBones = false;   // draw the skeleton over the cat
    const n = rig.names.length;
    this.local = new Float32Array(n); this.squash = new Float32Array(n).fill(1); this.root = [0, 0, 0];   // the pose as last drawn
    this.world = rig.names.map((_, i) => ({ a: 0, x: rig.at[i][0], y: rig.at[i][1], m: [1, 0, 0, 1] }));
    this.anim = null; this.from = null; this.meshes = null; this.velocity = 0;
    if (opts.shadow !== false) this.el.classList.add('cat-shadow');
    if (opts.hidden) this.el.style.visibility = 'hidden';
    this.place(opts);
    parent.appendChild(this.el);
    this.ready = loadPhoto(rig.image).then(img => { this.setup(img); if (!this.anim && rig.calm) this.play(rig.calm); return this; });
    this.ready.catch(e => console.error(e));
  }

  /* --- where and how big --- */
  place(o = {}) {
    const resized = o.size !== undefined && o.size !== this.size;
    for (const k of ['x', 'y', 'rot', 'size', 'flip']) if (o[k] !== undefined) this[k] = o[k];
    if (o.z !== undefined) this.el.style.zIndex = o.z;
    this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.rot}deg)`;
    this.flipEl.style.transform = this.flip ? 'scaleX(-1)' : '';
    if ((resized || !this.canvas.style.width) && this.size) this.layout();
    return this;
  }
  get scale() { return this.size / this.rig.unit; }
  get height() { return this.rig.height * this.scale; }
  layout() {
    const k = this.scale, [x0, y0, x1, y1] = this.rig.view, dpr = Math.min(window.devicePixelRatio || 1, 2), s = this.canvas.style;
    s.left = x0 * k + 'px'; s.top = y0 * k + 'px'; s.width = (x1 - x0) * k + 'px'; s.height = (y1 - y0) * k + 'px';
    this.canvas.width = Math.max(1, Math.round((x1 - x0) * k * dpr)); this.canvas.height = Math.max(1, Math.round((y1 - y0) * k * dpr));
    if (this.bonesCanvas) { Object.assign(this.bonesCanvas.style, { left: s.left, top: s.top, width: s.width, height: s.height }); this.bonesCanvas.width = this.canvas.width; this.bonesCanvas.height = this.canvas.height; }
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  show() { this.el.style.visibility = ''; this.wake(); return this; }
  hide() { this.el.style.visibility = 'hidden'; return this; }
  get hidden() { return this.el.style.visibility === 'hidden'; }
  remove() { this.stop(); cancelAnimationFrame(this.raf); this.raf = null; this.el.remove(); }
  // which way the cat is facing and which way is up for it, on screen
  get heading() { const r = this.rot * RAD, f = this.flip ? 1 : -1; return [Math.cos(r) * f, Math.sin(r) * f]; }
  get up() { const r = this.rot * RAD; return [Math.sin(r), -Math.cos(r)]; }
  // where a point of the photograph, carried by a bone, has got to in the parent element; and the reverse, for a point at rest
  locate(bone, p) {
    const [rx, ry] = this.carry(this.rig.index[bone], p), k = this.scale, [ox, oy] = this.rig.origin, r = this.rot * RAD, c = Math.cos(r), s = Math.sin(r);
    const lx = (rx - ox) * k * (this.flip ? -1 : 1), ly = (ry - oy) * k;
    return [this.x + lx * c - ly * s, this.y + lx * s + ly * c];
  }
  toRig(x, y) {
    const k = this.scale, [ox, oy] = this.rig.origin, r = this.rot * RAD, c = Math.cos(r), s = Math.sin(r), dx = x - this.x, dy = y - this.y;
    return [ox + (dx * c + dy * s) * (this.flip ? -1 : 1) / k, oy + (-dx * s + dy * c) / k];
  }

  /* --- arriving and leaving: sliding up from beneath the anchor, and back --- */
  enter({ duration = 380, distance, easing = 'cubic-bezier(.3,1.5,.5,1)' } = {}) {
    this.slide.style.transform = '';
    this.show();
    return this.slideBy([distance === undefined ? this.height * 1.05 : distance, 0], { duration, easing });
  }
  async exit({ duration = 300, distance, easing = 'cubic-bezier(.5,0,.9,.5)' } = {}) {
    const d = distance === undefined ? this.height * 1.05 : distance;
    this.slide.style.transform = `translate(0px,${d}px)`;   // parked out of sight, for when the animation lets go
    const ok = await this.slideBy([0, d], { duration, easing });
    if (ok) { this.hide(); this.slide.style.transform = ''; }
    return ok;
  }
  slideBy([from, to], opts) {
    if (this.sliding) this.sliding.cancel();
    if (CatPuppet.reducedMotion || !this.slide.animate) return Promise.resolve(true);
    return new Promise(resolve => {
      const a = this.sliding = this.slide.animate([{ transform: `translate(0px,${from}px)` }, { transform: `translate(0px,${to}px)` }], opts);
      a.onfinish = () => { if (this.sliding === a) this.sliding = null; resolve(true); };
      a.oncancel = () => resolve(false);
    });
  }

  /* --- drawing --- */
  setup(img) {
    const gl = this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) throw new Error('CatPuppet: WebGL is not available');
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
    this.loc = { pos: gl.getAttribLocation(prog, 'aPos'), uv: gl.getAttribLocation(prog, 'aUV'), fade: gl.getAttribLocation(prog, 'aFade'), view: gl.getUniformLocation(prog, 'uView'), tint: gl.getUniformLocation(prog, 'uTint') };
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    const opaque = opacityTest(this.rig, img);
    this.meshes = this.rig.parts.map(part => {
      const m = buildMesh(this.rig, part, opaque), buffer = (target, data, usage) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
      m.uvBuf = buffer(gl.ARRAY_BUFFER, m.uv, gl.STATIC_DRAW); m.fadeBuf = buffer(gl.ARRAY_BUFFER, m.fade, gl.STATIC_DRAW);
      m.posBuf = buffer(gl.ARRAY_BUFFER, m.pos, gl.DYNAMIC_DRAW); m.triBuf = buffer(gl.ELEMENT_ARRAY_BUFFER, m.tris, gl.STATIC_DRAW);
      return m;
    });
    for (const k of ['pos', 'uv', 'fade']) gl.enableVertexAttribArray(this.loc[k]);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.wake();
  }
  wake() { if (!this.raf && this.meshes) this.raf = requestAnimationFrame(t => this.frame(t)); }
  frame(now) {
    this.raf = null;
    if (!this.el.isConnected || this.hidden) { this.last = 0; return; }
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    this.advance(dt); this.skin(); this.draw();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }
  draw() {
    const gl = this.gl, [x0, y0, x1, y1] = this.rig.view, [ox, oy] = this.rig.origin, L = this.loc;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(L.view, ox + x0, oy + y0, 2 / (x1 - x0), 2 / (y1 - y0));
    for (const m of this.meshes) {
      gl.uniform1f(L.tint, m.part.tint || 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.pos); gl.vertexAttribPointer(L.pos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.uvBuf); gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.fadeBuf); gl.vertexAttribPointer(L.fade, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.triBuf); gl.drawElements(gl.TRIANGLES, m.tris.length, gl.UNSIGNED_SHORT, 0);
    }
    this.drawBones();
  }
  drawBones() {
    if (!this.showBones) { if (this.bonesCanvas) { this.bonesCanvas.remove(); this.bonesCanvas = null; } return; }
    if (!this.bonesCanvas) { this.bonesCanvas = document.createElement('canvas'); this.flipEl.appendChild(this.bonesCanvas); this.layout(); }
    const rig = this.rig, g = this.bonesCanvas.getContext('2d'), [x0, y0, x1, y1] = rig.view, [ox, oy] = rig.origin, k = this.bonesCanvas.width / (x1 - x0);
    g.setTransform(k, 0, 0, k, -(ox + x0) * k, -(oy + y0) * k); g.clearRect(ox + x0, oy + y0, x1 - x0, y1 - y0);
    g.lineWidth = 5; g.lineCap = 'round';
    rig.names.forEach((n, i) => {
      // a line to each child, or to the tip of the last bone in a chain
      const w = this.world[i], ends = rig.names.map((_, j) => j).filter(j => rig.parent[j] === i).map(j => [this.world[j].x, this.world[j].y]);
      if (rig.tips[n]) ends.push(this.carry(i, rig.tips[n]));
      g.strokeStyle = '#ffd35a'; for (const e of ends) { g.beginPath(); g.moveTo(w.x, w.y); g.lineTo(e[0], e[1]); g.stroke(); }
      g.fillStyle = '#d8314a'; g.beginPath(); g.arc(w.x, w.y, 8, 0, 7); g.fill();
    });
  }

  /* --- posing --- */
  // where bone i, as now posed, has carried a point of the photograph
  carry(i, p) {
    const w = this.world[i], m = w.m, at = this.rig.at[i], dx = p[0] - at[0], dy = p[1] - at[1];
    return [w.x + dx * m[0] + dy * m[1], w.y + dx * m[2] + dy * m[3]];
  }
  // place every bone from the root, each bone's own turn, and how far each is stretched along its length
  forward(root, local, squash) {
    const { parent, at, axis } = this.rig;
    for (let i = 0; i < local.length; i++) {
      const w = this.world[i], p = parent[i];
      if (p < 0) { w.a = root[2] * RAD + local[i]; w.x = at[i][0] + root[0]; w.y = at[i][1] + root[1]; }
      else { const to = this.carry(p, at[i]); w.a = this.world[p].a + local[i]; w.x = to[0]; w.y = to[1]; }
      const c = Math.cos(w.a), s = Math.sin(w.a), k = squash[i] - 1, [ux, uy] = axis[i];
      const k00 = 1 + k * ux * ux, k01 = k * ux * uy, k11 = 1 + k * uy * uy;
      w.m[0] = c * k00 - s * k01; w.m[1] = c * k01 - s * k11; w.m[2] = s * k00 + c * k01; w.m[3] = s * k01 + c * k11;
    }
  }
  /* Turn a pose into the turn of every bone. A pose is
       { x, y, rot,                    the root bone: moved in photograph pixels and turned in degrees
         <bone>: degrees, ...          any bone by name
         tail: [degrees, ...],         shorthand for tail1, tail2, ...
         stretch: { <bone>: factor },  bones stretched or squashed along their length
         feet: { foreL: { at: [x, y] }       where the wrist or hock goes, in the photograph's own space, so on the floor
                       | { from: [dx, dy] }  or relative to the shoulder or hip, turning with the body, for a leg in the air
                 paw: degrees } } }    the paw's own tilt; left out, it stays as flat as it was photographed
     with anything left out at rest, and legs left out standing. */
  solve(pose, root, local, squash) {
    const rig = this.rig, index = rig.index;
    root[0] = pose.x || 0; root[1] = pose.y || 0; root[2] = pose.rot || 0;
    local.fill(0); squash.fill(1);
    for (const k in pose) if (index[k] !== undefined) local[index[k]] = pose[k] * RAD;
    (pose.tail || []).forEach((a, k) => { local[index['tail' + (k + 1)]] = a * RAD; });
    for (const k in pose.stretch || {}) squash[index[k]] = pose.stretch[k];
    if (!rig.legNames.length) return;
    this.forward(root, local, squash);
    for (const name of rig.legNames) {
      const leg = rig.legs[name], f = (pose.feet && pose.feet[name]) || {}, [i1, i2, i3] = leg.index, parent = this.world[rig.parent[i1]], S = this.world[i1];
      let tx, ty;
      if (f.from) { const c = Math.cos(parent.a), s = Math.sin(parent.a); tx = S.x + f.from[0] * c - f.from[1] * s; ty = S.y + f.from[0] * s + f.from[1] * c; }
      else [tx, ty] = f.at || leg.stand;
      const dx = tx - S.x, dy = ty - S.y, far = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
      const q = clamp(far / (REACH * (leg.len1 + leg.len2)), SQUASH, 1), len1 = leg.len1 * q, len2 = leg.len2 * q, d = clamp(far, Math.abs(len1 - len2) + 1, len1 + len2 - 0.5);
      const bend = Math.acos(clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1));
      const a1 = base - leg.fold * bend, ex = S.x + Math.cos(a1) * len1, ey = S.y + Math.sin(a1) * len1;
      squash[i1] = squash[i2] = q;
      const a2 = Math.atan2(S.y + Math.sin(base) * d - ey, S.x + Math.cos(base) * d - ex);
      const turn1 = a1 - leg.rest1, turn2 = a2 - leg.rest2, turn3 = (f.paw || 0) * RAD + (f.from ? parent.a : 0);
      local[i1] = wrap(turn1 - parent.a); local[i2] = wrap(turn2 - turn1); local[i3] = wrap(turn3 - turn2);
    }
  }
  // move the animation on, and settle on the turn of every bone for this frame
  advance(dt) {
    const a = this.anim, index = this.rig.index;
    if (a) {
      a.t += dt * a.rate;
      this.solve(a.pose(a.t, dt, this) || {}, this.root, this.local, this.squash);
      if (this.from) {   // ease out of whatever came before
        const k = a.blend ? ease(clamp(a.t / a.rate / a.blend, 0, 1)) : 1;
        for (let i = 0; i < 3; i++) this.root[i] = lerp(this.from.root[i], this.root[i], k);
        for (let i = 0; i < this.local.length; i++) {
          this.local[i] = this.from.local[i] + wrap(this.local[i] - this.from.local[i]) * k;
          this.squash[i] = lerp(this.from.squash[i], this.squash[i], k);
        }
        if (k >= 1) this.from = null;
      }
      for (const n in this.tweak) if (index[n] !== undefined) this.local[index[n]] += this.tweak[n] * RAD;
    }
    this.forward(this.root, this.local, this.squash);
    if (a && this.anim === a && a.t >= a.duration) { this.anim = null; this.velocity = 0; if (a.then) this.play(a.then, a.thenOpts); a.resolve(true); }
  }
  skin() {
    const W = this.world, at = this.rig.at;
    for (const m of this.meshes) {
      const { rest, pos, weights } = m;
      for (let v = 0, n = weights.length; v < n; v++) {
        const x = rest[v * 2], y = rest[v * 2 + 1], ws = weights[v];
        let px = 0, py = 0;
        for (let k = 0; k < ws.length; k += 2) {
          const i = ws[k], w = ws[k + 1], b = W[i], dx = x - at[i][0], dy = y - at[i][1];
          px += w * (b.x + dx * b.m[0] + dy * b.m[1]); py += w * (b.y + dx * b.m[2] + dy * b.m[3]);
        }
        pos[v * 2] = px; pos[v * 2 + 1] = py;
      }
    }
  }

  /* --- animation --- */
  // Start an animation by name. Resolves true when it finishes, false if another replaces it; loops never resolve by
  // themselves. opts go to the animation; `rate` plays it faster or slower
  play(name, opts = {}) {
    const rig = this.rig;
    if (!rig.anims[name]) throw new Error('CatPuppet: no animation called ' + name);
    this.stop();
    let def;
    if (CatPuppet.reducedMotion && rig.calm && name !== rig.calm) {
      // hold still instead, but still end up where the animation was going, and still tell whoever was waiting on it
      if (opts.to) this.place({ x: opts.to[0], y: opts.to[1] });
      for (const k of ['onStrike', 'onLand', 'onBeat']) if (opts[k]) opts[k]();
      def = { duration: 0.25, pose: rig.anims[rig.calm](this, {}).pose };
    } else def = rig.anims[name](this, opts);
    this.from = { root: this.root.slice(), local: this.local.slice(), squash: this.squash.slice() };
    const rate = opts.rate || 1;
    this.velocity = (def.velocity || 0) * this.scale * rate;
    return new Promise(resolve => {
      this.anim = { name, t: 0, rate, blend: def.blend === undefined ? 0.22 : def.blend, duration: def.duration || Infinity, pose: def.pose, resolve,
        then: def.then !== undefined ? def.then : def.duration ? rig.calm || null : null, thenOpts: def.thenOpts };
      this.wake();
    });
  }
  // Play a pose of your own making: fn(t, dt, puppet) returns a pose. It loops unless given a duration
  drive(fn, { duration, blend = 0.22 } = {}) {
    this.stop();
    this.from = { root: this.root.slice(), local: this.local.slice(), squash: this.squash.slice() };
    return new Promise(resolve => { this.anim = { name: null, t: 0, rate: 1, blend, duration: duration || Infinity, pose: fn, then: null, resolve }; this.wake(); });
  }
  stop() { if (this.anim) { const a = this.anim; this.anim = null; this.velocity = 0; a.resolve(false); } return this; }
  // Walk (or 'trot') to a point of the parent element, turning to face it first, and stand on arriving
  walkTo(x, y, { gait = 'walk', rate } = {}) {
    const r = this.rot * RAD, along = (x - this.x) * Math.cos(r) + (y - this.y) * Math.sin(r);
    if (Math.abs(along) > 1) this.place({ flip: along > 0 });
    return this.play(gait, { to: [x, y], rate });
  }

  static get reducedMotion() { return reduceQuery.matches; }
  static get rigs() { return Object.keys(RIGS); }
  static animations(rig = 'walker') { return Object.keys(RIGS[rig].anims); }
  static bones(rig = 'walker') { return RIGS[rig].names.slice(); }
  // add an animation to a rig: fn(puppet, opts) returns { pose(t, dt, puppet), duration (seconds; left out, it loops), then, velocity, blend }
  static define(rig, name, fn) { RIGS[rig].anims[name] = fn; }
  // fetch a photograph ahead of time, or for a use of your own: resolves to an image that a canvas or WebGL will accept
  static photo(name) { return loadPhoto(name); }
  static photograph(name, url) { if (photos[name]) photos[name].deliver(url); }
}
CatPuppet.RIGS = RIGS;

/* ===== the walker's animations ===== */
const WALKER = RIGS.walker;
const tailSway = (t, speed, size, lag = 0.6) => [0, 1, 2, 3].map(k => Math.sin(t * speed - k * lag) * size * (1 + k * 0.35));
const SETTLE = 12;   // how far the hips sink from the photograph when standing, to leave some bend in the legs

// one foot through a stride: planted and carried back under the body, then lifted and swung forward
function stride(leg, phase, duty, length, lift) {
  const [sx, sy] = WALKER.legs[leg].stand, p = phase - Math.floor(phase);
  if (p < duty) return { at: [sx - length / 2 + length * p / duty, sy] };
  const u = (p - duty) / (1 - duty), hind = leg[0] === 'h';
  return { at: [sx + length / 2 - length * ease(u), sy - lift * Math.sin(Math.PI * u)], paw: (hind ? -28 : -38) * Math.sin(Math.PI * u) };
}
function gait(g) {
  return (puppet, { to } = {}) => ({
    velocity: g.length / g.period, then: to ? 'stand' : null,
    pose(t, dt) {
      if (to) {   // carry the cat along, and stand on arriving
        const dx = to[0] - puppet.x, dy = to[1] - puppet.y, d = Math.hypot(dx, dy), step = puppet.velocity * dt;
        if (d <= step) { puppet.place({ x: to[0], y: to[1] }); puppet.anim.duration = 0; }
        else puppet.place({ x: puppet.x + dx / d * step, y: puppet.y + dy / d * step });
      }
      const p = t / g.period, feet = {};
      for (const leg of WALKER.legNames) feet[leg] = stride(leg, p + g.phase[leg], g.duty, g.length, g.lift);
      return {
        y: SETTLE + g.sink + Math.cos(p * 4 * Math.PI) * g.bob, rot: Math.sin(p * 4 * Math.PI + 1) * g.pitch,
        chest: Math.sin(p * 2 * Math.PI) * 1.2, head: -Math.sin(p * 4 * Math.PI + 1) * g.pitch * 1.5 + g.head,
        tail: tailSway(t, 2 * Math.PI / g.period, g.tail).map((a, k) => a + g.carry[k]), feet,
      };
    },
  });
}

Object.assign(WALKER.anims, {
  // standing quietly: breathing, and the tail idly swaying
  stand: () => ({ pose: t => ({ y: SETTLE + Math.sin(t * 1.9) * 1.5, chest: Math.sin(t * 1.9) * 0.5, head: Math.sin(t * 0.7) * 2, tail: tailSway(t, 1.4, 4) }) }),
  walk: gait({ period: 1.05, duty: 0.64, length: 150, lift: 34, bob: 3, sink: 2, pitch: 0.8, head: 0, tail: 3, carry: [0, 0, 0, 0],
    phase: { hindL: 0, foreL: 0.25, hindR: 0.5, foreR: 0.75 } }),
  trot: gait({ period: 0.56, duty: 0.5, length: 170, lift: 52, bob: 7, sink: 6, pitch: 1.6, head: 6, tail: 5, carry: [-14, -10, -6, -4],
    phase: { hindL: 0, foreR: 0.04, hindR: 0.5, foreL: 0.54 } }),
  // a few broad sweeps of the tail
  swish: () => ({ duration: 2.4, pose: t => ({ y: SETTLE, tail: tailSway(t, 9, 13 * Math.sin(Math.PI * t / 2.4), 0.8) }) }),
  // look up, then down at the floor, then back
  look: () => ({ duration: 2.6, pose: t => ({ y: SETTLE, head: 16 * Math.sin(Math.PI * 2 * t / 2.6) * (t < 1.3 ? 1 : 1.6), chest: 2 * Math.sin(Math.PI * 2 * t / 2.6), tail: tailSway(t, 1.4, 4) }) }),
  // lift the near front paw and bat at the air in front
  bat: () => ({
    duration: 2.2,
    pose: t => {
      const up = smooth(0, 0.35, t) * (1 - smooth(1.85, 2.2, t)), swat = Math.sin(t * 13) * smooth(0.35, 0.6, t) * (1 - smooth(1.6, 1.85, t)), [sx, sy] = WALKER.legs.foreL.stand;
      return { y: SETTLE + 4 * up, rot: 2 * up, chest: 3 * up, head: -10 * up,
        feet: { foreL: { at: [sx - 95 * up + swat * 26, sy - 150 * up - swat * 34], paw: -50 * up + swat * 30 }, foreR: { at: [WALKER.legs.foreR.stand[0] + 14 * up, WALKER.legs.foreR.stand[1]] } },
        tail: tailSway(t, 7, 6 * up) };
    },
  }),
  // rear the near front paw back, then bring it down hard on a point of the parent element. onStrike fires as it lands
  swat: (puppet, { at, onStrike } = {}) => {
    const [sx, sy] = WALKER.legs.foreL.stand, hit = at ? puppet.toRig(at[0], at[1]) : [sx - 150, sy - 20];
    let struck = false;
    return {
      duration: 1.25,
      pose: t => {
        const up = smooth(0, 0.42, t) * (1 - smooth(0.42, 0.55, t)), down = smooth(0.42, 0.55, t) * (1 - smooth(0.78, 1.2, t)), lean = Math.max(up, down);
        if (t >= 0.55 && !struck) { struck = true; if (onStrike) onStrike(); }
        return { y: SETTLE + 5 * lean, rot: 3 * up - 2 * down, chest: 4 * up - 4 * down, head: -6 * up - 14 * down,
          feet: { foreL: { at: [sx - 40 * up + (hit[0] - sx) * down, sy - 190 * up + (hit[1] - sy) * down], paw: -60 * up + 25 * down }, foreR: { at: [WALKER.legs.foreR.stand[0] + 14 * lean, WALKER.legs.foreR.stand[1]] } },
          tail: tailSway(t, 9, 7 * lean) };
      },
    };
  },
  // sink down, wiggle, and spring forward through the air. distance and height are in cat sizes; onLand fires on touching down
  // It leaves from wherever it has got to by the end of the crouch, so it can be moved about until then; puppet.airborne says when it has gone
  pounce: (puppet, { distance = 1.7, height = 0.55, onLand } = {}) => {
    const crouch = 1.5, air = 0.52, land = 0.45, D = distance * puppet.size, H = height * puppet.size;
    let from = null, landed = false;
    puppet.airborne = false;
    return {
      duration: crouch + air + land,
      pose: t => {
        const down = smooth(0, 0.45, t) * (1 - smooth(crouch - 0.05, crouch + 0.1, t)), wiggle = Math.sin(t * 34) * smooth(0.5, 0.7, t) * (1 - smooth(crouch - 0.2, crouch, t));
        const u = clamp((t - crouch) / air, 0, 1), flying = t > crouch && u < 1, back = smooth(crouch + air, crouch + air + land, t);
        if (t > crouch) {
          if (!from) { from = { x: puppet.x, y: puppet.y, h: puppet.heading, up: puppet.up }; puppet.airborne = true; }
          puppet.place({ x: from.x + from.h[0] * D * u + from.up[0] * H * 4 * u * (1 - u), y: from.y + from.h[1] * D * u + from.up[1] * H * 4 * u * (1 - u) });
        }
        if (u >= 1 && !landed) { landed = true; if (onLand) onLand(); }
        if (flying) {
          const reach = Math.sin(Math.PI * u);
          return { y: SETTLE, rot: lerp(30, -18, u), chest: -6 * reach, head: lerp(-8, 14, u), tail: [-10, -8, -6, -4].map(a => a * reach + 12 * (u - 0.5)),
            feet: { foreL: { from: [lerp(-60, -40, u) - 80 * reach, 190 - 40 * reach], paw: -30 }, foreR: { from: [lerp(-50, -30, u) - 80 * reach, 160 - 30 * reach], paw: -30 },
              hindL: { from: [40 + 95 * reach, 175 - 20 * reach], paw: 40 * reach }, hindR: { from: [30 + 95 * reach, 165 - 20 * reach], paw: 40 * reach } } };
        }
        const squash = t > crouch ? (1 - back) * 60 : 0;
        return { x: wiggle * 3, y: SETTLE + 78 * down + squash, rot: -5 * down + wiggle * 1.6 - (t > crouch ? (1 - back) * 5 : 0), chest: -5 * down, head: 12 * down + (t > crouch ? (1 - back) * 10 : 0),
          tail: tailSway(t, 22, 5 * down).map(a => a - 6 * down) };
      },
    };
  },
});

/* ===== the upright cat's animations =====
   Its front legs point left, so turning one clockwise (positive) raises it. armU is the far, upper one; armL the near, lower one. */
const breathe = t => ({ chest: Math.sin(t * 2) * 0.6, head: Math.sin(t * 0.8) * 1.5, tail: [0, 1, 2].map(k => Math.sin(t * 1.5 - k * 0.7) * 4 * (1 + k * 0.4)) });
Object.assign(RIGS.upright.anims, {
  idle: () => ({ pose: t => ({ ...breathe(t), armU1: Math.sin(t * 1.7) * 2, armL1: Math.sin(t * 1.7 + 1) * 2 }) }),
  // paws brought together again and again. onBeat fires on each clap
  clap: (puppet, { claps = 5, onBeat } = {}) => {
    const period = 0.26;
    let beats = 0;
    return {
      duration: 0.25 + claps * period + 0.25,
      pose: t => {
        const on = smooth(0, 0.25, t) * (1 - smooth(0.25 + claps * period, 0.5 + claps * period, t)), ph = Math.max(0, t - 0.25) / period, k = ph - Math.floor(ph);
        const open = k < 0.45 ? 1 - Math.pow(k / 0.45, 2.2) : Math.pow((k - 0.45) / 0.55, 0.7);   // accelerate in, bounce out: contact at 0.45
        if (t > 0.25 && k >= 0.45 && beats <= Math.floor(ph) && beats < claps) { beats++; if (onBeat) onBeat(); }
        return { ...breathe(t), y: -6 * on * (1 - open), head: 5 * on,
          armU1: on * (20 + 14 * open), armU2: on * (-6 - 8 * open), armL1: on * (26 - 16 * open), armL2: on * (10 + 6 * open) };
      },
    };
  },
  // both arms flung up, bouncing
  cheer: () => ({
    duration: 1.8,
    pose: t => {
      const up = smooth(0, 0.3, t) * (1 - smooth(1.45, 1.8, t)), hop = Math.abs(Math.sin(t * 9)) * up;
      return { ...breathe(t), y: -34 * hop, chest: 3 * up, head: 9 * up,
        armU1: 66 * up + 8 * hop, armU2: 10 * up, armU3: 14 * hop, armL1: 84 * up + 8 * hop, armL2: 12 * up, armL3: 14 * hop, tail: [8, 12, 16].map(a => a * up + Math.sin(t * 9) * 6 * up) };
    },
  }),
  // one paw raised and wagged
  wave: () => ({
    duration: 1.8,
    pose: t => {
      const up = smooth(0, 0.3, t) * (1 - smooth(1.45, 1.8, t)), wag = Math.sin(t * 15) * up;
      return { ...breathe(t), head: 6 * up, armU1: 58 * up, armU2: 18 * up + 22 * wag, armU3: 16 * wag, armL1: -8 * up };
    },
  }),
  // a paw clapped to the face in despair
  facepaw: () => ({
    duration: 2,
    pose: t => {
      const up = smooth(0, 0.4, t) * (1 - smooth(1.6, 2, t));
      return { ...breathe(t), chest: -3 * up, head: -16 * up + Math.sin(t * 5) * 2 * up, armU1: 34 * up, armU2: 74 * up, armU3: 30 * up, armL1: -18 * up, tail: [6, 9, 12].map(a => a * up) };
    },
  }),
  // everything droops
  slump: () => ({
    duration: 2,
    pose: t => {
      const down = smooth(0, 0.5, t) * (1 - smooth(1.6, 2, t));
      return { ...breathe(t), y: 10 * down, chest: -7 * down, head: -18 * down, armU1: -46 * down, armU2: -12 * down, armL1: -40 * down, armL2: -14 * down, tail: [8, 12, 16].map(a => a * down) };
    },
  }),
});

/* ===== the arm's animations =====
   The arm hangs from its anchor and stretches to wherever it is sent: `to` is a point of the parent element, or a
   function returning one, for a target that moves. It turns to point there, and is as long as it needs to be. */
const ARM = 340, PAW = 80;   // photograph pixels from shoulder to wrist, and on to the middle of the paw
function armAim(p) {
  const to = typeof p.armTo === 'function' ? p.armTo() : p.armTo;
  if (!to) return p.armLen || 0;
  const dx = to[0] - p.x, dy = to[1] - p.y;
  p.armRot = Math.atan2(dy, dx) / RAD - 90;
  return Math.hypot(dx, dy);
}
// swing turns the whole arm about its shoulder, by turning the element, so that it cannot swing out of its canvas
function armPose(p, len, { curl = 0, swing = 0, wob = 0 } = {}) {
  p.armLen = len;
  if (p.armRot === undefined) p.armRot = p.rot;
  p.place({ rot: p.armRot + swing });
  const s = Math.max(0.03, (len / p.scale - PAW) / ARM);
  return { arm1: wob, arm2: -1.7 * wob, arm3: wob, paw: curl, stretch: { arm1: s, arm2: s, arm3: s } };
}
RIGS.arm.pawAt = [198, 570];   // the middle of the paw, for cat.locate('paw', ...)
Object.assign(RIGS.arm.anims, {
  // stretch out to `to`, feeling the way
  reach: (p, { to, duration = 0.55 } = {}) => {
    if (to) p.armTo = to;
    const from = p.armLen || 0;
    return { duration, blend: 0, then: 'hold', pose: t => { const k = ease(Math.min(1, t / duration)); return armPose(p, lerp(from, armAim(p), k), { wob: Math.sin(t * 16) * 7 * (1 - k), curl: -22 * (1 - k) }); } };
  },
  // stay reaching, following the target if it moves
  hold: p => ({ blend: 0, pose: t => armPose(p, armAim(p), { wob: Math.sin(t * 3) * 1.5 }) }),
  // tap at what is under the paw
  pat: (p, { taps = 2, duration = 0.5 } = {}) => ({ duration, blend: 0, then: 'hold', pose: t => { const k = Math.abs(Math.sin(Math.PI * taps * t / duration)); return armPose(p, armAim(p) - 10 * k * p.scale, { curl: 26 * k }); } }),
  // draw back in to nothing, paw curled round whatever it has got
  retract: (p, { duration = 0.6 } = {}) => {
    const from = p.armLen || 0;
    p.armTo = null;
    return { duration, blend: 0, then: null, pose: t => armPose(p, lerp(from, 0, ease(Math.min(1, t / duration))), { curl: 34, wob: Math.sin(t * 20) * 2 }) };
  },
  // drawn back to one side, then swept through `sweep` degrees to the other. onStrike fires as it passes where it was aimed
  swat: (p, { sweep = 70, duration = 0.5, onStrike } = {}) => {
    const len = p.armLen || 0;
    let struck = false;
    p.armTo = null;
    return { duration, blend: 0, then: null, pose: t => {
      const k = Math.min(1, t / duration), wind = smooth(0, 0.4, k), through = smooth(0.4, 0.75, k);
      if (through >= 0.5 && !struck) { struck = true; if (onStrike) onStrike(); }
      return armPose(p, len, { swing: sweep * (0.5 * wind - through), curl: 20 });
    } };
  },
  // the paw drawn back and snapped forward. onStrike fires on the snap
  flick: (p, { duration = 0.34, onStrike } = {}) => {
    const len = p.armLen || 0;
    let struck = false;
    p.armTo = null;
    return { duration, blend: 0, then: null, pose: t => {
      const k = Math.min(1, t / duration), wind = smooth(0, 0.55, k) * (1 - smooth(0.6, 0.72, k)), snap = smooth(0.6, 0.72, k) * (1 - smooth(0.8, 1, k));
      if (k >= 0.62 && !struck) { struck = true; if (onStrike) onStrike(); }
      return armPose(p, len - (26 * wind - 22 * snap) * p.scale * 4, { curl: -40 * wind + 34 * snap });
    } };
  },
});

window.CatPuppet = CatPuppet;
})();
