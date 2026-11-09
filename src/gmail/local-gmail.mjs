// Dedicated, user-approved Gmail identity for Fun Industrial.
// Read-only Google OAuth desktop flow. No email send/modify/delete and no
// automatic import into Cognee; no credentials committed to GitHub.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createHash,randomBytes,timingSafeEqual} from "node:crypto";

export const EXPECTED_GMAIL_ACCOUNT="ch1stopherwallace156@gmail.com";
export const GMAIL_SCOPE="https://www.googleapis.com/auth/gmail.readonly";
const configRoot=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),"AppData","Local"),"FunIndustrial","Gmail");
const clientPath=path.join(configRoot,"desktop-oauth-client.json");
const tokenPath=path.join(configRoot,"gmail-token.dpapi");
const TOKEN_URL="https://oauth2.googleapis.com/token";
const GMAIL_API="https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailLocalPaths(){return {clientPath,tokenPath,configRoot};}
export function validateGoogleClient(raw){
 const cfg=raw?.installed;
 if(!cfg||typeof cfg.client_id!=="string"||!cfg.client_id.endsWith(".apps.googleusercontent.com")
    ||typeof cfg.client_secret!=="string"||!cfg.client_secret
    ||cfg.token_uri&&cfg.token_uri!==TOKEN_URL)
  throw Error("GMAIL_DESKTOP_CLIENT_JSON_INVALID");
 return {clientId:cfg.client_id,clientSecret:cfg.client_secret};
}
function readGoogleClient(){
 if(!existsSync(clientPath))throw Error("GMAIL_OAUTH_CLIENT_MISSING: "+clientPath);
 return validateGoogleClient(JSON.parse(readFileSync(clientPath,"utf8")));
}
function windowsDpapi(source,encrypt){
 if(process.platform!=="win32")throw Error("GMAIL_DPAPI_REQUIRES_WINDOWS");
 const script=encrypt
  ? '$x=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString -String $x -AsPlainText -Force;ConvertFrom-SecureString -SecureString $s'
  : '$x=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString -String $x;$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}';
 return execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],
  {input:source,encoding:"utf8",windowsHide:true,maxBuffer:200000,timeout:10000}).trim();
}
function protectToken(token){
 mkdirSync(configRoot,{recursive:true});
 writeFileSync(tokenPath,windowsDpapi(JSON.stringify(token),true)+"\n",{encoding:"utf8",flag:"w",mode:0o600});
}
function loadToken(){
 if(!existsSync(tokenPath))throw Error("GMAIL_NOT_CONNECTED");
 const o=JSON.parse(windowsDpapi(readFileSync(tokenPath,"utf8").trim(),false));
 if(o.email!==EXPECTED_GMAIL_ACCOUNT||typeof o.refresh_token!=="string"||!o.refresh_token)
  throw Error("GMAIL_IDENTITY_OR_REFRESH_TOKEN_INVALID");
 return o;
}
function base64url(v){return Buffer.from(v).toString("base64url")}
function equal(a,b){
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length && timingSafeEqual(x,y);
}
async function postOAuth(body){
 const res=await fetch(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams(body),signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw Error("GMAIL_OAUTH_TOKEN_HTTP_"+res.status);
 const v=await res.json();
 if(typeof v.access_token!=="string"||!v.access_token)throw Error("GMAIL_OAUTH_TOKEN_MISSING");
 return v;
}
export async function accessToken(){
 const token=loadToken(),now=Date.now();
 if(typeof token.access_token==="string"&&token.expiry>now+60000)return token.access_token;
 const c=readGoogleClient();
 const changed=await postOAuth({client_id:c.clientId,client_secret:c.clientSecret,
  refresh_token:token.refresh_token,grant_type:"refresh_token"});
 const updated={...token,access_token:changed.access_token,expiry:now+Number(changed.expires_in||3600)*1000};
 protectToken(updated);
 return updated.access_token;
}
async function gmailRequest(endpoint,token){
 if(!endpoint.startsWith(GMAIL_API))throw Error("GMAIL_URL_DENIED");
 const res=await fetch(endpoint,{headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error("GMAIL_HTTP_"+res.status);
 return res.json();
}
export async function gmailProfile(){
 const token=await accessToken();
 const data=await gmailRequest(GMAIL_API+"/profile",token);
 if(String(data.emailAddress||"").toLowerCase()!==EXPECTED_GMAIL_ACCOUNT)throw Error("GMAIL_ACCOUNT_MISMATCH");
 return {state:"connected",emailAddress:data.emailAddress,messagesTotal:data.messagesTotal||0};
}
export async function gmailList({maxResults=10,query=""}={}){
 if(!Number.isInteger(maxResults)||maxResults<1||maxResults>25||
  typeof query!=="string"||query.length>150)throw Error("GMAIL_LIST_INPUT_INVALID");
 await gmailProfile();
 const opts=new URLSearchParams({maxResults:String(maxResults)});
 if(query.trim())opts.set("q",query.trim());
 const data=await gmailRequest(GMAIL_API+"/messages?"+opts,await accessToken());
 return {emailAddress:EXPECTED_GMAIL_ACCOUNT,messages:(data.messages||[]).slice(0,maxResults).map(x=>({id:x.id,threadId:x.threadId})),
  resultSizeEstimate:data.resultSizeEstimate||0,nextPageAvailable:!!data.nextPageToken};
}
function bodyText(part){
 if(!part||typeof part!=="object")return "";
 if(part.mimeType==="text/plain"&&typeof part.body?.data==="string")
  return Buffer.from(part.body.data,"base64url").toString("utf8");
 for(const item of part.parts||[]){
  const found=bodyText(item);
  if(found)return found;
 }
 return "";
}
export function summarizeGmailMessage(raw){
 if(!raw||typeof raw.id!=="string")throw Error("GMAIL_MESSAGE_INVALID");
 const headers=raw.payload?.headers||[];
 const head=name=>String(headers.find(x=>String(x.name).toLowerCase()===name.toLowerCase())?.value||"").slice(0,500);
 return {id:raw.id,from:head("From"),to:head("To"),subject:head("Subject"),date:head("Date"),
  snippet:String(raw.snippet||"").slice(0,350),text:bodyText(raw.payload).slice(0,10000),
  attachmentsNotDownloaded:true,untrustedEmailContent:true};
}
export async function gmailRead(id){
 if(typeof id!=="string"||!/^[a-f0-9]{8,32}$/i.test(id))throw Error("GMAIL_MESSAGE_ID_INVALID");
 await gmailProfile();
 return summarizeGmailMessage(await gmailRequest(GMAIL_API+"/messages/"+encodeURIComponent(id)+"?format=full",await accessToken()));
}
export async function connectGmail(){
 if(process.platform!=="win32")throw Error("GMAIL_CONNECT_WINDOWS_ONLY");
 const cfg=readGoogleClient();
 // OAuth authorization code + PKCE + state, using a random loopback-only port.
 const verifier=base64url(randomBytes(48)),challenge=base64url(createHash("sha256").update(verifier).digest());
 const state=base64url(randomBytes(24));
 let finish,fail;
 const finished=new Promise((ok,err)=>{finish=ok;fail=err});
 let used=false;
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://127.0.0.1");
   if(req.method!=="GET"||url.pathname!=="/oauth2callback"||
    !equal(url.searchParams.get("state")||"",state)||used){
    res.writeHead(403,{"content-type":"text/plain"});res.end("Invalid authorization response.");return;
   }
   if(url.searchParams.has("error"))throw Error("GMAIL_AUTHORIZATION_DENIED");
   const code=url.searchParams.get("code");
   if(typeof code!=="string"||code.length<10)throw Error("GMAIL_OAUTH_CODE_MISSING");
   used=true;
   const oauth=await postOAuth({code,client_id:cfg.clientId,client_secret:cfg.clientSecret,
    redirect_uri:"http://127.0.0.1:"+server.address().port+"/oauth2callback",
    code_verifier:verifier,grant_type:"authorization_code"});
   if(typeof oauth.refresh_token!=="string"||!oauth.refresh_token)throw Error("GMAIL_REFRESH_TOKEN_MISSING_RECONSENT_REQUIRED");
   const profile=await gmailRequest(GMAIL_API+"/profile",oauth.access_token);
   if(String(profile.emailAddress||"").toLowerCase()!==EXPECTED_GMAIL_ACCOUNT)
    throw Error("GMAIL_ACCOUNT_MISMATCH_REFUSED");
   if(!(String(oauth.scope||"").split(" ").includes(GMAIL_SCOPE)))
    throw Error("GMAIL_READONLY_SCOPE_NOT_GRANTED");
   protectToken({email:EXPECTED_GMAIL_ACCOUNT,access_token:oauth.access_token,refresh_token:oauth.refresh_token,
    expiry:Date.now()+Number(oauth.expires_in||3600)*1000,scope:GMAIL_SCOPE});
   res.writeHead(200,{"content-type":"text/plain","cache-control":"no-store"});
   res.end("Fun Industrial Gmail read-only authorization completed. Return to PowerShell.");
   finish({state:"connected",emailAddress:profile.emailAddress,permissions:"read-only",tokenStore:"Windows user DPAPI"});
  }catch(e){
   res.writeHead(400,{"content-type":"text/plain","cache-control":"no-store"});
   res.end("Authorization could not be completed. Return to PowerShell.");
   fail(Error(String(e.message||"GMAIL_CONNECT_FAILED").slice(0,160)));
  }
 });
 try{
  await new Promise((ok,err)=>{server.once("error",err);server.listen(0,"127.0.0.1",ok)});
  const port=server.address().port;
  const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for(const [k,v] of Object.entries({client_id:cfg.clientId,redirect_uri:"http://127.0.0.1:"+port+"/oauth2callback",
    response_type:"code",scope:GMAIL_SCOPE,state,code_challenge:challenge,code_challenge_method:"S256",
    access_type:"offline",prompt:"consent",login_hint:EXPECTED_GMAIL_ACCOUNT}))
   url.searchParams.set(k,v);
  // The operator opens this in their Windows browser; never share a login code.
  process.stdout.write("GMAIL_AUTHORIZE_IN_WINDOWS_BROWSER="+url.toString()+"\n");
  process.stdout.write("Authorize ONLY "+EXPECTED_GMAIL_ACCOUNT+"; no passwords or codes should be pasted into chat.\n");
  return await Promise.race([finished,new Promise((_,reject)=>setTimeout(()=>reject(Error("GMAIL_OAUTH_LOCAL_CALLBACK_TIMEOUT")),180000))]);
 }finally{server.close()}
}
