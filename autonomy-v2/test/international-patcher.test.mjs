import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const patch=fileURLToPath(new URL("../scripts/patch-international-dashboard.mjs",import.meta.url));
test("patches existing qualified 8789 domestic UI, same-origin read-only API, and rejects duplicates",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"fi-intl-patch-"));
 try{
  fs.mkdirSync(path.join(root,"src"));fs.mkdirSync(path.join(root,"public"));
  fs.writeFileSync(path.join(root,"src/server.mjs"),[
   'const server={};',
   '// FI_AUTONOMY_8789_PROXY_V1',
   '// FI_DOMESTIC_OPPORTUNITIES_V1',
   'const autonomyPaths={"/api/autonomy/opportunities":"/api/opportunities"};'
  ].join("\n"));
  fs.writeFileSync(path.join(root,"public/index.html"),[
   '<!doctype html><html><main>',
   '<!-- FI_AUTONOMY_8789_VIEW_V1 -->',
   '<section class="view" id="view-autonomy">',
   '<!-- FI_DOMESTIC_OPPORTUNITIES_V1 -->',
   '<button id="fiDomesticScanBtn"></button>',
   '</section></main><script>',
   'const $=id=>document.getElementById(id);async function api(){}',
   'function refreshAutonomy(){}',
   "function go(id){if(id==='autonomy'){void refreshAutonomy();void refreshDomesticOpportunities();}}",
   'async function refreshDomesticOpportunities(){}',
   "function bindEvents(){$('fiDomesticScanBtn').addEventListener('click',scanDomesticOpportunities);}",
   'function scanDomesticOpportunities(){}',
   '</script></html>'
  ].join("\n"));
  const result=spawnSync(process.execPath,[patch,root],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const s=fs.readFileSync(path.join(root,"src/server.mjs"),"utf8");
  const h=fs.readFileSync(path.join(root,"public/index.html"),"utf8");
  assert.match(s,/\/api\/autonomy\/international/);
  assert.match(h,/International sourcing intelligence/);
  assert.match(h,/function refreshInternational/);
  assert.match(h,/id="fiIntlCountry"/);
  assert.match(h,/FI_DOMESTIC_OPPORTUNITIES_V1/);
  const again=spawnSync(process.execPath,[patch,root],{encoding:"utf8"});
  assert.notEqual(again.status,0);assert.match(again.stderr,/INTERNATIONAL_ALREADY_PATCHED/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
