import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const ANIMALS=[
 ['Cow',444992],['Bull',444612],['Horse',509336],['Horse_White',507108],['Donkey',504276],['Alpaca',353484],
 ['Deer',451160],['Stag',407212],['Fox',455656],['Wolf',457080],['Husky',437316],['ShibaInu',417776]];
const NICE={Horse_White:'White horse',ShibaInu:'Shiba inu'};
const CLIPS=[
 ['Idle',['idle']],['Walk',['walk']],['Gallop',['gallop']],['Jump',['jump_toidle']],
 ['Eating',['eating']],['Head low',['idle_headlow','idle_2_headlow']],['Hit react',['idle_hitreact1']],
 ['Attack',['attack_headbutt','attack']],['Death',['death']]];
let clipIdx=0, speed=1, realScale=false;
let picks=new Set(); try{picks=new Set(JSON.parse(localStorage.getItem('qa-picks')||'[]'))}catch(e){}
const savePicks=()=>{try{localStorage.setItem('qa-picks',JSON.stringify([...picks]))}catch(e){}};

const grid=document.getElementById('grid');
const pens=ANIMALS.map(([id,bytes])=>{
  const el=document.createElement('section'); el.className='pen'; el.setAttribute('aria-label',NICE[id]||id);
  el.innerHTML=`<div class="stage" tabindex="0" aria-label="Drag to turn"><div class="load">Loading…</div></div>
   <div class="meta"><div><div class="name">${NICE[id]||id}</div><div class="facts">${(bytes/1024).toFixed(0)} KB · <span class="tri">–</span> tris</div></div>
   <button class="pick" id="pick-${id}" aria-pressed="false">Keep</button></div>`;
  grid.appendChild(el);
  return {id,el,stage:el.querySelector('.stage'),yaw:-0.6,drag:null};
});

// controls
const clipBox=document.getElementById('clips');
CLIPS.forEach(([label],i)=>{const b=document.createElement('button');b.className='chip';b.textContent=label;b.id='clip-'+i;
  b.setAttribute('aria-pressed',i===0);b.onclick=()=>{clipIdx=i;[...clipBox.querySelectorAll('.chip')].forEach((c,j)=>c.setAttribute('aria-pressed',j===i));pens.forEach(play)};clipBox.appendChild(b)});
const fitB=document.getElementById('fit'),realB=document.getElementById('real');
fitB.onclick=()=>{realScale=false;fitB.setAttribute('aria-pressed',true);realB.setAttribute('aria-pressed',false)};
realB.onclick=()=>{realScale=true;realB.setAttribute('aria-pressed',true);fitB.setAttribute('aria-pressed',false)};
document.querySelectorAll('.spd').forEach(b=>b.onclick=()=>{speed=+b.dataset.s;document.querySelectorAll('.spd').forEach(x=>x.setAttribute('aria-pressed',x===b))});

function renderPicks(){
  pens.forEach(p=>{const on=picks.has(p.id);p.el.classList.toggle('on',on);const b=p.el.querySelector('.pick');b.setAttribute('aria-pressed',on);b.textContent=on?'Kept':'Keep'});
  const names=pens.filter(p=>picks.has(p.id)).map(p=>NICE[p.id]||p.id);
  document.getElementById('count').textContent=`${names.length} picked`;
  document.getElementById('picked').textContent=names.length?names.join(', '):'Tap “Keep” on the animals you like.';
  document.getElementById('copy').hidden=!names.length;
}
pens.forEach(p=>p.el.querySelector('.pick').onclick=()=>{picks.has(p.id)?picks.delete(p.id):picks.add(p.id);savePicks();renderPicks()});
document.getElementById('copy').onclick=async e=>{
  const t=pens.filter(p=>picks.has(p.id)).map(p=>p.id+'.glb').join('\n');
  try{await navigator.clipboard.writeText(t);e.target.textContent='Copied'}catch(err){const o=document.getElementById('picked');const r=document.createRange();r.selectNodeContents(o);getSelection().removeAllRanges();getSelection().addRange(r)}
  setTimeout(()=>e.target.textContent='Copy list',1500)};
renderPicks();

