// Import a single official API download into Fun Industrial's existing data store.
// Called only after the Windows HTTPS fetcher verifies the allowlisted GSA redirect.
// No networking, bidding, payments, passwords, account actions, REA or AI execution.
import {readFileSync,statSync} from "node:fs";
import {resolve,isAbsolute} from "node:path";
import {gsaImportDocument} from "./src/gsa-bridge.mjs";
import {atomicJSON,logEvent,HOME} from "./src/core.mjs";
import {fileURLToPath} from "node:url";
export function importFromFile(filename,{persist=true}={}){
 if(typeof filename!=="string"||!isAbsolute(filename))throw Error("ABSOLUTE_INPUT_PATH_REQUIRED");
 const size=statSync(filename).size;
 if(size<2||size>25_000_000)throw Error("GSA_RESPONSE_SIZE_OUT_OF_RANGE");
 const raw=JSON.parse(readFileSync(filename,"utf8"));
 const record=gsaImportDocument(raw);
 if(persist){
  atomicJSON("gsa-import.json",record);
  logEvent("gsa_official_snapshot_imported",{count:record.activeCount,expiresAt:record.expiresAt,source:record.source,digestPrefix:record.digest.slice(0,12)});
 }
 return {imported:record.activeCount,allParsed:record.lotCount,checkedAt:record.checkedAt,expiresAt:record.expiresAt,dataFolder:HOME,stored:persist};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const filename=process.argv[2];
  if(!filename)throw Error("INPUT_FILE_REQUIRED");
  const result=importFromFile(filename);
  console.log("GSA_IMPORT=PASS AUCTION_LOTS_IMPORTED="+result.imported+" ALL_LOTS_PARSED="+result.allParsed);
  console.log("OBSERVED_AT="+result.checkedAt+" EXPIRES_AT="+result.expiresAt);
  console.log("SOURCE=OFFICIAL_GSA_API DOWNLOAD=OPERATOR_MANUAL REA_CALLS=0");
  console.log("BIDS=0 PURCHASES=0 SECRETS_STORED=0");
 }catch(e){
  console.error("GSA_IMPORT=FAILED REASON="+String(e?.message||e).slice(0,200));
  process.exitCode=1;
 }
}
