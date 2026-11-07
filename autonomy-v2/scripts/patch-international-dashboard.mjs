// Guarded same-origin international source view retrofit for the qualified 8789 dashboard.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=path.resolve(process.argv[2]||"");
const serverFile=path.join(root,"src/server.mjs"),uiFile=path.join(root,"public/index.html");
if(!fs.existsSync(serverFile)||!fs.existsSync(uiFile))throw Error("PLATFORM_FILES_NOT_FOUND");
const server=fs.readFileSync(serverFile,"utf8"),ui=fs.readFileSync(uiFile,"utf8"),marker="FI_INTERNATIONAL_SOURCE_V1";
if(server.includes(marker)||ui.includes(marker))throw Error("INTERNATIONAL_ALREADY_PATCHED");
function once(text,anchor,replacement){const i=text.indexOf(anchor);if(i<0||text.indexOf(anchor,i+1)>=0)throw Error("INTL_PATCH_ANCHOR_HOLD "+anchor.slice(0,55));return text.slice(0,i)+replacement+text.slice(i+anchor.length)}
if(!server.includes("FI_AUTONOMY_8789_PROXY_V1")||!server.includes("FI_DOMESTIC_OPPORTUNITIES_V1"))throw Error("UNIFIED_DOMESTIC_PROXY_REQUIRED");
if(!ui.includes("FI_AUTONOMY_8789_VIEW_V1")||!ui.includes("FI_DOMESTIC_OPPORTUNITIES_V1"))throw Error("UNIFIED_DOMESTIC_UI_REQUIRED");
const nextServer=once(server,'"/api/autonomy/opportunities":"/api/opportunities"}','"/api/autonomy/opportunities":"/api/opportunities","/api/autonomy/international":"/api/international"} /* FI_INTERNATIONAL_SOURCE_V1 */');
const block=[
 '<!-- FI_INTERNATIONAL_SOURCE_V1 -->',
 '<div class="card"><h2 class="section-title">International sourcing intelligence</h2>',
 '<p class="subtle">Japan, South Korea and Vietnam. Official source directory and operator-reviewed inventory; not automated site scraping or a profit guarantee.</p>',
 '<div class="controls" style="display:flex;gap:8px;flex-wrap:wrap">',
 '<select id="fiIntlCountry" aria-label="Country"><option value="">All countries</option><option value="JP">Japan</option><option value="KR">South Korea</option><option value="VN">Vietnam</option></select>',
 '<select id="fiIntlCategory" aria-label="Category"><option value="">All categories</option></select>',
 '<input id="fiIntlQuery" type="search" placeholder="Maker, model, item, city" maxlength="90" aria-label="Search imported opportunities">',
 '<button type="button" class="btn secondary small" id="fiIntlRefresh">Refresh international research</button></div>',
 '<div class="subtle" id="fiIntlStatus">Loading registered sources...</div>',
 '<h3>Registered international sources</h3><div id="fiIntlSources" class="stack"></div>',
 '<h3>Imported sourcing candidates</h3><div id="fiIntlItems" class="stack"></div>',
 '<p class="subtle">Import an approved-source CSV/JSON file with the Windows command in the runbook. Export permission, real stock, duties and profit are unverified. No bids or purchases.</p>',
 '</div>'
].join("\n");
let html=once(ui,"<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->",block+"\n<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->");
html=once(html,"if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();}","if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();void refreshInternational();}");
const js=[
'let fiIntlCache=null;',
'function fiIntlText(tag,contents,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=String(contents??"");return el;}',
'function renderInternational(){',
' const status=$("fiIntlStatus"),sources=$("fiIntlSources"),items=$("fiIntlItems");if(!fiIntlCache)return;',
' const x=fiIntlCache,country=$("fiIntlCountry").value,category=$("fiIntlCategory").value,query=$("fiIntlQuery").value.trim().toLowerCase();',
' sources.replaceChildren();items.replaceChildren();',
' const registered=(x.sources||[]).filter(s=>!country||s.country===country||s.country==="GLOBAL");',
' for(const s of registered.slice(0,30)){',
'  const box=fiIntlText("div","","card flat");box.append(fiIntlText("strong",s.name),fiIntlText("p",[s.country,s.kind,s.access,s.inventory].filter(Boolean).join(" | "),"subtle"));',
'  const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Open public source";box.append(a);',
'  box.append(fiIntlText("p",s.notes||"","subtle"));sources.append(box);',
' }',
' const found=(x.items||[]).filter(i=>(!country||i.country===country)&&(!category||i.category===category)&&',
'  (!query||[i.title,i.titleLocal,i.manufacturer,i.model,i.city,i.region,i.description].join(" ").toLowerCase().includes(query)));',
' for(const i of found.slice(0,45)){',
'  const box=fiIntlText("div","","card flat");box.append(fiIntlText("strong",i.title));',
'  const detail=[i.countryName,i.category,i.manufacturer,i.model,i.city,i.region,i.originPortName,i.quantity?"Quantity "+i.quantity+" "+i.unit:"",i.priceLocal!==null?"Observed "+i.currency+" "+i.priceLocal+" ("+i.priceType+", "+i.priceBasis+")":"Price unavailable"].filter(Boolean).join(" | ");',
'  box.append(fiIntlText("p",detail,"subtle"),fiIntlText("p",[i.condition,i.description,"Export eligibility "+i.exportEligible].filter(Boolean).join(" — ").slice(0,450),"subtle"));',
'  if(i.sourceUrl&&i.sourceUrl.startsWith("https://")){const a=document.createElement("a");a.href=i.sourceUrl;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Source listing";box.append(a)}',
'  const last=Date.parse(i.sourceLastImportedAt||i.observedAt||"");if(!Number.isFinite(last)||Date.now()-last>=86400000)box.append(fiIntlText("p","Stale or unverified listing freshness; recheck original source before any financial decision.","subtle"));',
'  items.append(box);',
' }',
' if(!found.length)items.append(fiIntlText("p","No imported listings match. The source directory is not live inventory.","subtle"));',
' status.textContent=(x.summary?.total||0)+" imported candidates | "+(x.stale?"IMPORT STALE OR NOT YET PROVIDED":"Last imported "+new Date(x.importedAt).toLocaleString())+" | automatic international feeds: "+(x.autoSourcesActive||0)+" | shown "+Math.min(found.length,45);',
'}',
'async function refreshInternational(){',
' try{const r=await api("/api/autonomy/international",undefined,15000);fiIntlCache=r;',
'  const cats=$("fiIntlCategory");if(cats.options.length<=1)for(const c of r.categories||[]){const o=document.createElement("option");o.value=c;o.textContent=c.replaceAll("_"," ");cats.append(o)}',
'  renderInternational();',
' }catch(e){$("fiIntlStatus").textContent="International research unavailable: "+String(e.message).slice(0,120)}',
'}'
].join("\n")+"\n";
html=once(html,"async function refreshDomesticOpportunities(){",js+"async function refreshDomesticOpportunities(){");
html=once(html,"$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);","$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);$('fiIntlRefresh').addEventListener('click',refreshInternational);for(const id of ['fiIntlCountry','fiIntlCategory','fiIntlQuery'])$(id).addEventListener('input',renderInternational);");
function check(script,name){const temp=path.join(os.tmpdir(),"fi-international-"+process.pid+"-"+name+".mjs");try{fs.writeFileSync(temp,script);execFileSync(process.execPath,["--check",temp],{stdio:"pipe"})}finally{fs.rmSync(temp,{force:true})}}
check(nextServer,"server");
const m=html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
if(!m)throw Error("DASHBOARD_SCRIPT_NOT_FOUND");
check(m[1],"ui");
fs.writeFileSync(serverFile,nextServer,"utf8");
try{fs.writeFileSync(uiFile,html,"utf8")}catch(e){fs.writeFileSync(serverFile,server,"utf8");throw e}
console.log("INTERNATIONAL_8789_PATCH=PASS");
