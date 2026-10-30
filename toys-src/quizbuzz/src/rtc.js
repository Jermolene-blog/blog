/* ============ LAN transport: WebRTC with QR signalling (adapted from Bowling Bear) ============
   One invite at a time. The projector shows a QR of the game URL with the host's offer in the fragment (#j=QB1o…).
   A phone opens it, makes an answer and shows it as a QR; the iPad's front camera reads it; the data channel opens.
   As soon as one phone connects, a fresh invite replaces the code on screen.
   The phone then says hello with its persistent id, so a reconnecting phone gets its own podium back. */
const RTC_OK=typeof RTCPeerConnection!=='undefined'&&window.isSecureContext;
const b64u=bytes=>{let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=str=>{str=str.replace(/-/g,'+').replace(/_/g,'/');while(str.length%4)str+='=';const s=atob(str),o=new Uint8Array(s.length);for(let i=0;i<s.length;i++)o[i]=s.charCodeAt(i);return o};
async function streamBytes(bytes,ts){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(ts)).arrayBuffer())}
async function packSDP(kind,sdp){
  const text=sdp.split(/\r?\n/).filter(l=>l&&!/^a=(extmap-allow-mixed|msid-semantic)/.test(l)).join('\n');
  const raw=new TextEncoder().encode(text);
  if(typeof CompressionStream!=='undefined')return 'QB1'+kind+'z'+b64u(await streamBytes(raw,new CompressionStream('deflate-raw')));
  return 'QB1'+kind+'r'+b64u(raw);
}
async function unpackSDP(code){
  const m=/^QB1([oa])([zr])([A-Za-z0-9_-]+)$/.exec((code||'').trim());
  if(!m)throw new Error('That isn’t a Quizbuzz code.');
  let bytes=unb64u(m[3]);
  if(m[2]==='z')bytes=await streamBytes(bytes,new DecompressionStream('deflate-raw'));
  return {kind:m[1],sdp:new TextDecoder().decode(bytes).split('\n').join('\r\n')+'\r\n'};
}
function waitIce(pc){return new Promise(res=>{
  if(pc.iceGatheringState==='complete')return res();
  const t=setTimeout(res,3000);
  pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);res()}});
})}
function qrDataURL(text,px=560){
  const q=qrcode(0,'L');q.addData(text,'Byte');q.make();
  const n=q.getModuleCount(),quiet=3,s=Math.max(2,Math.floor(px/(n+quiet*2))),c=document.createElement('canvas');
  c.width=c.height=(n+quiet*2)*s;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#000';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+quiet)*s,(r+quiet)*s,s,s);
  return c.toDataURL();
}
async function primeCamera(){ // Safari only offers LAN ICE candidates after camera permission
  try{const s=await navigator.mediaDevices.getUserMedia({video:true});s.getTracks().forEach(t=>t.stop())}catch(e){}
}
const RTC_FAIL='Couldn’t connect. The phone and the iPad must be on the same Wi-Fi, and some guest networks block devices from talking to each other.';

