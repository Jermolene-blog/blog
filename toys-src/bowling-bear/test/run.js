const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'node_modules');
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(__dirname, '..', 'dist', 'bowling-bear.html'), 'utf8') + '</body></html>';

async function makePage(browser, vw, vh, prefs) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: false });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://game.test/')) return route.fulfill({ body: html, contentType: 'text/html' });
    let m;
    if ((m = u.match(/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)$/))) return route.fulfill({ path: path.join(NM, 'three', m[1]), contentType: 'application/javascript' });
    if ((m = u.match(/cdn\.jsdelivr\.net\/npm\/cannon-es@0\.20\.0\/(.*)$/))) return route.fulfill({ path: path.join(NM, 'cannon-es', m[1]), contentType: 'application/javascript' });
    return route.abort();
  });
  await page.addInitScript(p => { localStorage.setItem('bowlingbear', JSON.stringify(p)); }, prefs);
  await page.goto('http://game.test/');
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 30000 });
  return page;
}
module.exports = { makePage, OUT };

if (require.main === module) (async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mode = process.argv[2] || 'ipad';
  const conf = mode === 'ipad' ? [1024, 768, { frames: 3, mode: 'corners', kinds: ['cpu', 'cpu', 'cpu', 'cpu'] }]
    : mode === 'ipadp' ? [768, 1024, { frames: 3, mode: 'corners', kinds: ['cpu', 'cpu', 'empty', 'cpu'] }]
    : [390, 844, { frames: 3, mode: 'ends', kinds: ['cpu', 'cpu', 'empty', 'empty'] }];
  const page = await makePage(browser, conf[0], conf[1], conf[2]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${mode}-setup.png` });
  await page.click('#go');
  const t0 = Date.now();
  let i = 0;
  const times = (process.env.TIMES || '1.5,2.6,3.2,3.8,4.6,6,8').split(',').map(Number);
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${mode}-${String(i++).padStart(2, '0')}-${t}.png` });
  }
  const st = await page.evaluate(() => { const g = __bb.game; return g && g.players.map(p => ({ n: p.name, rolls: p.rolls })); });
  console.log(JSON.stringify(st));
  await browser.close();
})();