// drag to turn
pens.forEach(p=>{
  const s=p.stage;
  s.addEventListener('pointerdown',e=>{p.drag={x:e.clientX,yaw:p.yaw};s.setPointerCapture(e.pointerId);s.style.cursor='grabbing'});
  s.addEventListener('pointermove',e=>{if(p.drag)p.yaw=p.drag.yaw+(e.clientX-p.drag.x)*0.012});
  const end=()=>{p.drag=null;s.style.cursor=''};s.addEventListener('pointerup',end);s.addEventListener('pointercancel',end);
  s.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')p.yaw-=0.3;if(e.key==='ArrowRight')p.yaw+=0.3});
});

// renderer
const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setScissorTest(true);

const shadowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(0,0,0,.35)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);return t})();

const MODELS=JSON.parse(document.getElementById('models').textContent);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let maxRadius=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

pens.forEach(p=>{
  p.scene=new THREE.Scene();
  p.scene.add(new THREE.HemisphereLight(0xffffff,0x8a9a7a,2.2));
  const sun=new THREE.DirectionalLight(0xffffff,2.0);sun.position.set(3,5,4);p.scene.add(sun);
  p.camera=new THREE.PerspectiveCamera(28,1,0.01,500);
  const b64=MODELS[p.id]; const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  loader.parse(bin.buffer,'',g=>{
    const root=g.scene; p.root=root; p.pivot=new THREE.Group(); p.pivot.add(root); p.scene.add(p.pivot);
    let tris=0; root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const idx=o.geometry.index;tris+=(idx?idx.count:o.geometry.attributes.position.count)/3}});
    p.el.querySelector('.tri').textContent=Math.round(tris).toLocaleString();
    const box=new THREE.Box3().setFromObject(root), size=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
    root.position.set(-c.x,-box.min.y,-c.z);
    p.height=size.y; p.radius=Math.max(size.x,size.y,size.z)*0.62; maxRadius=Math.max(maxRadius,p.radius);
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
    sh.rotation.x=-Math.PI/2; sh.scale.set(size.x*1.4+size.z*0.4,size.z*1.4+size.x*0.4,1); sh.position.y=0.001; p.scene.add(sh);
    p.mixer=new THREE.AnimationMixer(root); p.clips=g.animations;
    play(p); p.stage.querySelector('.load').remove();
  },()=>{p.stage.querySelector('.load').textContent='Could not load model'});
});

function play(p){
  if(!p.mixer)return;
  const want=CLIPS[clipIdx][1];
  const clip=p.clips.find(c=>want.includes(c.name.toLowerCase()))||p.clips.find(c=>c.name.toLowerCase()==='idle');
  if(p.action&&p.action.getClip()===clip)return;
  const next=p.mixer.clipAction(clip); next.reset().play();
  const once=CLIPS[clipIdx][0]==='Death';
  next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat); next.clampWhenFinished=once;
  if(p.action)p.action.crossFadeTo(next,0.25,false); p.action=next;
}

function resize(){renderer.setSize(innerWidth,innerHeight,false)}
addEventListener('resize',resize); resize();

const clock=new THREE.Clock();
const fit={};
renderer.setAnimationLoop(()=>{
  const dt=clock.getDelta()*speed;
  renderer.setScissor(0,0,innerWidth,innerHeight); renderer.setClearColor(0,0); renderer.clear();
  const H=innerHeight;
  for(const p of pens){
    if(!p.root)continue;
    const r=p.stage.getBoundingClientRect();
    if(r.bottom<0||r.top>H||r.width<2)continue;
    p.mixer.update(dt);
    if(!p.drag&&!reduced)p.yaw+=dt*0.25;
    p.pivot.rotation.y=p.yaw;
    const rad=realScale?maxRadius:p.radius;
    const lookY=realScale?Math.max(p.height*0.5,maxRadius*0.45):p.height*0.5;
    const dist=rad/Math.tan(THREE.MathUtils.degToRad(14))*1.05;
    p.camera.position.set(0,lookY+dist*0.32,dist); p.camera.lookAt(0,lookY,0);
    p.camera.aspect=r.width/r.height; p.camera.updateProjectionMatrix();
    // clip to the visible band below the sticky bar
    const vp=[r.left,H-r.bottom,r.width,r.height];
    renderer.setViewport(...vp); renderer.setScissor(...vp);
    renderer.render(p.scene,p.camera);
  }
});
