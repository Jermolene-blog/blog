const { chromium } = require('playwright');
const { makePage, OUT } = require('./run.js');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await makePage(browser, 900, 700, { frames: 3, mode: 'corners', kinds: ['human', 'empty', 'empty', 'empty'] });
  await page.evaluate(() => { document.getElementById('setup').hidden = true; const c = __bb.camera; c.position.set(2.2, 1.3, 1.6); c.up.set(0,1,0); const b = __bb.bear.root.position; c.lookAt(b.x, b.y + 0.3, b.z); c.fov = 30; c.updateProjectionMatrix(); __bb.layout = () => {}; });
  for (const [name, ts] of [['CanonBall', 0.85], ['Attack_StandAngry_01_High', 1.2], ['Trans_Stand_to_StandHind', 1.6], ['Hit_Sitting_F01', 1.1]]) {
    page.evaluate(([n, ts]) => { __bb.bearReact(n, { ts, hop: n === 'CanonBall' ? 0.45 : 0 }); }, [name, ts]);
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/bear-${name}-${i}.png` }); }
  }
  await browser.close();
})();
