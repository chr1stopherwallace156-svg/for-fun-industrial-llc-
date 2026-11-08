import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {workerHttp,workerService,workerJobs,platformServer,platformUi} from "../scripts/retire-sourcing-transform.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const file=p=>readFileSync(join(root,p),"utf8");
const check=(source,suffix)=>{
 const dest=join(tmpdir(),"fi-retire-"+process.pid+"-"+suffix+".mjs");
 try{writeFileSync(dest,source);execFileSync(process.execPath,["--check",dest],{stdio:"pipe"})}finally{rmSync(dest,{force:true})}
};
test("worker HTTP retires source APIs but keeps REA and research",()=>{
 const s=workerHttp(file("src/http.mjs"));
 check(s,"worker-http");
 assert.match(s,/FI_SOURCING_RETIRED_V1/);
 assert.match(s,/error:"SOURCING_RETIRED"/);
 for(const route of ["/api/opportunities/scan","/api/opportunities","/api/international","/api/rea","/api/research"])
  assert.ok(s.includes(route));
 assert.doesNotMatch(s,/sidequest\.build\(DomesticScan\)/);
 assert.throws(()=>workerHttp(s),/ALREADY_RETIRED/);
});
test("startup preserves non-sourcing schedules and stops new domestic ones",()=>{
 const s=workerService(file("src/service.mjs"));
 check(s,"worker-service");
 for(const name of ["Discover","Registry","Research","ProductSnapshot"])assert.ok(s.includes("build("+name+")"));
 assert.doesNotMatch(s,/build\(DomesticScan\)/);
 assert.throws(()=>workerService(s),/ALREADY_RETIRED/);
});
test("persisted old domestic jobs remain resolvable and do zero network work",()=>{
 const s=workerJobs(file("src/jobs.mjs"));
 check(s,"worker-jobs");
 assert.match(s,/class DomesticScan extends Job/);
 assert.match(s,/networkCalls:0/);
 assert.doesNotMatch(s,/scanDomestic/);
 assert.match(s,/class Followup extends Job/);
});
const serverFixture=[
 'const autonomyPaths={"/api/autonomy/rea":"/api/rea","/api/autonomy/opportunities":"/api/opportunities","/api/autonomy/international":"/api/international"};',
 ' // FI_DOMESTIC_OPPORTUNITIES_V1',
 ' if(req.method==="POST"&&req.url==="/api/autonomy/scan"){return json(res,200,{state:"queued"})}',
 ' if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){return json(res,200,{ok:true})}'
].join("\n");
test("8789 drops sourcing proxy routes and retains REA",()=>{
 const s=platformServer(serverFixture);
 assert.match(s,/FI_SOURCING_RETIRED_V1/);
 assert.match(s,/SOURCING_RETIRED/);
 assert.doesNotMatch(s,/"\/api\/autonomy\/opportunities":"\/api\/opportunities"/);
 assert.doesNotMatch(s,/"\/api\/autonomy\/international":"\/api\/international"/);
 assert.ok(s.includes('"/api/autonomy/rea":"/api/rea"'));
});
function fixture(intl){
 const panel=(intl?'<!-- FI_INTERNATIONAL_SOURCE_V1 -->\n<div><button id="fiIntlRefresh"></button></div>\n':'')+
 '<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->\n<div><button id="fiDomesticScanBtn"></button></div>';
 const callbacks=intl?"if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();void refreshInternational();}":"if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();}";
 const listeners="function bindEvents(){$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);"+
 (intl?"$('fiIntlRefresh').addEventListener('click',refreshInternational);for(const id of ['fiIntlCountry','fiIntlCategory','fiIntlQuery'])$(id).addEventListener('input',renderInternational);":"")+
 "return 'preserved';}";
 const fns="/* U.S. opportunity research — same-origin 8789, safely rendered as plain text */\n"+
 (intl?"let fiIntlCache=null;function refreshInternational(){}\n":"")+
 "function refreshDomesticOpportunities(){}function scanDomesticOpportunities(){}\n";
 return '<html><body><section class="view" id="view-autonomy"><div>Keep non-sourcing content</div>'+panel+
 '</section><script>\nfunction refreshAutonomy(){}\nfunction go(id){'+callbacks+'}\n'+fns+listeners+'\n</script></body></html>';
}
for(const intl of [false,true])test("removes "+(intl?"both sourcing panels":"domestic panel")+" while preserving Autonomy",()=>{
 const s=platformUi(fixture(intl));
 assert.match(s,/FI_SOURCING_RETIRED_V1/);
 assert.match(s,/Keep non-sourcing content/);
 assert.match(s,/refreshAutonomy/);
 assert.doesNotMatch(s,/fiDomesticScanBtn|fiIntlRefresh|scanDomesticOpportunities/);
 const m=s.match(/<script>([\s\S]*?)<\/script>/);assert.ok(m);check(m[1],"ui-"+intl);
 assert.throws(()=>platformUi(s),/ALREADY_RETIRED/);
});
test("unrecognized source versions fail closed",()=>{
 assert.throws(()=>platformUi("<html></html>"),/UI_PANEL_BOUNDARY_MISSING/);
 assert.throws(()=>platformServer('const autonomyPaths={};'),/RETIRE_ANCHOR_NOT_UNIQUE/);
 assert.throws(()=>workerHttp("const x=1"),/RETIRE_ANCHOR_NOT_UNIQUE/);
});
