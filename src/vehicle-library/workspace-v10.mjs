import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {libraryRoot,inspect,graph,VEHICLES} from './v9.mjs';

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fun Industrial | Vehicle Workspace</title><style>
:root{color-scheme:dark}body{font:15px system-ui;background:#0d1420;color:#e7eef8;margin:0;padding:20px}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap}h1{font-size:24px}main{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px}.panel{border:1px solid #35475d;border-radius:12px;padding:16px;background:#172331;margin-bottom:14px}button,select{background:#24354a;color:#fff;border:1px solid #50647c;border-radius:8px;padding:8px;cursor:pointer}button{display:block;margin:6px 0;text-align:left;width:100%}button:focus-visible{outline:2px solid #8cc6ff}.muted{color:#b0bfd1}#graph{width:100%;height:340px;border:1px solid #36465a;border-radius:8px}#files a{color:#9ed1ff}#viewer{height:300px;border:1px dashed #50647c;border-radius:8px;display:grid;place-items:center;text-align:center;padding:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}svg text{fill:#fff;font:12px system-ui}@media(max-width:720px){main{grid-template-columns:1fr}}
</style><header><h1>Fun Industrial Vehicle Workspace</h1><span class="muted">V10 • read-only • engineering unapproved</span></header><main><aside><section class="panel"><label>Vehicle <select id="vehicle"><option>F-450</option><option>F-550</option><option>E-450</option></select></label><p>Year <select id="year"><option>2026</option></select></p><h3>Configurations</h3><div id="configs"></div></section></aside><article><section class="panel"><h2 id="heading">Select configuration</h2><p id="status" class="muted"></p><h3>Source documents and engineering artifacts</h3><div id="files"></div></section><section class="panel"><h3>Source relationship graph</h3><svg id="graph" viewBox="0 0 800 340" role="img" aria-label="Configuration source relationship graph"></svg></section><section class="panel"><h3>3D model</h3><div id="viewer">No verified 3D preview available. Attached STEP/FCStd files remain available for opening in FreeCAD. GLB visualization is a future integration.</div></section></article></main>
<script>
const $=id=>document.getElementById(id),api=async p=>{const r=await fetch(p);if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
let selected=null,db=null;
function node(tag,text,parent){const el=document.createElement(tag);el.textContent=text;parent.appendChild(el);return el}
async function refresh(){const v=$('vehicle').value,y=$('year').value;selected=null;$('configs').replaceChildren();$('files').replaceChildren();$('graph').replaceChildren();$('heading').textContent='Select configuration';$('status').textContent='';db=await api('/api/v10/configurations?vehicle='+encodeURIComponent(v)+'&year='+y);if(!db.configurations.length)node('p','No configurations registered yet. Register one using the V9 CLI.',$('configs'));for(const c of db.configurations){const b=node('button',c.id+' — '+c.cab,$('configs'));b.onclick=()=>show(c)}}
async function show(c){selected=c;$('heading').textContent=c.vehicle+' '+c.year+' / '+c.id;$('status').textContent='Geometry: '+c.geometryStatus+' • Engineering approved: NO';const files=$('files');files.replaceChildren();node('h4','Source references ('+c.sourceIds.length+')',files);for(const s of c.sourceIds)node('p','SHA-256: '+s,files);node('h4','Artifacts ('+c.artifacts.length+')',files);for(const a of c.artifacts){const p=node('p',a.kind+' — '+a.originalName+' ',files);const link=node('a','Open file',p);link.href='/api/v10/artifact?vehicle='+encodeURIComponent(c.vehicle)+'&year='+c.year+'&id='+encodeURIComponent(c.id)+'&kind='+encodeURIComponent(a.kind)+'&hash='+encodeURIComponent(a.sha256);link.rel='noopener';link.target='_blank'}if(!c.artifacts.length)node('p','No artifacts attached yet.',files);const g=await api('/api/v10/graph?vehicle='+encodeURIComponent(c.vehicle)+'&year='+c.year);draw(g,c.id)}
function draw(g,id){const svg=$('graph');svg.replaceChildren();const relevant=new Set(['vehicle:'+db.vehicle+':'+db.year,'config:'+id]);for(const e of g.edges){if(e.from==='config:'+id){relevant.add(e.to)}if(e.from.startsWith('artifact:')&&g.edges.some(x=>x.from==='config:'+id&&x.to===e.from)){relevant.add(e.from);relevant.add(e.to)}}const nodes=g.nodes.filter(n=>relevant.has(n.id));const pos=new Map(nodes.map((n,i)=>[n.id,{x:100+(i%4)*195,y:55+Math.floor(i/4)*95}]));const ns='http://www.w3.org/2000/svg';for(const e of g.edges){if(!pos.has(e.from)||!pos.has(e.to))continue;const l=document.createElementNS(ns,'line'),a=pos.get(e.from),b=pos.get(e.to);for(const [k,v] of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#5e89b5','stroke-width':2}))l.setAttribute(k,v);svg.appendChild(l)}for(const n of nodes){const p=pos.get(n.id),r=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:p.x-77,y:p.y-22,width:154,height:46,rx:8,fill:n.type==='configuration'?'#24677a':'#29415c',stroke:'#7aa4c9'}))r.setAttribute(k,v);svg.appendChild(r);const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+4);t.setAttribute('text-anchor','middle');t.textContent=n.label.slice(0,20);svg.appendChild(t)}}
$('vehicle').onchange=()=>refresh().catch(e=>$('status').textContent=e.message);refresh().catch(e=>$('status').textContent=e.message);
</script></html>`;

function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
function route(req,res,root){
 const url=new URL(req.url,'http://localhost'),vehicle=url.searchParams.get('vehicle'),year=Number(url.searchParams.get('year')||2026);
 if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
 if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});return res.end(html);}
 if(!VEHICLES.includes(vehicle)||!Number.isInteger(year)||year<2000||year>2100)return json(res,400,{error:'INVALID_VEHICLE'});
 if(url.pathname==='/api/v10/configurations')return json(res,200,inspect({root,vehicle,year}));
 if(url.pathname==='/api/v10/graph')return json(res,200,graph({root,vehicle,year}));
 if(url.pathname==='/api/v10/artifact'){
  const id=url.searchParams.get('id'),kind=url.searchParams.get('kind'),hash=url.searchParams.get('hash');
  const config=inspect({root,vehicle,year}).configurations.find(c=>c.id===id);
  const artifact=config?.artifacts.find(a=>a.kind===kind&&a.sha256===hash);
  if(!artifact||!['CAD','Wiring','Components','Simulations','Evidence'].includes(kind))return json(res,404,{error:'ARTIFACT_NOT_FOUND'});
  const filepath=path.join(root,'Ford',vehicle,String(year),kind,artifact.storedName);
  if(!/^[a-f0-9]{64}\.[a-z0-9]{1,8}$/.test(artifact.storedName)||!fs.existsSync(filepath)||!fs.statSync(filepath).isFile())return json(res,404,{error:'ARTIFACT_MISSING'});
  res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="artifact"','x-content-type-options':'nosniff','cache-control':'no-store'});
  return fs.createReadStream(filepath).pipe(res);
 }
 return json(res,404,{error:'NOT_FOUND'});
}
export function createWorkspaceServer({root=libraryRoot()}={}){return http.createServer((req,res)=>{try{route(req,res,root)}catch(e){json(res,500,{error:'WORKSPACE_HOLD',detail:e.code||'READ_FAILED'})}})}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''))){const server=createWorkspaceServer();server.listen(8798,'127.0.0.1',()=>console.log('FUN_V10=READ_ONLY_WORKSPACE_READY http://127.0.0.1:8798'));}
