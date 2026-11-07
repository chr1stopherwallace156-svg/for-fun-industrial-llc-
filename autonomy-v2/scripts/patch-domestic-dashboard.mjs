import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=path.resolve(process.argv[2]||"");
const serverFile=path.join(root,"src","server.mjs"),uiFile=path.join(root,"public","index.html");
if(!fs.existsSync(serverFile)||!fs.existsSync(uiFile))throw Error("LIVE_ROOT_NOT_FOUND");
const server=fs.readFileSync(serverFile,"utf8"),html=fs.readFileSync(uiFile,"utf8");
const marker="FI_DOMESTIC_OPPORTUNITIES_V1";
if(server.includes(marker)||html.includes(marker))throw Error("DOMESTIC_ALREADY_PATCHED");
function once(source,anchor,replacement){const i=source.indexOf(anchor);if(i<0||source.indexOf(anchor,i+anchor.length)>=0)throw Error("PATCH_ANCHOR_NOT_UNIQUE: "+anchor.slice(0,90));return source.slice(0,i)+replacement+source.slice(i+anchor.length)}
if(!server.includes("FI_AUTONOMY_8789_PROXY_V1")||!server.includes("FI_AUTONOMY_PLATFORM_ACTIVATION_V1"))throw Error("PLATFORM_INTEGRATION_NOT_PRESENT");
if(!html.includes("FI_AUTONOMY_8789_VIEW_V1"))throw Error("AUTONOMY_VIEW_NOT_PRESENT");
let newServer=once(server,'"/api/autonomy/rea":"/api/rea"}','"/api/autonomy/rea":"/api/rea","/api/autonomy/opportunities":"/api/opportunities"}');
const route=[
' // FI_DOMESTIC_OPPORTUNITIES_V1 — official U.S. source research only, no bids or purchases.',
' if(req.method==="POST"&&req.url==="/api/autonomy/scan"){',
'  if(!localRequest(req,res))return;',
'  try{',
'   const r=await fetch("http://127.0.0.1:8792/api/opportunities/scan",{method:"POST",signal:AbortSignal.timeout(13000),redirect:"error"});',
'   const raw=await r.text();if(raw.length>100000)throw Error("SCAN_RESPONSE_TOO_LARGE");',
'   return json(res,r.status,JSON.parse(raw));',
'  }catch(e){return json(res,503,{error:"DOMESTIC_SCAN_UNAVAILABLE",detail:String(e.message).slice(0,140)})}',
' }',''].join("\n");
const getAnchor=' if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){';
newServer=once(newServer,getAnchor,route+getAnchor);
const viewStart=html.indexOf('<section class="view" id="view-autonomy"');
if(viewStart<0)throw Error("AUTONOMY_VIEW_MISSING");
const viewEnd=html.indexOf("</section>",viewStart);
if(viewEnd<0)throw Error("AUTONOMY_VIEW_NOT_CLOSED");
const section=[
'<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->',
'<div class="card"><div class="heading-row"><h2 class="section-title">U.S. opportunities</h2><button class="btn secondary small" type="button" id="fiDomesticScanBtn">Scan U.S. sources</button></div>',
'<p class="subtle">Official grants, optional federal solicitations and surplus lots, plus verified manual leads. Relevance is not profit.</p>',
'<div class="subtle" id="fiDomesticSummary">Not scanned yet</div>',
'<div id="fiDomesticList" class="stack"></div>',
'<div class="subtle" id="fiDomesticSources"></div></div>',''].join("\n");
let newHtml=html.slice(0,viewEnd)+section+html.slice(viewEnd);
newHtml=once(newHtml,"if(id==='autonomy')void refreshAutonomy();","if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();}");
const functions=[
'/* U.S. opportunity research — same-origin 8789, safely rendered as plain text */',
'async function refreshDomesticOpportunities(){',
' const target=$(\"fiDomesticList\"),summary=$(\"fiDomesticSummary\"),sources=$(\"fiDomesticSources\");',
' try{const r=await api(\"/api/autonomy/opportunities\",undefined,15000);target.replaceChildren();',
'  const list=Array.isArray(r.items)?r.items:[];',
'  summary.textContent=list.length+\" results | Last scanned \"+(r.checkedAt?new Date(r.checkedAt).toLocaleString():\"not yet\")+\" | relevance only, details unverified\";',
'  for(const item of list.slice(0,45)){',
'   const card=document.createElement(\"div\");card.className=\"card flat\";',
'   const title=document.createElement(\"strong\");title.textContent=String(item.title||\"Untitled\").slice(0,200);',
'   const desc=document.createElement(\"p\");desc.className=\"subtle\";desc.textContent=[item.source,item.kind,item.location,item.deadline?\"Deadline: \"+item.deadline:\"\",item.askPrice!=null?\"Observed amount: $\"+item.askPrice:\"\"].filter(Boolean).join(\" | \");',
'   const notes=document.createElement(\"p\");notes.className=\"subtle\";notes.textContent=String(item.summary||\"\").slice(0,380);card.append(title,desc,notes);',
'   if(typeof item.url===\"string\"&&item.url.startsWith(\"https://\")){const link=document.createElement(\"a\");link.href=item.url;link.target=\"_blank\";link.rel=\"noopener noreferrer\";link.textContent=\"Source listing\";card.append(link)}',
'   target.append(card);',
'  }',
'  if(!list.length)target.textContent=\"No leads in latest snapshot. Check source diagnostics.\";',
'  sources.textContent=(r.sources||[]).map(x=>x.name+\": \"+(x.ok?x.count+\" returned\":x.detail)).join(\" | \").slice(0,1100);',
' }catch(error){summary.textContent=\"Domestic research unavailable: \"+error.message;target.replaceChildren();sources.textContent=\"\"}',
'}',
'async function scanDomesticOpportunities(){',
' const b=$(\"fiDomesticScanBtn\");b.disabled=true;',
' try{const r=await api(\"/api/autonomy/scan\",{},15000);log(\"U.S. research \"+(r.state||\"not queued\"));$(\"fiDomesticSummary\").textContent=\"Scan queued. Refresh after the background job completes.\";}',
' catch(e){alert(\"Domestic scan not queued: \"+e.message)}finally{b.disabled=false}',
'}',''].join("\n");
newHtml=once(newHtml,"function bindEvents(){",functions+"function bindEvents(){$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);");
function check(content,suffix){const tmp=path.join(os.tmpdir(),"fi-us-"+process.pid+"-"+suffix+".mjs");try{fs.writeFileSync(tmp,content,"utf8");execFileSync(process.execPath,["--check",tmp],{stdio:"pipe"})}finally{fs.rmSync(tmp,{force:true})}}
check(newServer,"server");
const script=newHtml.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
if(!script)throw Error("INLINE_SCRIPT_NOT_FOUND");check(script[1],"ui");
fs.writeFileSync(serverFile,newServer,"utf8");
try{fs.writeFileSync(uiFile,newHtml,"utf8")}catch(e){fs.writeFileSync(serverFile,server,"utf8");throw e}
console.log("DOMESTIC_8789_SOURCE_PATCHED=PASS");
