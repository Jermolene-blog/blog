const { chromium } = require('playwright');
const { makePage, OUT } = require('./run.js');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const mode = process.argv[2];
  const [w, h, pr] = mode === 'ipad' ? [1024, 768, { frames: 3, mode: 'corners', kinds: ['cpu', 'cpu', 'empty', 'empty'] }] : [390, 844, { frames: 3, mode: 'ends', kinds: ['cpu', 'cpu'] }];
  const page = await makePage(browser, w, h, pr);
  await page.click('#go');
  await page.waitForFunction(() => __bb.ball.inWorld, null, { timeout: 60000, polling: 50 });
  const zs = [-0.3, -1.5, -3, -4.3, -5.2];
  for (let i = 0; i < zs.length; i++) {
    await page.waitForFunction(z => __bb.ball.body.position.z < z || !__bb.ball.inWorld, zs[i], { timeout: 60000, polling: 30 });
    await page.screenshot({ path: `${OUT}/chase-${mode}-${i}.png` });
  }
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/chase-${mode}-${5 + i}.png` }); }
  await browser.close();
})();
