// Headless test harness for Bear Beat (Playwright + software WebGL).
//
//   node harness.mjs shots ['[["ymca",9.5,"y",4],["twerk",5,"tw",1]]'] [width height]
//       freezes the beat at each [dance, beat, tag, bearCount] and saves out/<tag>.png
//   node harness.mjs beats <track.wav|mp3> [trueBpm=123] [firstBeat=0.37]
//       loads the file through the Song file path; reports tempo and beat-time error
//   node harness.mjs mic <track.wav>
//       feeds the WAV as a fake microphone; prints a flux-weighted beat-phase histogram every
//       4 s (8 bins per beat; locked = peaks in bin 0/7, off-beat lock = peaks in bin 3/4)
//
// Run `python3 ../tools/build.py` first so ../bear.json exists. Set CHROMIUM=/path/to/chrome
// to use a specific browser binary. Pages are served from http://localhost:8123/ (localhost is
// a secure context, which getUserMedia needs); three.js is served from node_modules.
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const three = path.join(here, 'node_modules', 'three');
const [cmd, a1, a2, a3] = process.argv.slice(2);
const ORIGIN = 'http://localhost:8123/';
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
  + fs.readFileSync(path.join(root, 'index.html'), 'utf8') + '</body></html>';

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
if (cmd === 'mic') args.push('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + path.resolve(a1));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args });
const [W, H] = cmd === 'shots' ? [+(a2 || 1200), +(a3 || 760)] : [1000, 700];
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text()); });
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.startsWith(ORIGIN)) {
    const f = u.slice(ORIGIN.length).split('?')[0];
    if (!f || f === 'index.html') return r.fulfill({ body: html, contentType: 'text/html' });
    return r.fulfill({ body: fs.readFileSync(path.join(root, f)), contentType: 'application/json' });
  }
  const m = u.match(/three@0\.160\.0\/(.*)$/);
  if (m) return r.fulfill({ body: fs.readFileSync(path.join(three, m[1])), contentType: 'text/javascript' });
  if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
  return r.continue();
});
await page.goto(ORIGIN);
await page.waitForSelector('#loader.gone', { timeout: 180000 });

if (cmd === 'shots') {
  const shots = JSON.parse(a1 || '[["moonwalk",2.5,"moonwalk",1],["ymca",9.5,"ymca-Y",4],["twerk",5,"twerk",4],["gangnam",15.5,"jump",3]]');
  fs.mkdirSync(path.join(here, 'out'), { recursive: true });
  if (process.env.HIDEUI) await page.addStyleTag({ content: '.panel,#title{display:none!important}' });
  for (const [id, beat, tag, n] of shots) {
    await page.evaluate(([id, beat, n]) => { window.__bear.setBears(n || 1); window.__bear.sim(id, beat); }, [id, beat, n]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(here, 'out', tag + '.png') });
    console.log(tag, await page.evaluate(() => document.getElementById('segName').textContent));
  }
} else if (cmd === 'beats') {
  const bpm = +(a2 || 123), t0 = +(a3 || 0.37);
  await page.setInputFiles('#fileIn', path.resolve(a1));
  await page.waitForFunction(() => window.__bear.song.beats, null, { timeout: 180000 });
  const { beats, period } = await page.evaluate(() => ({ beats: window.__bear.song.beats, period: window.__bear.song.period }));
  const spb = 60 / bpm, errs = beats.map(b => { const k = Math.round((b - t0) / spb); return Math.abs(b - (t0 + k * spb)) * 1000; }).sort((x, y) => x - y);
  console.log(`tempo ${(60 / period).toFixed(2)} BPM (true ${bpm}); ${beats.length} beats; median error ${errs[errs.length >> 1].toFixed(1)} ms; 90th pct ${errs[Math.floor(errs.length * 0.9)].toFixed(1)} ms`);
} else if (cmd === 'mic') {
  await page.click('#sMic');
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(4000);
    console.log(JSON.stringify(await page.evaluate(() => {
      const { mic, clock } = window.__bear, now = mic.proc.context.currentTime, bins = new Array(8).fill(0);
      for (const [t, v] of mic.hist) { if (now - t > 6) continue; const b = clock.ref.b + (t - clock.ref.t) / clock.period; bins[Math.floor((b - Math.floor(b)) * 8)] += v; }
      const tot = bins.reduce((a, b) => a + b, 0) || 1;
      return { bpm: +(60 / clock.period).toFixed(2), locked: clock.active, bins: bins.map(b => Math.round(100 * b / tot)) };
    })));
  }
} else console.log('usage: node harness.mjs shots|beats|mic …');
await browser.close();
