const { chromium } = require('playwright');
const { makePage, OUT } = require('./run.js');
const { flick } = require('./flick.js');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await makePage(browser, 1024, 768, { frames: 3, mode: 'corners', kinds: ['human', 'empty', 'empty', 'cpu'] });
  await page.click('#go');
  let shot = 0;
  for (;;) {
    const r = await page.waitForFunction(() => __bb.aim ? 'aim' : (__bb.game && __bb.game.over ? 'over' : false), null, { timeout: 200000, polling: 250 }).then(h => h.jsonValue());
    if (r === 'over') break;
    await page.waitForTimeout(200);
    if (shot === 0) await page.screenshot({ path: `${OUT}/h-ready.png` });
    const cv = shot % 2 ? -30 : 30; const res = await flick(page, { dist: 160, curve: cv, ms: 110, angle: -Math.atan(cv/160) + (Math.random()-0.5)*0.08 });
    console.log('flick', shot, JSON.stringify(res));
    if (shot === 0) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/h-roll.png` }); }
    shot++;
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/h-end.png` });
  console.log(JSON.stringify(await page.evaluate(() => __bb.game.players.map(p => ({ n: p.name, rolls: p.rolls, f: __bb.scoreFrames(p.rolls, 3).map(f => f.marks.join('') + ':' + f.score) })))));
  await browser.close();
})();
