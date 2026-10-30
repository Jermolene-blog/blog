import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MapControls} from 'three/addons/controls/MapControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const NAMES={Cow:'Cow',Bull:'Bull',Horse:'Horse',Horse_White:'White horse',Donkey:'Donkey',Alpaca:'Alpaca',
  Deer:'Deer',Stag:'Stag',Fox:'Fox',Wolf:'Wolf',Husky:'Husky',ShibaInu:'Shiba inu'};
const MODELS=JSON.parse(document.getElementById('models').textContent);

// ---------- seeded random ----------
let seed=7;
const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const rr=(a,b)=>a+rnd()*(b-a);

// ---------- renderer / scene ----------
const canvas=document.getElementById('world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const SKY=new THREE.Color(0xbfe3f2);
scene.background=SKY;
const camera=new THREE.PerspectiveCamera(40,1,0.1,2000);
scene.add(new THREE.HemisphereLight(0xdff1ff,0x5e8a45,1.7));
const sun=new THREE.DirectionalLight(0xfff1dc,2.6);
scene.add(sun,sun.target);

// ---------- load models ----------
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const parse=id=>new Promise((res,rej)=>{
  const bin=Uint8Array.from(atob(MODELS[id]),c=>c.charCodeAt(0));
  loader.parse(bin.buffer,'',g=>res([id,g]),rej);
});

const templates={};
Promise.all(Object.keys(MODELS).map(parse)).then(list=>{
  for(const [id,g] of list){
    const root=g.scene;
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});
    root.updateMatrixWorld(true);
    // find which way the animal faces (head minus body), so we can point it along +Z
    const head=root.getObjectByName('Head'), body=root.getObjectByName('Body')||root.getObjectByName('Torso');
    let yaw=0;
    if(head&&body){const a=head.getWorldPosition(new THREE.Vector3()),b=body.getWorldPosition(new THREE.Vector3());yaw=Math.atan2(a.x-b.x,a.z-b.z)}
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    templates[id]={scene:root,clips:g.animations,yaw,height:size.y,len:Math.max(size.x,size.z),minY:box.min.y};
  }
  build();
}).catch(e=>{document.getElementById('hint').textContent='The animals could not load. Reload the page to try again.';console.error(e)});

// ---------- world ----------
let U=1,R=30;               // U = cow height; R = island radius
const obstacles=[];         // {x,z,r}
function noise(x,z){
  return Math.sin(x*0.17+1.3)*Math.cos(z*0.15-0.4)+0.6*Math.sin(x*0.31-z*0.27+2.1)+0.35*Math.cos(x*0.53+z*0.47)+0.25*Math.sin(z*0.71-x*0.12);
}
function height(x,z){
  const r=Math.hypot(x,z)/R;
  const land=0.42*U+noise(x/U,z/U)*0.16*U;
  const t=THREE.MathUtils.smoothstep(r,0.93,1.12);
  return THREE.MathUtils.lerp(land,-1.2*U,t);
}

function buildTerrain(){
  const S=(R+16*U)*2, seg=220;
  const g=new THREE.PlaneGeometry(S,S,seg,seg); g.rotateX(-Math.PI/2);
  const p=g.attributes.position, col=[], c=new THREE.Color();
  const grassA=new THREE.Color(0x7cb350),grassB=new THREE.Color(0x5f9a3e),grassC=new THREE.Color(0x9cc45a),sand=new THREE.Color(0xe6d39a),wet=new THREE.Color(0xb9a46e);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),y=height(x,z); p.setY(i,y);
    const r=Math.hypot(x,z)/R, n=noise(x/U*1.9+7,z/U*1.9-3);
    c.copy(grassA).lerp(grassB,THREE.MathUtils.clamp(0.5+n*0.35,0,1)).lerp(grassC,THREE.MathUtils.clamp(noise(x/U*0.6,z/U*0.6)*0.4,0,0.6));
    const s=THREE.MathUtils.smoothstep(r,0.9,0.97); c.lerp(sand,s);
    c.lerp(wet,THREE.MathUtils.smoothstep(r,1.0,1.08));
    col.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
  m.receiveShadow=true; world.add(m);
  const water=new THREE.Mesh(new THREE.CircleGeometry(R*8,96).rotateX(-Math.PI/2),
    new THREE.MeshStandardMaterial({color:0x4aa6c8,roughness:0.25,metalness:0.05,transparent:true,opacity:0.92}));
  water.position.y=-0.02*U; water.receiveShadow=true; world.add(water);
  scene.fog=new THREE.Fog(SKY,R*2.2,R*5);
}