/* ---- host side ---- */
function makeRtcHost(onHostMsg){
  const peers=new Map(),last=new Map(),api={pending:null,joinURL:'',status:'',onChange:()=>{}};
  let n=0,lastCode='';
  async function invite(){
    if(api.pending){try{api.pending.pc.close()}catch(e){}}
    const pc=new RTCPeerConnection({iceServers:[]}),dc=pc.createDataChannel('buzzers',{ordered:true});
    const e={pc,dc,pid:null,n:++n};api.pending=e;api.joinURL='';api.onChange();
    dc.onopen=()=>{if(api.pending===e){api.pending=null;invite()}};
    dc.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(err){return}
      if(!e.pid){if(m.t!=='hello')return;e.pid=String(m.pid||('r'+e.n)).slice(0,24);const old=peers.get(e.pid);if(old&&old!==e){try{old.pc.close()}catch(x){}}peers.set(e.pid,e)}
      last.set(e.pid,Date.now());if(m.t!=='ping')onHostMsg(e.pid,m)};
    dc.onclose=()=>{if(e.pid&&peers.get(e.pid)===e)peers.delete(e.pid)};
    pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'&&api.pending===e){api.status=RTC_FAIL;invite()}};
    await pc.setLocalDescription(await pc.createOffer());await waitIce(pc);
    if(api.pending!==e)return;
    const code=await packSDP('o',pc.localDescription.sdp);
    api.joinURL=location.origin+location.pathname+'#j='+code;api.onChange();
  }
  api.start=async()=>{await primeCamera();invite()};
  api.acceptReply=async code=>{
    if(code===lastCode)return;lastCode=code;
    const e=api.pending;if(!e)return;
    try{const {kind,sdp}=await unpackSDP(code);if(kind!=='a')return;await e.pc.setRemoteDescription({type:'answer',sdp});api.status='Connecting…';api.onChange()}
    catch(err){api.status=err.message;api.onChange();invite()}
  };
  api.has=pid=>{const e=peers.get(pid);return !!e&&e.dc.readyState==='open'};
  api.send=(pid,m)=>{const e=peers.get(pid);if(e&&e.dc.readyState==='open')try{e.dc.send(JSON.stringify(m))}catch(err){}};
  api.seen=pid=>last.get(pid)||0;
  return api;
}
/* the host's front camera reads reply codes held up to the iPad */
function startReplyCamera(video,onCode){
  let alive=true,stream=null,det=null;
  (async()=>{
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false})}catch(e){onCode(null,'The camera isn’t available. Allow camera access for this page.');return}
    video.srcObject=stream;video.muted=true;video.playsInline=true;try{await video.play()}catch(e){}
    try{if('BarcodeDetector' in window&&(await BarcodeDetector.getSupportedFormats()).includes('qr_code'))det=new BarcodeDetector({formats:['qr_code']})}catch(e){}
    const cv=document.createElement('canvas'),g=cv.getContext('2d',{willReadFrequently:true});
    const tick=async()=>{
      if(!alive)return;
      if(video.readyState>=2){let txt=null;
        try{if(det){const r=await det.detect(video);if(r[0])txt=r[0].rawValue}
          else{const w=Math.min(640,video.videoWidth),h=Math.round(video.videoHeight*w/video.videoWidth);cv.width=w;cv.height=h;g.drawImage(video,0,0,w,h);const r=jsQR(g.getImageData(0,0,w,h).data,w,h,{inversionAttempts:'dontInvert'});if(r)txt=r.data}}catch(e){}
        if(txt&&txt.startsWith('QB1a'))onCode(txt)}
      setTimeout(tick,200);
    };tick();
  })();
  return ()=>{alive=false;if(stream)stream.getTracks().forEach(t=>t.stop());video.srcObject=null};
}
/* host transport: buzzers in other windows (BroadcastChannel) and phones on the LAN (WebRTC) together */
function makeMultiHost(onHostMsg){
  const ch=makeChannelHost(onHostMsg),rtc=RTC_OK?makeRtcHost(onHostMsg):null;
  return {rtc,send(pid,m){if(rtc&&rtc.has(pid))rtc.send(pid,m);else ch.send(pid,m)},seen(pid){return Math.max(ch.seen(pid),rtc?rtc.seen(pid):0)}};
}

/* ---- guest side ---- */
function makeRtcGuest(pid,offerCode,onMsg){
  let dc=null,pc=null,ping=null;
  const link={send(m){if(dc&&dc.readyState==='open')try{dc.send(JSON.stringify(m))}catch(e){}}};
  link.connect=async()=>{
    onMsg({s:'msg',h:'One moment',p:'Making your reply code…'});
    try{
      await primeCamera();
      const {kind,sdp}=await unpackSDP(offerCode);if(kind!=='o')throw new Error('Scan the code on the big screen.');
      pc=new RTCPeerConnection({iceServers:[]});
      pc.ondatachannel=e=>{dc=e.channel;
        dc.onopen=()=>{dc.send(JSON.stringify({t:'hello',pid}));clearInterval(ping);ping=setInterval(()=>link.send({t:'ping'}),2000)};
        dc.onmessage=ev=>{try{onMsg(JSON.parse(ev.data))}catch(err){}};
        dc.onclose=()=>{clearInterval(ping);onMsg({s:'lost'})}};
      pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')onMsg({s:'msg',h:'No luck',p:RTC_FAIL+' Scan the code on the big screen to try again.'})};
      await pc.setRemoteDescription({type:'offer',sdp});
      await pc.setLocalDescription(await pc.createAnswer());await waitIce(pc);
      const reply=await packSDP('a',pc.localDescription.sdp);link.reply=reply;
      onMsg({s:'reply',qr:qrDataURL(reply,520)});
    }catch(err){onMsg({s:'msg',h:'No luck',p:err.message})}
  };
  return link;
}

