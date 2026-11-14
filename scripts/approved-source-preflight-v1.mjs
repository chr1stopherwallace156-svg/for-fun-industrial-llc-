import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {Script} from "node:vm";
import {preflightCollection} from "../src/cognition/approved-collection-bridge-v1.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const html=fs.readFileSync(path.join(root,"public/index.html"),"utf8");
const server=fs.readFileSync(path.join(root,"src/server.mjs"),"utf8");
if(!html.includes('id="fiGroundedResearch"')||!html.includes('fiSelectedSourceUrl')||!html.includes("fiApproveCollectSource")||!html.includes('fiGroundedClaim'))throw Error("WEB_RESEARCH_UI_INTEGRATION_HOLD");
if(!server.includes('"/api/research/collect-source"')||!server.includes('"/api/research/grounded-answer"')||!server.includes("x-fi-source-approval"))throw Error("RESEARCH_ROUTE_INTEGRATION_HOLD");
let count=0;for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){const content=match[1];if(content.trim()){new Script(content,{filename:"dashboard-inline-"+(++count)+".js"})}}
if(count<1)throw Error("NO_DASHBOARD_SCRIPTS");
console.log("DASHBOARD_INLINE_JS_SYNTAX=PASS SCRIPTS="+count);
console.log("RESEARCH_UI_AND_ROUTES=PASS");
const [database,python,plan_id,task_id]=process.argv.slice(2);
if(database||python||plan_id||task_id){const ready=preflightCollection({database,python,plan_id,task_id});console.log("LIVE_EVIDENCE_READONLY_PREFLIGHT=PASS RECORDS="+ready.evidence_records)}