function free(x,z,r){
  if(Math.hypot(x,z)>R*0.9-r)return false;
  return obstacles.every(o=>Math.hypot(o.x-x,o.z-z)>o.r+r);
}
function spot(r,tries=200){
  for(let i=0;i<tries;i++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*R*0.88,x=Math.cos(a)*d,z=Math.sin(a)*d;if(free(x,z,r))return [x,z]}
  return null;
}

const mats={};
const mat=hex=>mats[hex]||(mats[hex]=new THREE.MeshLambertMaterial({color:hex,flatShading:true}));
function jitter(geo,amt){const p=geo.attributes.position;const m=new Map();
  for(let i=0;i<p.count;i++){const k=`${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if(!m.has(k))m.set(k,[rr(-amt,amt),rr(-amt,amt),rr(-amt,amt)]);const d=m.get(k);p.setXYZ(i,p.getX(i)+d[0],p.getY(i)+d[1],p.getZ(i)+d[2])}
  geo.computeVertexNormals();return geo}

function tree(kind){
  const t=new THREE.Group(), h=rr(2.4,3.6)*U;
  const add=(geo,hex,y)=>{const m=new THREE.Mesh(geo,mat(hex));m.position.y=y;m.castShadow=true;m.receiveShadow=true;t.add(m);return m};
  if(kind==='pine'){
    add(new THREE.CylinderGeometry(0.1*U,0.16*U,h*0.35,6),0x7a5234,h*0.17);
    const greens=[0x2f6b3e,0x3a7d47,0x47904f];
    for(let i=0;i<3;i++){const w=(0.95-i*0.25)*U*1.15;add(jitter(new THREE.ConeGeometry(w,h*0.42,7),0.05*U),greens[i],h*(0.38+i*0.2))}
  }else if(kind==='birch'){
    add(new THREE.CylinderGeometry(0.07*U,0.1*U,h*0.6,6),0xeeeae0,h*0.3);
    for(let i=0;i<3;i++){const m=add(jitter(new THREE.IcosahedronGeometry(rr(0.55,0.8)*U,0),0.08*U),[0x9cc04f,0xb2cf5c,0x88b347][i],h*rr(0.62,0.85));m.position.x=rr(-0.35,0.35)*U;m.position.z=rr(-0.35,0.35)*U}
  }else{
    add(new THREE.CylinderGeometry(0.13*U,0.2*U,h*0.5,7),0x6e4a2f,h*0.25);
    const g=[0x3f8a3c,0x4f9a44,0x5aa84a][Math.floor(rnd()*3)];
    for(let i=0;i<4;i++){const m=add(jitter(new THREE.IcosahedronGeometry(rr(0.75,1.05)*U,0),0.1*U),g,h*rr(0.6,0.82));m.position.x=rr(-0.5,0.5)*U;m.position.z=rr(-0.5,0.5)*U}
  }
  t.rotation.y=rnd()*6.28; return t;
}

function buildProps(){
  // clumps of trees so there are open meadows between them
  const groves=[];for(let i=0;i<cnt(7,2);i++){const s=spot(4*U);if(s){groves.push(s);obstacles.push({x:s[0],z:s[1],r:0.01})}}
  obstacles.length=0;
  let placed=0;
  for(const [gx,gz] of groves){
    const n=Math.floor(rr(4,8)), kind=['round','pine','birch','round'][Math.floor(rnd()*4)];
    for(let i=0;i<n;i++){
      const x=gx+rr(-5,5)*U,z=gz+rr(-5,5)*U;
      if(!free(x,z,1.4*U))continue;
      const t=tree(rnd()<0.75?kind:'round');t.position.set(x,height(x,z)-0.05*U,z);world.add(t);
      obstacles.push({x,z,r:0.7*U});placed++;
    }
  }
  for(let i=0;i<cnt(10,3);i++){const s=spot(1.6*U);if(!s)continue;const t=tree(['round','pine','birch'][i%3]);t.position.set(s[0],height(...s)-0.05*U,s[1]);world.add(t);obstacles.push({x:s[0],z:s[1],r:0.7*U})}
  // rocks
  for(let i=0;i<cnt(22,5);i++){
    const r=rr(0.25,0.9)*U,s=spot(r+0.6*U);if(!s)continue;
    const m=new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(r,0),r*0.22),mat([0x9a9a92,0xa8a49a,0x8c8f88][i%3]));
    m.scale.y=rr(0.55,0.85);m.rotation.y=rnd()*6;m.position.set(s[0],height(...s)+r*0.15,s[1]);m.castShadow=m.receiveShadow=true;world.add(m);
    obstacles.push({x:s[0],z:s[1],r:r*1.05});
  }
  // grass tufts and flowers (instanced)
  const dummy=new THREE.Object3D(), col=new THREE.Color();
  const tuft=new THREE.InstancedMesh(new THREE.ConeGeometry(0.07*U,0.32*U,4),new THREE.MeshLambertMaterial({flatShading:true}),cnt(2600,350));
  for(let i=0;i<tuft.count;i++){
    const a=rnd()*6.28,d=Math.sqrt(rnd())*R*0.9,x=Math.cos(a)*d,z=Math.sin(a)*d;
    dummy.position.set(x,height(x,z)+0.12*U,z);dummy.rotation.set(rr(-0.25,0.25),rnd()*6,rr(-0.25,0.25));dummy.scale.setScalar(rr(0.6,1.4));dummy.updateMatrix();
    tuft.setMatrixAt(i,dummy.matrix);tuft.setColorAt(i,col.setHSL(rr(0.24,0.3),rr(0.45,0.6),rr(0.3,0.42)));
  }
  world.add(tuft);
  const flower=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075*U,0),new THREE.MeshLambertMaterial({flatShading:true}),cnt(700,140));
  const fc=[0xffffff,0xfff07a,0xf7a8c8,0xc9a6ff,0xff8f6b];
  for(let i=0;i<flower.count;i++){
    // flowers come in little patches
    const p=Math.floor(i/35),pa=p*2.39996,pd=Math.sqrt((p+0.5)/Math.max(1,flower.count/35))*R*0.8;
    const x=Math.cos(pa)*pd+rr(-2.2,2.2)*U,z=Math.sin(pa)*pd+rr(-2.2,2.2)*U;
    dummy.position.set(x,height(x,z)+0.2*U,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(rr(0.8,1.3));dummy.updateMatrix();
    flower.setMatrixAt(i,dummy.matrix);flower.setColorAt(i,col.setHex(fc[(p+Math.floor(rnd()*1.4))%fc.length]));
  }
  world.add(flower);
}

// ---------- animals ----------
const agents=[];
const picks=[];   // invisible spheres used for tapping
const CLIP_SETS={
  idle:['Idle','Idle_2','Eating','Idle_Headlow','Idle_2_HeadLow'],
  walk:['Walk'],gallop:['Gallop'],jump:['Jump_toIdle','Jump_ToIdle'],death:['Death'],hit:['Idle_HitReact1','Idle_HitReact2']
};
function makeAgent(id){
  const T=templates[id];
  const model=SkeletonUtils.clone(T.scene);
  const holder=new THREE.Group(); model.rotation.y=-T.yaw; model.position.y=-T.minY; holder.add(model);
  const s=spot(T.len*0.6);if(!s)return null;
  holder.position.set(s[0],height(...s),s[1]);
  const mixer=new THREE.AnimationMixer(model), act={};
  for(const c of T.clips)act[c.name]=mixer.clipAction(c);
  const pick=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial());
  pick.visible=false;pick.scale.set(T.len*0.6,T.height*0.65,T.len*0.6);pick.position.y=T.height*0.5;holder.add(pick);
  scene.add(holder);
  const a={id,T,holder,mixer,act,cur:null,heading:rnd()*6.28,state:'idle',timer:rr(0.5,4),target:null,speed:0,
    r:T.len*0.42,walk:T.height*0.75,gallop:T.height*2.6};
  pick.userData.agent=a;picks.push(pick);
  holder.rotation.y=a.heading;
  playSet(a,'idle');
  // stagger animation phase so the herd doesn't move in lockstep
  mixer.update(rnd()*3);
  agents.push(a);return a;
}
function clipOf(a,set){const names=CLIP_SETS[set].filter(n=>a.act[n]);return a.act[names[Math.floor(rnd()*names.length)]]}
function playSet(a,set,once=false){
  const next=clipOf(a,set);if(!next||next===a.cur)return;
  next.reset();next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat);next.clampWhenFinished=once;next.play();
  if(a.cur)a.cur.crossFadeTo(next,0.3,false);a.cur=next;
}
function chooseTarget(a,far){
  for(let i=0;i<30;i++){const ang=a.heading+rr(-1.6,1.6),d=rr(far?10:4,far?22:12)*U;
    const x=a.holder.position.x+Math.sin(ang)*d,z=a.holder.position.z+Math.cos(ang)*d;
    if(free(x,z,a.r))return new THREE.Vector2(x,z)}
  const s=spot(a.r)||[0,0];return new THREE.Vector2(s[0],s[1]);
}
function nextState(a){
  if(a.state==='idle'){
    const gal=rnd()<0.18;a.state=gal?'gallop':'walk';a.target=chooseTarget(a,gal);a.timer=gal?8:20;playSet(a,a.state);
  }else{
    a.state='idle';a.timer=rr(2.5,7);playSet(a,'idle');
  }
}
const tmp=new THREE.Vector2();
function stepAgent(a,dt){
  a.mixer.update(dt);a.timer-=dt;
  const p=a.holder.position;
  if(a.state==='jump'){if(a.timer<=0){a.state='idle';a.timer=rr(1.5,3);playSet(a,'idle')}return}
  if(a.state==='down'){
    p.y+=(height(p.x,p.z)-p.y)*Math.min(1,dt*10);
    if(a.timer>0)return;
    if(a.phase==='wait'){
      // topple over and stay down
      const d=a.act.Death;d.timeScale=1;playSet(a,'death',true);
      a.phase='fallen';a.timer=d.getClip().duration+rr(2.5,4);
    }else if(a.phase==='fallen'){
      // play the fall backwards so it looks like getting up
      const d=a.cur;d.enabled=true;d.paused=false;d.timeScale=-rr(0.8,1.1);d.setLoop(THREE.LoopOnce);d.clampWhenFinished=true;
      a.phase='rise';a.timer=d.getClip().duration/Math.abs(d.timeScale);
    }else{
      a.state='idle';a.timer=rr(1,3);a.cur.timeScale=1;playSet(a,'idle');
    }
    return;
  }
  if(a.state==='idle'){if(a.timer<=0)nextState(a);a.speed=Math.max(0,a.speed-dt*a.walk*3)}
  else{
    const want=a.state==='gallop'?a.gallop:a.walk;
    a.speed+= (want-a.speed)*Math.min(1,dt*2.5);
    // steer: toward target, away from obstacles, other animals and the shore
    let dx=a.target.x-p.x,dz=a.target.y-p.z;const dist=Math.hypot(dx,dz);
    if(dist<a.r*1.5||a.timer<=0){nextState(a);return}
    dx/=dist;dz/=dist;let sx=dx,sz=dz;
    const look=a.r+a.speed*0.9;
    for(const o of obstacles){const ox=p.x-o.x,oz=p.z-o.z,d=Math.hypot(ox,oz),lim=o.r+look;if(d<lim){const w=(lim-d)/lim*2.2;sx+=ox/d*w;sz+=oz/d*w}}
    for(const b of agents){if(b===a)continue;const ox=p.x-b.holder.position.x,oz=p.z-b.holder.position.z,d=Math.hypot(ox,oz)||1e-3,lim=a.r+b.r+0.4*U;
      if(d<lim){const w=(lim-d)/lim*2.5;sx+=ox/d*w;sz+=oz/d*w}}
    const rad=Math.hypot(p.x,p.z);if(rad>R*0.84){const w=(rad-R*0.84)/(R*0.06)*1.5;sx-=p.x/rad*w;sz-=p.z/rad*w}
    const desired=Math.atan2(sx,sz);
    let diff=desired-a.heading;diff=Math.atan2(Math.sin(diff),Math.cos(diff));
    const turn=(a.state==='gallop'?2.4:1.6)*dt;a.heading+=THREE.MathUtils.clamp(diff,-turn,turn);
    // slow down while turning sharply
    const sp=a.speed*(1-Math.min(0.7,Math.abs(diff)/2));
    p.x+=Math.sin(a.heading)*sp*dt;p.z+=Math.cos(a.heading)*sp*dt;
    if(a.cur)a.cur.timeScale=THREE.MathUtils.clamp(sp/want,0.4,1.2);
  }
  // gentle separation even when standing, so nobody overlaps
  for(const b of agents){if(b===a)continue;const ox=p.x-b.holder.position.x,oz=p.z-b.holder.position.z,d=Math.hypot(ox,oz)||1e-3,lim=(a.r+b.r)*0.85;
    if(d<lim){const push=(lim-d)*0.5;p.x+=ox/d*push*Math.min(1,dt*6);p.z+=oz/d*push*Math.min(1,dt*6)}}
  p.y+=(height(p.x,p.z)-p.y)*Math.min(1,dt*10);
  a.holder.rotation.y=a.heading;
}

// ---------- herd management ----------
let herd=2;
function spawnHerd(){
  for(const a of agents){scene.remove(a.holder);a.mixer.stopAllAction()}
  agents.length=0;picks.length=0;select(null);
  const ids=Object.keys(templates);
  for(let k=0;k<herd;k++)for(const id of ids)makeAgent(id);
}

// ---------- camera ----------
const controls=new MapControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.screenSpacePanning=false;
controls.maxPolarAngle=1.22;controls.minPolarAngle=0.3;
controls.zoomToCursor=true;
const home={};
function resetView(){camera.position.copy(home.pos);controls.target.copy(home.target);follow=null;updateFollowBtn();controls.update()}
controls.addEventListener('change',()=>{
  // keep the view over the island
  const t=controls.target,lim=R*0.95,d=Math.hypot(t.x,t.z);
  if(d>lim){const k=lim/d,ox=t.x*(1-k),oz=t.z*(1-k);t.x-=ox;t.z-=oz;camera.position.x-=ox;camera.position.z-=oz}
});

// ---------- tapping, labels, follow ----------
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
const label=document.getElementById('label');
let selected=null,labelUntil=0,follow=null,down=null;
const followBtn=document.getElementById('follow');
function updateFollowBtn(){followBtn.hidden=!selected;followBtn.setAttribute('aria-pressed',!!follow&&follow===selected);followBtn.textContent=follow&&follow===selected?'Stop following':`Follow the ${NAMES[selected?.id]?.toLowerCase()||''}`}
function select(a){selected=a;if(!a){follow=null;label.hidden=true}updateFollowBtn()}
let sound=false;
document.getElementById('sound').onclick=e=>{sound=!sound;e.currentTarget.setAttribute('aria-pressed',sound);e.currentTarget.textContent=sound?'Names: on':'Names: off'};
function say(t){if(!sound)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=0.85;u.pitch=1.2;speechSynthesis.speak(u)}catch(e){}}

canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()}});
canvas.addEventListener('pointerup',e=>{
  if(!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;
  if(moved>8||dt>450)return;
  const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(picks,false)[0];
  if(!hit){return}
  const a=hit.object.userData.agent;
  if(a.state==='down')return;
  select(a);labelUntil=performance.now()+2600;label.textContent=NAMES[a.id];label.hidden=false;say(NAMES[a.id]);
  a.state='jump';a.timer=1.4;a.speed=0;playSet(a,rnd()<0.75?'jump':'hit',true);
});
followBtn.onclick=()=>{follow=follow?null:selected;updateFollowBtn()};
document.getElementById('reset').onclick=resetView;
const panel=document.getElementById('panel'),cog=document.getElementById('cog'),sizeIn=document.getElementById('size'),sizeOut=document.getElementById('size-out');
cog.onclick=()=>{panel.hidden=!panel.hidden;cog.setAttribute('aria-expanded',!panel.hidden)};
let sizeT=0;
sizeIn.oninput=()=>{sizeOut.textContent=(+sizeIn.value).toFixed(1).replace('.0','')+'×';clearTimeout(sizeT);
  sizeT=setTimeout(()=>{const v=+sizeIn.value;if(v!==S&&U){S=v;layoutWorld()}},180)};
document.getElementById('fall').onclick=()=>{
  // a ripple: animals near the middle of the view go first
  const c=controls.target;
  for(const a of agents){if(a.state==='down')continue;const d=Math.hypot(a.holder.position.x-c.x,a.holder.position.z-c.z);
    a.state='down';a.phase='wait';a.speed=0;a.timer=d/(R*0.9)*0.9+rr(0,0.25)}
  if(follow===null&&selected&&selected.state==='down')label.hidden=true;
};
document.querySelectorAll('.herd').forEach(b=>b.onclick=()=>{herd=+b.dataset.n;document.querySelectorAll('.herd').forEach(x=>x.setAttribute('aria-pressed',x===b));spawnHerd()});

// ---------- size: bigger animals = a smaller island around them ----------
let S=4, world=null;
const cnt=(n,min)=>Math.max(min,Math.round(n*1.6/(S*S)));
function layoutWorld(){
  const oldR=R;
  seed=7;obstacles.length=0;
  if(world){scene.remove(world);world.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
  world=new THREE.Group();scene.add(world);
  R=34*U/S;
  buildTerrain();buildProps();spawnHerd();
  sun.position.set(R*0.6,R*1.1,R*0.45);sun.castShadow=true;
  const sc=sun.shadow.camera;sc.left=sc.bottom=-R*1.05;sc.right=sc.top=R*1.05;sc.near=1;sc.far=R*3;
  sun.shadow.mapSize.set(innerWidth<700?2048:4096,innerWidth<700?2048:4096);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.02*U;
  camera.near=0.05*U;camera.far=R*12;
  home.pos=new THREE.Vector3(0,R*0.62,R*0.95);home.target=new THREE.Vector3(0,0,0);
  controls.minDistance=3*U;controls.maxDistance=R*2.2;
  // keep the current framing when the size changes
  if(home.ready){const k=R/oldR;camera.position.multiplyScalar(k);controls.target.multiplyScalar(k);controls.update()}
  home.ready=true;
}

// ---------- build ----------
function build(){
  U=templates.Cow.height;
  layoutWorld();
  resetView();
  {const h=document.getElementById('hint');h.textContent='Drag to move, pinch or scroll to zoom, right-drag or two fingers to turn. Tap an animal.';h.classList.add('ready')}
  renderer.setAnimationLoop(tick);
}

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(canvas);resize();

const clock=new THREE.Clock(),v=new THREE.Vector3(),last=new THREE.Vector3();
function tick(){
  const dt=Math.min(clock.getDelta(),0.05);
  for(const a of agents)stepAgent(a,dt);
  if(follow){
    v.copy(follow.holder.position);
    const dx=(v.x-controls.target.x)*Math.min(1,dt*3),dz=(v.z-controls.target.z)*Math.min(1,dt*3),dy=(v.y-controls.target.y)*Math.min(1,dt*3);
    controls.target.x+=dx;controls.target.z+=dz;controls.target.y+=dy;camera.position.x+=dx;camera.position.z+=dz;camera.position.y+=dy;
  }
  controls.update();
  if(selected&&!label.hidden){
    if(performance.now()>labelUntil&&!follow)label.hidden=true;
    v.copy(selected.holder.position);v.y+=selected.T.height*1.15;v.project(camera);
    if(v.z>1){label.style.opacity=0}else{label.style.opacity=1;
      label.style.transform=`translate(${(v.x*0.5+0.5)*canvas.clientWidth}px,${(-v.y*0.5+0.5)*canvas.clientHeight}px) translate(-50%,-100%)`}
  }
  renderer.render(scene,camera);
}
