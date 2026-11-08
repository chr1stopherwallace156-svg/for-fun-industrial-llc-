// Inspect deployed Cognee adapter identity and its error boundary.
// Default: NO memory request, subprocess, or service change.
// --replay-recall: only after hashes match; runs existing recall, never remember.
import {createHash} from "node:crypto";
import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const checkout=fileURLToPath(new URL("../",import.meta.url));
const root=process.env.USERPROFILE;
if(process.platform!=="win32"||!root)throw Error("WINDOWS_PROFILE_REQUIRED");
const expected=join(checkout,"src","intelligence","memory.mjs");
const deployed=join(root,"FunIndustrial-REA-MCP-Activation","src","intelligence","memory.mjs");
if(!existsSync(expected)||!existsSync(deployed))throw Error("MEMORY_ADAPTER_SOURCE_MISSING");
const source=readFileSync(expected);
const actual=readFileSync(deployed);
const hash=x=>createHash("sha256").update(x).digest("hex");
const equal=source.equals(actual);
console.log("ADAPTER_SOURCE_MATCH="+equal);
console.log("GITHUB_CHECKOUT_SHA256="+hash(source));
console.log("DEPLOYED_ADAPTER_SHA256="+hash(actual));
console.log("DEPLOYED_ADAPTER_BYTE_LENGTH="+actual.length);
console.log("DEPLOYED_HAS_ERROR_WRAPPER="+actual.includes(Buffer.from('COGNEE_OPERATION_FAILED:')));
const module=await import(pathToFileURL(deployed).href);
const status=module.memoryStatus();
console.log("ADAPTER_AVAILABLE="+status.available+" ENABLED="+status.enabled);
const facts=e=>{
 const object=e!==null&&(typeof e==="object"||typeof e==="function");
 const names=object?Object.getOwnPropertyNames(e).slice(0,25):[];
 console.log("EXCEPTION_IS_NATIVE_ERROR="+(e instanceof Error));
 console.log("EXCEPTION_TYPE="+typeof e);
 console.log("EXCEPTION_TAG="+Object.prototype.toString.call(e));
 console.log("EXCEPTION_KEYS="+JSON.stringify(names));
 console.log("EXCEPTION_MESSAGE="+(typeof e?.message==="string"?e.message.slice(0,400):"<absent>"));
 console.log("EXCEPTION_CODE="+(typeof e?.code==="string"?e.code.slice(0,100):"<absent>"));
 console.log("EXCEPTION_CAUSE_TYPE="+(e?.cause==null?"<absent>":typeof e.cause));
};
try {
 await module.memoryAction("recall",{diagnostic_only:true});
 console.log("VALIDATION_REJECTION=UNEXPECTED_ACCEPT");
 process.exitCode=4;
} catch(e) {
 console.log("VALIDATION_REJECTION="+(e instanceof Error&&e.message==="COGNEE_INPUT_INVALID"?"PASS":"HOLD"));
 if(!(e instanceof Error)||e.message!=="COGNEE_INPUT_INVALID")facts(e);
}
if(!equal){
 console.log("DEPLOYED_SOURCE_MISMATCH=HOLD_NO_RECALL_RUN");
 process.exitCode=5;
}else if(process.argv.includes("--replay-recall")&&process.exitCode===undefined){
 console.log("NODE_RECALL=START NO_REMEMBER NO_REA NO_RESTART");
 try {
  const response=await module.memoryAction("recall",{query:"Fun Industrial requires operator approval before executing external tools."});
  console.log("NODE_RECALL=PASS RESULT_COUNT="+(Array.isArray(response?.results)?response.results.length:"unknown"));
  console.log("RETRIEVED_TEXT_NOT_PRINTED=true");
 } catch(e) {
  console.log("NODE_RECALL=HOLD");
  facts(e);
  process.exitCode=7;
 }
}else if(!process.argv.includes("--replay-recall")){
 console.log("ADAPTER_ATTESTATION_ONLY=PASS_NO_PYTHON_RECALL");
}
