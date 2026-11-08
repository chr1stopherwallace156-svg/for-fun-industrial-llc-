import test from "node:test";
import assert from "node:assert/strict";
import {patchIntelligenceServer} from "../scripts/patch-local-intelligence.mjs";
const fixture=['import {createAutonomyActivator} from "./autonomy-activation.mjs";',
'// FI_SOURCING_RETIRED_V1',
'const server=http.createServer(async(req,res)=>{try{',
' if(req.method==="GET"&&req.url==="/api/autonomy/status")return json(res,200,{});',
'});'].join("\n");
test("additive patch inserts intelligence endpoints while preserving retired sourcing",()=>{
 const result=patchIntelligenceServer(fixture);
 assert.match(result,/FI_SOURCING_RETIRED_V1/);
 assert.match(result,/FI_LOCAL_INTELLIGENCE_V1/);
 assert.match(result,/\/api\/intelligence\/status/);
 assert.match(result,/\/api\/intelligence\/evaluate/);
 assert.match(result,/\/api\/intelligence\/memory\/remember/);
 assert.match(result,/\/api\/autonomy\/status/);
 assert.throws(()=>patchIntelligenceServer(result),/INTELLIGENCE_ALREADY_INSTALLED/);
});
test("no retirement marker or wrong source version fails closed",()=>{
 assert.throws(()=>patchIntelligenceServer(fixture.replace("FI_SOURCING_RETIRED_V1","OLD_SOURCING")) ,/SOURCING_RETIREMENT_REQUIRED/);
 assert.throws(()=>patchIntelligenceServer("FI_SOURCING_RETIRED_V1"),/INTELLIGENCE_ANCHOR_HOLD/);
});
