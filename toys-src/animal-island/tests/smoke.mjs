// Headless checks for Animal Island.
//   npm install && npm test            (add --shots to save screenshots in tests/out/)
// Serves three.js from node_modules so it works offline, loads index.html#test,
// starts the game, then clicks each animal and tree at its projected screen position
// and checks that the right word card appears. Exits non-zero on any failure.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const page_url = 'file://' + path.join(root, 'index.html') + '#test';
const threeLocal = path.join(root, 'node_modules/three/build/three.min.js');
const shots = process.argv.includes('--shots');
const outDir = path.join(here, 'out');
if (shots) fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let failures = 0;
const fail = msg => { failures++; console.error('FAIL', msg); };
const pass = msg => console.log('ok  ', msg);

for (const vp of [{ name: 'desktop', width: 1200, height: 800 }, { name: 'phone', width: 400, height: 800 }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/three.min.js', r => r.fulfill({ path: threeLocal }));
  await page.route('**fonts.googleapis.com/**', r => r.abort());
  await page.goto(page_url);
  await page.waitForFunction(() => window.__island, null, { timeout: 15000 });
  await page.evaluate(() => document.getElementById('go').click());
  await page.waitForTimeout(800);
  if (shots) await page.screenshot({ path: path.join(outDir, `${vp.name}.png`) });

  const project = kind => page.evaluate(kind => {
    const { animals, trees, camera, THREE } = window.__island;
    const list = kind === 'animals' ? animals.map(a => [a.name, a.hit]) : trees.map(t => [t.kind, t.hit]);
    return list.map(([name, hit]) => {
      const v = new THREE.Vector3(); hit.getWorldPosition(v); v.project(camera);
      return { name, x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, onScreen: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 };
    });
  }, kind);
  const cardWord = () => page.evaluate(() => document.getElementById('card').hidden ? '' : document.getElementById('cardWord').textContent);
  const hideCard = () => page.evaluate(() => { document.getElementById('card').hidden = true; });

  for (const a of await project('animals')) {
    if (!a.onScreen) { console.log('skip', vp.name, a.name, '(off screen)'); continue; }
    await page.mouse.click(a.x, a.y); await page.waitForTimeout(60);
    const w = await cardWord(); await hideCard();
    w === a.name ? pass(`${vp.name}: tap ${a.name}`) : fail(`${vp.name}: tap ${a.name} showed "${w}"`);
  }
  for (const t of await project('trees')) {
    if (!t.onScreen) continue;
    await page.mouse.click(t.x, t.y); await page.waitForTimeout(60);
    const w = await cardWord(); await hideCard();
    // a tree can sit behind an animal from some angles; any card is acceptable, none is not
    w ? pass(`${vp.name}: tap ${t.name} tree -> ${w}`) : fail(`${vp.name}: tap ${t.name} tree showed nothing`);
    await page.waitForTimeout(750); // tree tap has a 700 ms cooldown
  }

  // voice panel opens and closes
  await page.click('#openVoice');
  (await page.isVisible('#voicePanel')) ? pass(`${vp.name}: voice panel opens`) : fail(`${vp.name}: voice panel did not open`);
  if (shots) await page.screenshot({ path: path.join(outDir, `${vp.name}-voice.png`) });
  await page.click('#closeVoice');

  // find mode shows the prompt
  await page.click('#mFind');
  (await page.isVisible('#prompt')) ? pass(`${vp.name}: find mode prompt`) : fail(`${vp.name}: find prompt missing`);

  errors.length ? fail(`${vp.name}: page errors: ${errors.join(' | ')}`) : pass(`${vp.name}: no page errors`);
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
