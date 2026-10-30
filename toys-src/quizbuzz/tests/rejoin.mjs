// Phones come back by themselves over the spare line. Node Playwright (npm install in toys-src); needs python3 -m http.server 8766 here. Arg: ms the spare idles before Bob drops (default 60000).
import {chromium} from 'playwright';
const U='http://127.0.0.1:8766/quizbuzz-standalone.html';
const ARGS=['--disable-features=WebRtcHideLocalIpsWithMdns','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'];
const errs=[];const watch=(pg,n)=>{pg.on('pageerror',e=>errs.push(n+': '+e));pg.on('console',m=>{if(m.type()==='error')errs.push(n+': '+m.text())})};
const hb=await chromium.launch({args:ARGS});const hctx=await hb.newContext({viewport:{width:1180,height:820},permissions:['camera']});
const host=await hctx.newPage();watch(host,'host');await host.goto(U+'#host');
await host.waitForFunction("net.rtc&&net.rtc.joinURL",null,{timeout:15000});
const browsers=[],phones=[];
for(const name of ['Ann','Bob']){
  const b=await chromium.launch({args:ARGS});browsers.push(b);const ctx=await b.newContext({viewport:{width:390,height:780},permissions:['camera']});
  const pg=await ctx.newPage();watch(pg,name);
  await pg.goto(await host.evaluate("net.rtc.joinURL"));await pg.waitForTimeout(300);
  await pg.click('[data-rtc="player"]');
  await pg.waitForFunction("window.__soloPad.link.g&&window.__soloPad.link.g.reply",null,{timeout:15000});
  const code=await pg.evaluate("window.__soloPad.link.g.reply");
  await host.evaluate(c=>net.rtc.acceptReply(c),code);
  await pg.waitForSelector('.go',{timeout:15000});await pg.fill('input',name);await pg.click('.go');
  phones.push(pg);await pg.waitForTimeout(1000);
}
const [ann,bob]=phones;
for(const pg of phones)await pg.waitForFunction("window.__soloPad.link.g.debug().spareReady",null,{timeout:10000});
await host.waitForTimeout(500);await host.click('#bStart');await host.waitForTimeout(1500);
const show=pg=>pg.evaluate("(d=>[document.querySelector('.top .n')?.textContent,window.__soloPad.view&&(window.__soloPad.view.s+':'+(window.__soloPad.view.h||'')),d.live,'opens='+d.opens])(window.__soloPad.link.g.debug())");
const hp=()=>host.evaluate("H.phase+' '+H.players.map(p=>p.name+(p.away?'(away)':'')).join(',')");
console.log('before',await show(ann),await show(bob),await hp());
await ann.evaluate("window.__soloPad.link.g.debug().kill()");await ann.waitForTimeout(4000);
console.log('Ann after kill:',await show(ann));
await ann.waitForFunction("window.__soloPad.link.g.debug().spareReady",null,{timeout:10000});
await ann.evaluate("window.__soloPad.link.g.debug().kill()");await ann.waitForTimeout(4000);
console.log('Ann after 2nd kill:',await show(ann));
await host.waitForTimeout(+process.argv[2]||60000);
console.log('spare idled; host drops Bob');
await bob.evaluate("window.__soloPad.link.g.debug().kill()");
let v,i;for(i=1;i<=20;i++){await bob.waitForTimeout(1000);v=await show(bob);if(!['msg','lost'].includes(v[1]))break}
console.log(`Bob after drop (${i}s):`,v);
await host.waitForTimeout(2500);console.log('host after:',await hp());
console.log('errors',errs.slice(0,10));
for(const b of browsers)await b.close();await hb.close();
