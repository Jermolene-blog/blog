// Node alternative to screenshot.py (npm install in toys-src for playwright). Serve static-assets/toys on port 8767
// (python3 -m http.server 8767) and run: OUT=<dir> node check.mjs. Checks file:// and http, all sizes, night and Fly, for errors.
import { chromium } from 'playwright';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../static-assets/toys');
const out=process.env.OUT;
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const [tag,url] of [['file','file://'+root+'/trundle-world/index.html'],['http','http://127.0.0.1:8767/trundle-world/']]){
  const ctx=await b.newContext({viewport:{width:1100,height:750}}); const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(String(e))); pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await pg.goto(url); await pg.waitForTimeout(6000);
  await pg.screenshot({path:`${out}/${tag}-S.png`});
  for(const k of ['M','L','XL']){ await pg.click('#size'+k); await pg.waitForTimeout(6000); if(tag==='file') await pg.screenshot({path:`${out}/${tag}-${k}.png`}); }
  await pg.click('#sizeS'); await pg.waitForTimeout(4000);
  await pg.click('#bNight'); await pg.waitForTimeout(3000); await pg.click('#bFly'); await pg.waitForTimeout(5000);
  await pg.screenshot({path:`${out}/${tag}-fly-night.png`});
  await pg.mouse.click(550,375); await pg.mouse.click(400,300); await pg.waitForTimeout(1000);
  console.log(tag, JSON.stringify(errs)); await ctx.close();
}
await b.close();
