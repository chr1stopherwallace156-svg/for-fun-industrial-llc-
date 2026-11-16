/* A local-only spatial browser: user-selected navigation, passive evidence inspection.
   No POST, executable tool routes, model prompt, timers or synthetic readiness. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let snapshot=null,graph=null,selected='core',twoD=false;
const BRANCHES=['core','ai','tools','compute','business','voice','security'];
const ANCHORS={
 core:[0,0,0],ai:[-116,138,4],tools:[116,138,3],compute:[-126,0,48],
 business:[133,4,-36],voice:[-110,-133,4],security:[122,-133,-10]
};
const POINTS={
 qwen:[-177,204,5],memory:[-63,199,13],rea:[165,203,19],review:[72,207,26],
 'compute-engine':[-191,-30,64],ml:[-80,-62,77],buyers:[194,68,-33],procurement:[197,2,-65],
 regulatory:[189,-52,-2],commerce:[91,-64,-89],
 'mobile-voice':[-177,-195,-12],localhost:[201,-190,1],gateway:[81,-198,-17],
 authority:[159,-236,-80]
};
const POINT=(id)=>ANCHORS[id]||POINTS[id]||[0,0,0];
const COLORS={available:'#6de8ce',unverified:'#7895aa',hold:'#f2bb70'};
function stateText(value){return value==='available'?'Verified endpoint':value==='hold'?'Hold':'Not verified'}
function showNode(id){
 if(!snapshot)return;
 const node=snapshot.nodes.find(n=>n.id===id);if(!node)return;
 selected=id;$('node-title').textContent=node.name;
 $('node-description').textContent=node.description;
 $('node-state').textContent=stateText(node.state);
 const match=snapshot.evidence.find(e=>e.node===id);
 $('node-evidence').textContent=match?match.source:'No direct endpoint evidence';
 const a=$('open-module');
 if(node.view&&/^#[a-z-]+$/.test(node.view)){
  a.hidden=false;a.href='http://127.0.0.1:8802/'+node.view;
  a.textContent='Open in existing PC dashboard · 8802';
 }else a.hidden=true;
 for(const b of $('node-list').children)b.classList.toggle('active',b.dataset.node===id);
 if(graph&&!twoD&&id!=='core'){
  const node3=graph.graphData().nodes.find(n=>n.id===id);
  if(node3){const dist=160;graph.cameraPosition({x:node3.x+dist,y:node3.y+55,z:node3.z+dist},node3,750)}
 }
}
function renderList(){
 $('node-list').replaceChildren();
 for(const n of snapshot.nodes){
  const b=document.createElement('button');b.type='button';b.dataset.node=n.id;
  b.textContent=n.name;
  const s=document.createElement('small');s.textContent=n.state==='available'?'●':'○';s.style.color=COLORS[n.state]||COLORS.unverified;
  b.append(s);b.addEventListener('click',()=>showNode(n.id));$('node-list').append(b)
 }
}
const NS='http://www.w3.org/2000/svg';
function svgEl(name,props){
 const e=document.createElementNS(NS,name);
 for(const[k,v]of Object.entries(props||{}))e.setAttribute(k,String(v));
 return e
}
function fallback(){
 if(graph){try{graph.pauseAnimation()}catch{}}
 $('graph').hidden=true;$('fallback').hidden=false;
 const area=$('fallback');area.replaceChildren();
 const svg=svgEl('svg',{viewBox:'-280 -290 560 570',role:'group','aria-label':'Interactive 2D spatial topology'});
 for(const l of snapshot.links){
  const a=POINT(l.source),b=POINT(l.target);
  svg.append(svgEl('line',{x1:a[0],y1:-a[1],x2:b[0],y2:-b[1],stroke:'#375e72','stroke-width':2,'stroke-opacity':'.85'}))
 }
 for(const n of snapshot.nodes){
  const p=POINT(n.id),g=svgEl('g',{tabindex:'0',role:'button','aria-label':n.name+' '+stateText(n.state)});
  const circle=svgEl('circle',{cx:p[0],cy:-p[1],r:n.id==='core'?30:BRANCHES.includes(n.id)?22:13,
   fill:COLORS[n.state]||COLORS.unverified,'fill-opacity':'.85',stroke:'#c6f5eb','stroke-width':1});
  const text=svgEl('text',{x:p[0],y:-p[1]+(n.id==='core'?48:BRANCHES.includes(n.id)?36:27),
   'font-family':'system-ui','font-size':n.id==='core'?12:10,fill:'#e1f7fc','text-anchor':'middle'});
  text.textContent=n.id==='core'?'FUN INDUSTRIAL':n.name;
  g.append(circle,text);g.addEventListener('click',()=>showNode(n.id));
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showNode(n.id)}});
  svg.append(g)
 }
 area.append(svg);$('mode').textContent='Try 3D';
 $('scene-status').textContent='2D fallback · '+snapshot.nodes.length+' capabilities';
}
function webgl(){
 try{
  const c=document.createElement('canvas');
  return !!(window.WebGLRenderingContext&&(c.getContext('webgl',{failIfMajorPerformanceCaveat:true})||c.getContext('experimental-webgl')))
 }catch{return false}
}
function render3D(){
 if(!window.ForceGraph3D||!webgl()||window.matchMedia('(prefers-reduced-motion: reduce)').matches){fallback();return}
 const area=$('graph');area.hidden=false;$('fallback').hidden=true;
 if(graph){try{graph._destructor?.()}catch{}graph=null}area.replaceChildren();
 const mobile=window.innerWidth<720;
 try{
  const nodes=snapshot.nodes.map(n=>{const p=POINT(n.id);return {...n,fx:p[0],fy:p[1],fz:p[2],val:n.id==='core'?22:BRANCHES.includes(n.id)?11:5}});
  const links=snapshot.links.map(l=>({...l}));
  graph=window.ForceGraph3D({controlType:'orbit',rendererConfig:{antialias:!mobile,alpha:false}})(area)
   .graphData({nodes,links}).backgroundColor('#0b1c29')
   .nodeId('id').nodeVal('val').nodeColor(n=>COLORS[n.state]||COLORS.unverified)
   .nodeLabel(n=>n.name+' — '+stateText(n.state))
   .linkColor(l=>l.source?.state==='available'?'#5cae9f':'#3c6c83')
   .linkWidth(1.4).linkOpacity(.7).linkDirectionalParticles(mobile?0:1)
   .linkDirectionalParticleWidth(1.8).linkDirectionalParticleSpeed(.002)
   .onNodeClick(n=>showNode(n.id)).onNodeHover(n=>{area.style.cursor=n?'pointer':'grab'})
   .width(area.clientWidth||720).height(area.clientHeight||520).showNavInfo(false);
  try{graph.renderer().setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.2:1.5))}catch{}
  graph.cameraPosition({x:0,y:50,z:470},{x:0,y:0,z:0},0);
  $('scene-status').textContent='3D map · '+nodes.length+' capabilities';
  $('mode').textContent='Switch to 2D'
 }catch(error){fallback();$('scene-status').textContent='WebGL unavailable · accessible 2D view'}
}
async function refresh(){
 const b=$('refresh');b.disabled=true;$('scene-status').textContent='Reading local status endpoints…';
 try{
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),11000);
  let response;try{response=await fetch('/api/spatial-v3/status',{method:'GET',headers:{accept:'application/json'},cache:'no-store',signal:ctl.signal})}
  finally{clearTimeout(timer)}
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(data.version!=='fun-industrial-spatial-system-v3-preview-1'||data.read_only!==true||
    !Array.isArray(data.nodes)||data.nodes.length<15||data.nodes.length>40||
    !Array.isArray(data.links)||!Array.isArray(data.evidence)||data.external_actions!==0||data.tools_called!==0||data.model_calls!==0)
     throw Error('Unexpected read-only evidence schema');
  snapshot=data;renderList();
  if(twoD)fallback();else render3D();showNode(selected);
  const verified=data.nodes.filter(n=>n.state==='available').length;
  $('scene-status').textContent=(twoD||$('graph').hidden?'2D':'3D')+' · '+verified+' verified service nodes · '+data.observed_at;
 }catch(error){
  $('scene-status').textContent='Evidence unavailable · '+error.message+' · no actions attempted';
  if(!snapshot){snapshot={nodes:[{id:'core',name:'FUN INDUSTRIAL',group:'core',description:'No verified observations yet',state:'unverified'}],links:[],evidence:[]};renderList();fallback();showNode('core')}
 }finally{b.disabled=false}
}
$('refresh').addEventListener('click',refresh);
$('mode').addEventListener('click',()=>{if(!snapshot)return;twoD=!twoD;twoD?fallback():render3D();showNode(selected)});
window.addEventListener('resize',()=>{if(graph&&!twoD)graph.width($('graph').clientWidth).height($('graph').clientHeight)});
document.addEventListener('visibilitychange',()=>{if(graph){if(document.hidden)graph.pauseAnimation();else if(!twoD)graph.resumeAnimation()}});
refresh();
})();