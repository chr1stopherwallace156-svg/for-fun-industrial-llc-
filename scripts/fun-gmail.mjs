// Local operator CLI for Fun Industrial's dedicated Gmail identity.
// This utility is READ ONLY. No write/send/forward/delete methods.
import {existsSync} from "node:fs";
import {connectGmail,gmailLocalPaths,gmailList,gmailProfile,gmailRead,EXPECTED_GMAIL_ACCOUNT} from "../src/gmail/local-gmail.mjs";
const action=process.argv[2]||"status";
try{
 if(action==="status"){
  const paths=gmailLocalPaths();
  console.log("FUN_GMAIL_EXPECTED_ACCOUNT="+EXPECTED_GMAIL_ACCOUNT);
  console.log("FUN_GMAIL_CLIENT_JSON_PRESENT="+existsSync(paths.clientPath));
  console.log("FUN_GMAIL_DPAPI_TOKEN_PRESENT="+existsSync(paths.tokenPath));
  console.log("FUN_GMAIL_SEND_AUTHORITY=false");
  if(existsSync(paths.tokenPath)){
   const p=await gmailProfile();
   console.log("FUN_GMAIL_STATUS="+p.state+" ACCOUNT="+p.emailAddress+" MESSAGE_COUNT="+p.messagesTotal);
  }else console.log("FUN_GMAIL_STATUS=NOT_CONNECTED");
 }else if(action==="connect"){
  const result=await connectGmail();
  console.log("FUN_GMAIL_AUTHORIZATION=PASS ACCOUNT="+result.emailAddress+" PERMISSION=read-only TOKEN=WINDOWS_DPAPI");
 }else if(action==="list"){
  const q=(process.argv.slice(3).join(" ")||"").slice(0,150);
  console.log(JSON.stringify(await gmailList({maxResults:10,query:q}),null,2));
 }else if(action==="read"){
  const id=process.argv[3];
  console.log(JSON.stringify(await gmailRead(id),null,2));
 }else{
  console.error("USAGE=node scripts/fun-gmail.mjs status|connect|list [query]|read <message-id>");
  process.exitCode=2;
 }
}catch(e){
 console.error("FUN_GMAIL_HOLD="+String(e?.message||"UNKNOWN").slice(0,220));
 process.exitCode=1;
}
