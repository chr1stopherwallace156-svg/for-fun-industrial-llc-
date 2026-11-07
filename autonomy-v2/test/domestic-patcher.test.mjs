import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const script=new URL("../scripts/patch-domestic-dashboard.mjs",import.meta.url);
test("guarded 8789 patch adds only domestic routes and view; second patch refuses",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"fi-domestic-test-"));
 try{
  fs.mkdirSync(path.join(root,"src"));fs.mkdirSync(path.join(root,"public"));
  const server=[
   'import http from "node:http";',
   'const server=http.createServer(async(req,res)=>{try{',
   ' // FI_AUTONOMY_8789_PROXY_V1',
   ' const autonomyPaths={"/api/autonomy/rea":"/api/rea"};',
   ' if(req.method==="GET"&&Object.prototype.hasOwnProperty.call(autonomyPaths,req.url)){return;}',
   ' // FI_AUTONOMY_PLATFORM_ACTIVATION_V1',
   '}catch(e){}});',
  ].join("\n");
  const ui=[
   '<!doctype html><html><main>',
   '<!-- FI_AUTONOMY_8789_VIEW_V1 -->',
   '<section class="view" id="view-autonomy"><div>Autonomy</div></section>',
   '</main><script>',
   'const $=id=>document.getElementById(id);',
   'function log(x){}',
   'async function api(a,b,c){return {}}',
   "function go(id){if(id==='autonomy')void refreshAutonomy();}",
   'function refreshAutonomy(){}',
   'function bindEvents(){}',
   '</script></html>'
  ].join("\n");
  fs.writeFileSync(path.join(root,"src","server.mjs"),server);
  fs.writeFileSync(path.join(root,"public","index.html"),ui);
  execFileSync(process.execPath,[fileURLToPath(script),root],{timeout:8000});
  const editedServer=fs.readFileSync(path.join(root,"src","server.mjs"),"utf8");
  const editedHtml=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
  assert.match(editedServer,/\/api\/autonomy\/opportunities/);
  assert.match(editedServer,/req\.method==="POST"&&req\.url==="\/api\/autonomy\/scan"/);
  assert.match(editedHtml,/id="fiDomesticList"/);
  assert.match(editedHtml,/function refreshDomesticOpportunities/);
  assert.match(editedHtml,/fiDomesticScanBtn/);
  assert.throws(()=>execFileSync(process.execPath,[fileURLToPath(script),root],{stdio:"pipe",timeout:8000}),/DOMESTIC_ALREADY_PATCHED/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
