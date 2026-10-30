// Joining from the host's QR link and with the in-app scanner, and the QR sizes the codes make. Two Chromium processes; serves the toy itself on port 8765 and injects a __n test hook. npm install in toys-src first.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../static-assets/toys/bowling-bear');fs.mkdirSync(path.join(here,'shots'),{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(!e&&f.endsWith('.html'))d=String(d).replace("$('#bScanAnswer').onclick","window.__n={invite,joinWith,acceptAnswer,net,G,pack,unpack,get S(){return S}};$('#bScanAnswer').onclick");if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(d);}});}).listen(8765);
const ARGS=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',...(process.env.MDNS?[]:['--disable-features=WebRtcHideLocalIpsWithMdns'])];
const errs=[];const watch=(pg,n)=>{pg.on('pageerror',e=>errs.push(n+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(n+': '+m.text())})};
const hb=await chromium.launch({args:ARGS}),gb=await chromium.launch({args:ARGS});
const host=await (await hb.newContext({permissions:['camera']})).newPage({viewport:{width:390,height:800}});
const gctx=await gb.newContext({permissions:['camera']});
watch(host,'host');await host.goto('http://localhost:8765/');await host.click('#bHost');
const mods=(pg,canvas)=>pg.evaluate(c=>{const t=(c==='o'?__n.net.pending.code:__n.net.replyCode).replace('http://localhost:8765/','https://jermolene.com/toys/bowling-bear/');const q=qrcode(0,'L'),k=t.lastIndexOf('#');if(k>=0)q.addData(t.slice(0,k+1),'Byte');q.addData(t.slice(k+1),'Alphanumeric');q.make();return t.length+' chars, '+q.getModuleCount()+' modules';},canvas);
for(const name of ['Gail','Hal']){
  const link=await host.evaluate(async()=>{await __n.invite();return __n.net.pending.code;});
  console.log('offer QR',await mods(host,'o'));
  await host.screenshot({path:path.join(here,'shots/invite.png')});
  const g=await (await gb.newContext({permissions:['camera']})).newPage({viewport:{width:390,height:800}});watch(g,name);
  if(name==='Gail'){await g.goto(link);await g.waitForTimeout(500);
    console.log('landing screen',await g.evaluate(()=>document.querySelector('#lobby section:not([hidden])').dataset.screen),'hash now',JSON.stringify(await g.evaluate(()=>location.hash)));
    await g.screenshot({path:path.join(here,'shots/landing.png')});
    await g.fill('#name2',name);await g.click('#bJoinLink');}
  else{await g.goto('http://localhost:8765/');await g.fill('#name',name);await g.evaluate(l=>__n.joinWith(l),link);} // in-app scan of the link
  await g.waitForFunction(()=>__n.net.replyCode,null,{timeout:15000});
  console.log('reply QR',await mods(g,'a'));
  await host.evaluate(c=>__n.acceptAnswer(c),await g.evaluate(()=>__n.net.replyCode));
  await host.waitForTimeout(2500);
}
console.log('players',await host.evaluate(()=>__n.S.players.map(p=>p.name).join(',')));
console.log('old code',await host.evaluate(()=>__n.unpack('BB2OABC*').catch(e=>e.message)));
console.log('errors',errs);
await hb.close();await gb.close();srv.close();
