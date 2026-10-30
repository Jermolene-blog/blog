const { chromium } = require('playwright');
const { makePage, OUT } = require('./run.js');
const { flick } = require('./flick.js');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await makePage(browser, 1024, 768, { frames: 3, mode: 'corners', kinds: ['human', 'empty', 'empty', 'empty'] });
  await page.click('#go');
  await page.waitForFunction(() => __bb.aim, null, { timeout: 60000, polling: 200 });
  await page.waitForTimeout(200);
  console.log(await flick(page, { dist: 160, curve: 30, ms: 110, angle: -Math.atan(30/160) }));
  for (let i = 0; i < 40; i++) {
    console.log(await page.evaluate(() => { const b = __bb.ball.body; return [b.position.x, b.position.y, b.position.z, b.velocity.x, b.velocity.z, __bb.ball.inWorld, __bb.ball.spin, JSON.stringify(__bb.game.players[0].rolls), __bb.standingPins().length].map(v => typeof v === 'number' ? v.toFixed(2) : v).join(' '); }));
    await page.waitForTimeout(250);
  }
  await browser.close();
})();
