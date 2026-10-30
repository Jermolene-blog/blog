// Phones that drop off come back by themselves over the spare lines: kill, host away for one attempt, silent link, reload and reinvite, pool emptied. Two Chromium processes; serves the toy itself on port 8765 and injects a __n test hook. npm install in toys-src first.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../static-assets/toys/bowling-bear');fs.mkdirSync(path.join(here,'shots'),{recursive:true});
const srv=http.createServer((q,r)=>{const f=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,d)=>{if(!e&&f.endsWith('.html'))d=String(d).replace("$('#bScanAnswer').onclick","window.__n={invite,joinWith,acceptAnswer,net,G,get S(){return S},get view(){return view}};$('#bScanAnswer').onclick");if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(d);}});}).listen(8765);
const ARGS=['--disable-features=WebRtcHideLocalIpsWithMdns','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'];
const errs=[];const watch=(pg,n)=>{pg.on('pageerror',e=>errs.push(n+': '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(n+': '+m.text())})};
const hb=await chromium.launch({args:ARGS}),gb=await chromium.launch({args:ARGS});
const host=await (await hb.newContext({permissions:['camera']})).newPage({viewport:{width:390,height:800}});
const guest=await (await gb.newContext({permissions:['camera']})).newPage({viewport:{width:390,height:800}});
watch(host,'host');watch(guest,'guest');
for(const p of [host,guest])await p.goto('http://localhost:8765/');
await guest.fill('#name','Gail');await guest.dispatchEvent('#name','change');
async function join(){
  const offer=await host.evaluate(async()=>{await __n.invite();return __n.net.pending.code;});
  const reply=await guest.evaluate(async c=>{await __n.joinWith(c);return __n.net.replyCode;},offer);
  await host.evaluate(c=>__n.acceptAnswer(c),reply);await host.waitForTimeout(2500);
}
await host.click('#bHost');await join();
const hs=()=>host.evaluate(()=>[__n.S.phase,__n.S.players.map(p=>p.id+':'+p.name+(p.gone?'(gone)':'')).join(','),'peers='+[...__n.net.peers.keys()].join('/'),'spares='+(__n.net.spares.get('g1')||[]).length].join(' '));
const gs=()=>guest.evaluate(()=>[__n.G.live&&__n.G.live.pc.connectionState,'opens='+__n.G.opens,'spares='+__n.G.spares.filter(s=>s.pc.localDescription).length,'rescuing='+__n.G.rescuing,'view='+(__n.view&&__n.view.phase),'note='+document.querySelector('#netNote').textContent+(document.querySelector('#netNote').hidden?'(hidden)':'')].join(' '));
await host.waitForTimeout(1500);
console.log('joined   ',await hs(),'|',await gs());
await host.evaluate(()=>document.querySelector('#bStart').click());await host.waitForTimeout(1000);
console.log('started  ',await hs(),'|',await gs());
// 1: the live link dies
await guest.evaluate(()=>__n.G.live.pc.close());await guest.waitForTimeout(4000);
console.log('kill     ',await hs(),'|',await gs());
// 2: the host is "away" for the first attempt: spare 1 is given addresses that go nowhere, so the guest moves on to spare 2
await guest.waitForFunction(()=>__n.G.spares.filter(s=>s.pc.localDescription).length===4,null,{timeout:15000});
await guest.evaluate(()=>{__n.G.spares[0].cands=__n.G.spares[0].cands.map(c=>c.replace(/ (\d+) typ/,' 9 typ'));__n.G.live.pc.close();});
await guest.waitForTimeout(3000);console.log('host away',await hs(),'|',await gs());
await guest.waitForFunction(()=>!__n.G.rescuing,null,{timeout:40000});
console.log('back     ',await hs(),'|',await gs());
// 3: silent link: the guest stops hearing the host
await guest.waitForFunction(()=>__n.G.spares.filter(s=>s.pc.localDescription).length===4,null,{timeout:15000});
await guest.evaluate(()=>{__n.G.live.dc.onmessage=null;});await guest.waitForTimeout(10000);
console.log('silent   ',await hs(),'|',await gs());
// 4: guest page reloads: rejoin through an invite, same place
await guest.reload();await guest.waitForTimeout(500);await join();await host.waitForTimeout(1000);
console.log('reload   ',await hs(),'|',await gs());
await guest.evaluate(()=>{__n.G.spares.forEach(s=>s.pc.close());__n.G.spares=[];__n.G.live.pc.close();});await host.waitForTimeout(3000);
console.log('gone     ',await hs(),'| host note:',await host.evaluate(()=>document.querySelector('#netNote').textContent),'| guest:',await guest.evaluate(()=>document.querySelector('#joinStatus').textContent));
await host.screenshot({path:path.join(here,'shots/hostnote.png')});
// 5: no spares left and no way back: the host keeps the place, then skips them after the grace period
console.log('errors',errs.slice(0,10));
await hb.close();await gb.close();srv.close();
