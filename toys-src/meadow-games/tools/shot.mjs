// Headless test harness: renders a built page in Chromium (SwiftShader WebGL), runs scripted steps, screenshots.
// three.js CDN requests are served from node_modules; every other network request is blocked (as in the artifact sandbox).
//
// usage: node tools/shot.mjs dist/meadow-games.html out.png [width=1280] [height=800] [waitMs=6000] [steps.json]
// steps.json: [{"click":"#tile-peek"},{"wait":3000},{"tap":[x,y]},{"eval":"js expr"},{"shot":"file.png"}]
// SwiftShader runs ~3-4 fps and the game clamps dt to 0.05 s, so game time runs slowly:
// in Meadow Games, eval "(__meadow.dtCap=0.25,1)" first to speed it up.
// Set CHROMIUM=/path/to/chrome if Playwright's bundled browser isn't installed.
import {chromium} from 'playwright';
import fs from 'fs'; import path from 'path'; import os from 'os';
const [,,file,out,w='1280',h='800',wait='6000',script='']=process.argv;
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:+w,height:+h}});
const errs=[];p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED/.test(m.text()))errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGE ERROR '+e.message));
await p.route('**/*',r=>{const u=r.request().url(),m=u.match(/three@[\d.]+\/(.*)$/);
  if(m)return r.fulfill({path:path.join(root,'node_modules/three',m[1]),contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort()});
// mimic the artifact skeleton that wraps the page at publish time
const tmp=path.join(os.tmpdir(),'meadow-test.html');
fs.writeFileSync(tmp,'<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>'+fs.readFileSync(file,'utf8')+'</body></html>');
await p.goto('file://'+tmp);await p.waitForTimeout(+wait);
if(script)for(const s of JSON.parse(fs.readFileSync(script,'utf8'))){
  if(s.click)await p.click(s.click);
  if(s.tap)await p.mouse.click(s.tap[0],s.tap[1]);
  if(s.eval)console.log('eval:',JSON.stringify(await p.evaluate(s.eval)));
  if(s.wait)await p.waitForTimeout(s.wait);
  if(s.shot)await p.screenshot({path:s.shot});
}
await p.screenshot({path:out});
console.log(errs.length?errs.join('\n'):'no errors');await b.close();
