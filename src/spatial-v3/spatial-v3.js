/* Fun Industrial V3.1 — whole-screen, touch-controlled spatial digital twin preview.
   Projection runs on Canvas2D even when iPhone WebGL is unavailable.
   The brain/spinal fibers are art. Only status from a verified, read-only source
   can color a capability as ready. No model calls, POST, tool action or polling. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const canvas=$('scene'),ctx=canvas&&canvas.getContext('2d',{alpha:false,desynchronized:true});
if(!canvas||!ctx){$('status').textContent='Canvas not supported. System navigator remains available.';return}
const COLORS={available:'#6ce5d3',unverified:'#8398aa',hold:'#e6b878'};
const TITLE={core:'CORE',ai:'AI',tools:'TOOLS',compute:'COMPUTE',business:'BUSINESS',voice:'VOICE',security:'SECURITY'};
const BRANCHES=['ai','tools','compute','business','voice','security'];
const POS={
 core:[0,0,0],ai:[-184,-176,20],tools:[184,-176,-10],compute:[-196,-6,3],
 business:[194,0,-6],voice:[-176,177,20],security:[178,177,14]
};
const ACTIVITY_LABEL='Motion is decorative; it does not indicate execution.';
const REDUCED=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let snapshot=null,selected='core',selectedBranch=null;
let paused=REDUCED,visible=true;
let width=1,height=1,dpr=1,zoom=1,yaw=-.18,tilt=.03;
let time=0,raf=0,lastFrame=0,lastInput=0,renderable=[];
const fingers=new Map(),pointerStart=new Map();
const min=(a,b)=>Math.min(a,b);
const max=(a,b)=>Math.max(a,b);
const clamp=(n,a,b)=>max(a,min(b,n));
function seedRandom(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}}
const rnd=seedRandom(40967);
const rand=(a,b)=>a+(b-a)*rnd();
const fibers=[];
function addFiber(pts,col,alpha,width=1){fibers.push({pts,col,alpha,width})}
function buildFibers(){
 // Crown: branching fibers whose silhouette evokes a complex neural organ.
 for(let i=0;i<330;i++){
  const a=rand(0,Math.PI*2),r=rand(18,133),u=rand(.1,1);
  const points=[];
  for(let j=0;j<=11;j++){
   const t=j/11,phi=a+Math.sin(t*9+i*.07)*.05+(1-t)*.5;
   const radial=r*(.6+.40*Math.sin(t*Math.PI))*(1+.08*Math.sin(i*.07+t*12));
   const yy=-229-Math.sin(t*Math.PI)*rand(1,3)+u*31+(t-.5)*29;
   points.push([Math.cos(phi)*radial,yy+radial*.10*Math.sin(phi*2),
    Math.sin(phi)*radial*.52+Math.sin(t*7+i)*4]);
  }
  addFiber(points,i%7===0?'#82d1cf':i%3===0?'#df9d9c':'#efb5ab',rand(.18,.55),rand(.5,1.2))
 }
 // Thin neck transitions into an organic spindle-shaped nervous system.
 for(let i=0;i<560;i++){
  const phase=rand(0,Math.PI*2),offset=rand(-1,1),radiusSeed=rand(.15,1.0);
  const points=[];
  for(let j=0;j<=21;j++){
   const t=j/21,y=-181+t*480;
   const fullness=Math.pow(Math.max(0,Math.sin((t+.045)*Math.PI)),1.65);
   const contour=11+82*fullness*(.76+.20*Math.sin(t*8+i*.11));
   const a=phase+t*(2+offset*4);
   const xx=Math.cos(a)*contour*radiusSeed;
   const zz=Math.sin(a)*contour*radiusSeed*.62;
   const weave=Math.sin(t*17+phase*2)*2.3;
   points.push([xx+weave,y,zz]);
  }
  addFiber(points,i%19===0?'#82dcd4':i%5===0?'#f2cfb3':'#d9a6b4',rand(.14,.5),rand(.35,.85))
 }
 // Central cord and coherent pathways, not random floating particles.
 for(let i=0;i<105;i++){
  const p=rand(0,Math.PI*2),rad=rand(0,16),pts=[];
  for(let j=0;j<=21;j++){
   const t=j/21;pts.push([
    Math.cos(p+t*4)*rad*(-.2+.7*Math.sin(t*Math.PI)),
    -214+t*506,
    Math.sin(p+t*4)*rad
   ])
  }
  addFiber(pts,i%8?'#c1f0da':'#f1b8bd',rand(.10,.33),rand(.35,.9))
 }
 // Sparse nearby nerve threads add depth without pretending to be network traffic.
 for(let i=0;i<110;i++){
  const p=rand(0,Math.PI*2),yy=rand(-180,270),pts=[];
  for(let j=0;j<=6;j++){
   const t=j/6,rad=rand(2,8)+t*rand(14,58);
   pts.push([Math.cos(p)*rad,yy+(t-.5)*rand(8,28),Math.sin(p)*rad])
  }
  addFiber(pts,i%5===0?'#6bc2c5':'#bf879c',rand(.08,.22),.5)
 }
}
buildFibers();
function resize(){
 const rect=canvas.getBoundingClientRect();
 width=max(1,Math.floor(rect.width));height=max(1,Math.floor(rect.height));
 dpr=min(window.devicePixelRatio||1,width<700?1.5:2);
 canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);
 canvas.style.width=width+'px';canvas.style.height=height+'px';
 ctx.setTransform(dpr,0,0,dpr,0,0);
 lastInput=performance.now();
 draw()
}
function project(p){
 const [x,y,z]=p,cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
 const rx=x*cy-z*sy,rz=x*sy+z*cy,ry=y*ct-rz*st,depth=y*st+rz*ct;
 const perspective=clamp(660/(660+depth),.56,1.6);
 const fit=min(width/540,height/850);
 const scale=fit*zoom*perspective;
 return {x:width*.5+rx*scale,y:height*.51+ry*scale,z:depth,scale};
}
function line(pts,col,opacity,lw){
 if(pts.length<2)return;ctx.beginPath();
 let first=project(pts[0]);ctx.moveTo(first.x,first.y);
 for(let j=1;j<pts.length;j++){const p=project(pts[j]);ctx.lineTo(p.x,p.y)}
 ctx.globalAlpha=opacity;ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke()
}
function backdrop(){
 ctx.globalAlpha=1;ctx.fillStyle='#03060d';ctx.fillRect(0,0,width,height);
 const g=ctx.createRadialGradient(width*.5,height*.48,5,width*.5,height*.50,max(width,height)*.66);
 g.addColorStop(0,'#14283b');g.addColorStop(.36,'#0a1a2b');g.addColorStop(.76,'#040b17');g.addColorStop(1,'#02040a');
 ctx.fillStyle=g;ctx.fillRect(0,0,width,height)
}
function drawFibers(){
 ctx.lineCap='round';ctx.lineJoin='round';
 // Paused on lower-power devices: glows are subtle, no repeated effects from web requests.
 for(let i=0;i<fibers.length;i++){
  if(width<650&&i%2===1)continue; // Lower draw-call budget on mobile Safari.
  const f=fibers[i];
  const glow=paused?1:(.91+.09*Math.sin(time*.00055+i*.31));
  line(f.pts,f.col,f.alpha*glow,f.width*(width<650?.8:1));
 }
 ctx.globalAlpha=1;
}
function edgeCurve(id){
 const end=POS[id],side=Math.sign(end[0]),start=[0,clamp(end[1]*.45,-100,175),0];
 const control1=[side*randAvoid(id,18),start[1]+(end[1]-start[1])*.25,5];
 const control2=[end[0]*.7,end[1]*.78,15];
 return [start,control1,control2,end]
}
function randAvoid(id,value){return (id.charCodeAt(0)%5)*8+value}
function bezier(a,b,c,d,t){
 const v=1-t;return [
  v*v*v*a[0]+3*v*v*t*b[0]+3*v*t*t*c[0]+t*t*t*d[0],
  v*v*v*a[1]+3*v*v*t*b[1]+3*v*t*t*c[1]+t*t*t*d[1],
  v*v*v*a[2]+3*v*v*t*b[2]+3*v*t*t*c[2]+t*t*t*d[2]
 ]
}
function branchEdges(){
 for(let i=0;i<BRANCHES.length;i++){
  const id=BRANCHES[i],points=edgeCurve(id),lit=selectedBranch===id;
  for(let thread=0;thread<8;thread++){
   const curve=[];
   for(let step=0;step<=16;step++){
    const t=step/16,p=bezier(...points,t);
    const e=Math.sin(t*Math.PI)*(thread-3.5)*2.5;
    curve.push([p[0]+e,p[1]+Math.cos(t*8+thread)*e*.5,p[2]+Math.sin(t*6+thread)*e])
   }
   line(curve,lit?'#83e2d5':'#739cab',lit?.48:.13,lit?.85:.55);
  }
 }
}
function nodeFor(id){return snapshot?.nodes.find(n=>n.id===id)}
function colorFor(id){return COLORS[nodeFor(id)?.state]||COLORS.unverified}
function drawNode(id,point,size,showLabel=true){
 const p=project(point),hover=selected===id,light=colorFor(id);
 const r=clamp(size*p.scale,8,size*1.3);
 if(p.x< -70||p.x>width+70||p.y< -75||p.y>height+75)return;
 const pulse=paused?1:1+Math.sin(time*.0012+point[0])*.08;
 const halo=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3.1);
 halo.addColorStop(0,hover?'#9bf3e569':'#809bba29');halo.addColorStop(1,'#00000000');
 ctx.globalAlpha=1;ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,r*3.1,0,2*Math.PI);ctx.fill();
 ctx.strokeStyle=light;ctx.lineWidth=hover?1.9:1;
 ctx.globalAlpha=hover?.95:.64;ctx.beginPath();ctx.arc(p.x,p.y,r*pulse,0,Math.PI*2);ctx.stroke();
 ctx.globalAlpha=hover?.95:.6;ctx.fillStyle=hover?'#275b5c':'#122938';
 ctx.beginPath();ctx.arc(p.x,p.y,r*.77,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=1;ctx.fillStyle=light;ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();
 if(showLabel){
  const label=TITLE[id]||nodeFor(id)?.name?.toUpperCase()||id.toUpperCase();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(hover?'800 ':'700 ')+(width<600?'9px':'11px')+' system-ui';
  ctx.fillStyle='#d3e8ed';ctx.shadowColor='#000';ctx.shadowBlur=6;
  ctx.fillText(label,p.x,p.y+r+16);ctx.shadowBlur=0
 }
 renderable.push({id,x:p.x,y:p.y,r:max(20,r+10)});
}
function childPositions(){
 if(!selectedBranch)return [];
 const child=snapshot?.nodes.filter(n=>n.group===selectedBranch)||[];
 const howMany=child.length;
 return child.map((n,i)=>{
  const a=-Math.PI*.82+(i/max(1,howMany-1))*Math.PI*1.65;
  const rad=110;
  return {id:n.id,point:[Math.cos(a)*rad,-50+Math.sin(a)*rad,75],label:n.name};
 })
}
function drawChildNodes(){
 const children=childPositions();
 for(const c of children){
  const parent=project(POS[selectedBranch]),p=project(c.point);
  ctx.beginPath();ctx.moveTo(parent.x,parent.y);ctx.quadraticCurveTo((parent.x+p.x)/2,height*.53,p.x,p.y);
  ctx.strokeStyle='#679bb1';ctx.globalAlpha=.42;ctx.lineWidth=1;ctx.stroke();
  drawNode(c.id,c.point,12,false);
  ctx.font='700 '+(width<520?'9px':'11px')+' system-ui';ctx.fillStyle='#e2f3fb';ctx.textAlign='center';ctx.textBaseline='middle';
  const trimmed=c.label.length>20?c.label.slice(0,19)+'…':c.label;
  ctx.globalAlpha=.88;ctx.fillText(trimmed,p.x,p.y+25);ctx.globalAlpha=1
 }
}
function draw(){
 if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 backdrop();drawFibers();branchEdges();
 renderable=[];
 // Nodes are known curated capabilities. Colors are evidence-bound, not motion-bound.
 for(const id of BRANCHES)drawNode(id,POS[id],id===selectedBranch?26:20);
 if(selectedBranch)drawChildNodes();
 ctx.globalAlpha=1;
}
function frame(now){
 raf=requestAnimationFrame(frame);
 if(!visible||paused)return; // No idle redraw when motion is paused or reduced motion is requested.
 const mobile=width<700,interval=mobile?1000/24:1000/36;
 if(now-lastFrame<interval)return;lastFrame=now;
 if(!paused){
  time=now;
  if(now-lastInput>5000&&fingers.size===0&&!selectedBranch)yaw+=mobile?.00045:.00070
 }
 draw()
}
function childrenOf(id){
 return snapshot?.nodes.filter(n=>n.group===id)||[]
}
function stateText(v){return v==='available'?'VERIFIED ENDPOINT':v==='hold'?'HOLD':'NOT VERIFIED'}
function select(id,show=true){
 if(!snapshot)return;
 const n=nodeFor(id);if(!n)return;
 selected=id;
 if(id==='core')selectedBranch=null;
 else if(BRANCHES.includes(id))selectedBranch=id;
 else if(BRANCHES.includes(n.group))selectedBranch=n.group;
 if(!show)return;
 $('node-title').textContent=n.name;
 $('node-description').textContent=n.description;
 $('node-group').textContent=n.group==='branch'?'System branch':n.group.toUpperCase();
 $('node-state').textContent=stateText(n.state);
 $('state-dot').className='state-dot '+(n.state==='available'?'ready':n.state==='hold'?'hold':'unknown');
 const evidence=snapshot.evidence?.find(e=>e.node===id);
 $('node-evidence').textContent=evidence?evidence.source:'No direct verified endpoint';
 const list=$('child-list');list.replaceChildren();
 let children=childrenOf(id);
 if(id==='core')children=snapshot.nodes.filter(n=>BRANCHES.includes(n.id));
 if(!children.length){const label=document.createElement('p');label.className='sheet-subtitle';label.textContent='No additional exposed capabilities in this branch.';list.append(label)}
 for(const child of children){
  const b=document.createElement('button');b.type='button';b.textContent=child.name;
  const sub=document.createElement('small');sub.textContent=stateText(child.state);b.append(sub);
  b.addEventListener('click',()=>select(child.id,true));list.append(b)
 }
 $('inspector').hidden=false;$('navigator').hidden=true;$('explore').setAttribute('aria-expanded','false');
 lastInput=performance.now();draw();
}
function closeDetails(){$('inspector').hidden=true;selected='core';selectedBranch=null;draw()}
function buildNav(){
 const list=$('nav-list');list.replaceChildren();
 for(const n of snapshot.nodes.filter(n=>n.id==='core'||BRANCHES.includes(n.id))){
  const b=document.createElement('button');b.type='button';b.textContent=n.name;
  const sub=document.createElement('small');sub.textContent=stateText(n.state);b.append(sub);
  b.addEventListener('click',()=>select(n.id));list.append(b)
 }
}
function toggleNav(open){
 $('navigator').hidden=!open;$('explore').setAttribute('aria-expanded',String(open));
 if(open)$('inspector').hidden=true
}
function validateData(d){
 if(!d||typeof d!=='object'||d.version!=='fun-industrial-spatial-system-v3-preview-1'||
    d.read_only!==true||d.external_actions!==0||!Array.isArray(d.nodes)||
    d.nodes.length<15||d.nodes.length>40||!Array.isArray(d.links)||d.links.length>60)return false;
 const ids=new Set(d.nodes.map(n=>n?.id));
 return BRANCHES.every(n=>ids.has(n))&&ids.has('core')&&
  d.nodes.every(n=>typeof n.id==='string'&&/^[a-z-]{2,25}$/.test(n.id)&&
    typeof n.name==='string'&&n.name.length<=80&&typeof n.description==='string'&&
    n.description.length<=500&&['available','unverified','hold'].includes(n.state))
}
async function refresh(){
 $('refresh').disabled=true;$('status').textContent='Reading local evidence…';
 const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12500);
 try{
  let response=await fetch('/api/spatial-v3/status',{method:'GET',redirect:'error',cache:'no-store',
   signal:ctl.signal,headers:{accept:'application/json'}});
  if(!response.ok)throw Error('Status HTTP '+response.status);
  const data=await response.json();
  if(!validateData(data)||data.tools_called!==0||data.model_calls!==0)throw Error('Status data not verified');
  snapshot=data;
  buildNav();
  const count=data.nodes.filter(n=>n.state==='available'&&!BRANCHES.includes(n.id)).length;
  $('status').textContent=count+' verified endpoints · '+(data.nodes.length-1)+' capabilities · no action authority';
  if(!$('inspector').hidden)select(selected,true);
  draw()
 }catch(e){
  $('status').textContent='Live evidence unavailable · read-only map';
  // A static fallback is permitted only as fully unverified topology.
  if(!snapshot){
   try{
    const res=await fetch('/api/spatial-v3/topology',{method:'GET',redirect:'error',cache:'no-store'});
    if(res.ok){const d=await res.json();if(validateData(d)){snapshot={...d,evidence:[]};buildNav();draw()}}
   }catch{}
  }
 }finally{clearTimeout(timeout);$('refresh').disabled=false}
}
const touchDistance=()=>{const v=[...fingers.values()];if(v.length<2)return 0;return Math.hypot(v[1].x-v[0].x,v[1].y-v[0].y)};
let lastPinch=0;
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();canvas.setPointerCapture?.(e.pointerId);
 fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 pointerStart.set(e.pointerId,{x:e.clientX,y:e.clientY,at:performance.now()});
 if(fingers.size>=2)lastPinch=touchDistance();
 lastInput=performance.now();
},{passive:false});
canvas.addEventListener('pointermove',e=>{
 if(!fingers.has(e.pointerId))return;
 e.preventDefault();
 const previous=fingers.get(e.pointerId),dx=e.clientX-previous.x,dy=e.clientY-previous.y;
 fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(fingers.size>=2){
  const dist=touchDistance();if(lastPinch>0&&dist>0)zoom=clamp(zoom*dist/lastPinch,.55,2.5);
  lastPinch=dist;
 }else{
  yaw+=dx*.008;tilt=clamp(tilt+dy*.005,-.8,.8);
 }
 lastInput=performance.now();draw()
},{passive:false});
function pointerEnd(e){
 if(!fingers.has(e.pointerId))return;
 const start=pointerStart.get(e.pointerId);
 const travel=start?Math.hypot(e.clientX-start.x,e.clientY-start.y):100;
 fingers.delete(e.pointerId);pointerStart.delete(e.pointerId);lastPinch=fingers.size>=2?touchDistance():0;
 if(travel<13&&fingers.size===0&&start){
  const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
  const hits=renderable.filter(n=>Math.hypot(x-n.x,y-n.y)<n.r).sort((a,b)=>a.r-b.r);
  if(hits.length)select(hits[0].id)
 }
}
canvas.addEventListener('pointerup',pointerEnd);
canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.91:1.09),.55,2.5);
 lastInput=performance.now();draw()
},{passive:false});
$('explore').addEventListener('click',()=>toggleNav($('navigator').hidden));
$('close-nav').addEventListener('click',()=>toggleNav(false));
$('close-inspector').addEventListener('click',closeDetails);
$('refresh').addEventListener('click',refresh);
$('reset').addEventListener('click',()=>{selected='core';selectedBranch=null;zoom=1;yaw=-.18;tilt=.03;$('inspector').hidden=true;toggleNav(false);draw()});
$('motion').addEventListener('click',()=>{
 paused=!paused;$('motion').textContent=paused?'Resume motion':'Pause motion';
 $('motion').setAttribute('aria-pressed',String(paused));
 lastInput=performance.now();draw()
});
$('motion').textContent=paused?'Resume motion':'Pause motion';
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible)lastFrame=0});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('inspector').hidden=true;toggleNav(false)}
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){yaw+=(e.key==='ArrowLeft'?-.1:.1);draw()}
});
window.addEventListener('resize',resize,{passive:true});
resize();refresh();raf=requestAnimationFrame(frame);
})();