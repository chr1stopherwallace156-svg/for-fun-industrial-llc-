// Explicit, single-destination Gmail sending for ELEKTRON INDUSTRIAL LLC.
// Separate Gmail send authorization; never inherit the old read-only token.
// No API sends from scheduled cycles or dashboard GET requests.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {homedir} from 'node:os';
import {validateIdentity} from '../operator/real-operations-v5-5.mjs';
import {inquiryForBusiness,CITY_EMAIL} from './outcome-engine-v5-7.mjs';
export const SCOPE_SEND='https://www.googleapis.com/auth/gmail.send';
export const SCOPE_IDENTITY='https://www.googleapis.com/auth/userinfo.email';
const ROOT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial');
const CLIENT=()=>join(ROOT(),'ElektronGmail','desktop-oauth-client.json');
const AUTH=()=>join(ROOT(),'ElektronGmail','send-token.dpapi');
const API='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const USERINFO='https://www.googleapis.com/oauth2/v3/userinfo';
async function expectedAccount(){
 const p=validateIdentity(JSON.parse(await readFile(join(ROOT(),'ExecutiveOperatorV1','business-identity-v5-5.json'),'utf8')));
 return p.company.email.toLowerCase();
}
function validateClient(x){
 const c=x?.installed;
 if(typeof c?.client_id!=='string'||!c.client_id.endsWith('.apps.googleusercontent.com')||
  typeof c.client_secret!=='string'||c.client_secret.length<5||
  (c.token_uri&&c.token_uri!==TOKEN_URL))throw Error('FIAL57_INVALID_OPERATOR_OWNED_OAUTH_CLIENT');
 return {id:c.client_id,secret:c.client_secret};
}
async function credentials(){return validateClient(JSON.parse(await readFile(CLIENT(),'utf8')))}
function dpapi(value,encrypt){
 if(process.platform!=='win32')throw Error('FIAL57_SEND_TOKEN_DPAPI_WINDOWS_ONLY');
 const script=encrypt?
  '$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force;ConvertFrom-SecureString $s':
  '$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd());$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}';
 return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
  {input:value,encoding:'utf8',timeout:12000,windowsHide:true,maxBuffer:180000}).trim()
}
async function saveToken(t){
 await mkdir(join(ROOT(),'ElektronGmail'),{recursive:true});
 await writeFile(AUTH(),dpapi(JSON.stringify(t),true)+'\n',{mode:0o600});
}
async function saved(){
 let r;try{r=JSON.parse(dpapi((await readFile(AUTH(),'utf8')).trim(),false))}
 catch(e){if(e.code==='ENOENT')throw Error('FIAL57_SEND_OAUTH_NOT_CONNECTED');throw e}
 if(r.email!==await expectedAccount()||typeof r.refresh_token!=='string'||!r.refresh_token||
  !Array.isArray(r.scopes)||!r.scopes.includes(SCOPE_SEND)||!r.scopes.includes(SCOPE_IDENTITY))
  throw Error('FIAL57_SEND_ACCOUNT_OR_SCOPE_MISMATCH');
 return r;
}
async function tokenRequest(body){
 const r=await fetch(TOKEN_URL,{method:'POST',redirect:'error',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(body),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('FIAL57_OAUTH_TOKEN_HTTP_'+r.status);
 const data=await r.json();
 if(typeof data.access_token!=='string'||!data.access_token)throw Error('FIAL57_NO_ACCESS_TOKEN');
 return data;
}
async function accountOf(accessToken){
 const r=await fetch(USERINFO,{method:'GET',redirect:'error',
  headers:{authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error('FIAL57_GOOGLE_ACCOUNT_VERIFICATION_HTTP_'+r.status);
 const data=await r.json();
 if(data.email_verified!==true||typeof data.email!=='string')
  throw Error('FIAL57_ACCOUNT_EMAIL_UNVERIFIED');
 return data.email.toLowerCase();
}
export async function accessForElektronSend(){
 const r=await saved();
 let access=r.access_token;
 if(!(typeof access==='string'&&r.expires_at>Date.now()+60000)){
  const c=await credentials();
  const t=await tokenRequest({client_id:c.id,client_secret:c.secret,refresh_token:r.refresh_token,
   grant_type:'refresh_token'});
  access=t.access_token;
  await saveToken({...r,access_token:access,expires_at:Date.now()+Number(t.expires_in||3600)*1000});
 }
 if(await accountOf(access)!==await expectedAccount())throw Error('FIAL57_WRONG_GOOGLE_ACCOUNT');
 return access
}
function crlf(value){
 if(typeof value!=='string'||/[\r\n]/.test(value))throw Error('FIAL57_UNSAFE_EMAIL_HEADER');
 return value
}
export function rawMessage(message){
 if(!message||message.to!==CITY_EMAIL||typeof message.from!=='string'||
  typeof message.subject!=='string'||typeof message.text!=='string'||message.text.length>5000||
  /[\x00]/.test(message.text))throw Error('FIAL57_SEND_MESSAGE_INVALID');
 const headers=['From: '+crlf(message.from),'To: '+CITY_EMAIL,
  'Subject: =?UTF-8?B?'+Buffer.from(crlf(message.subject)).toString('base64')+'?=',
  'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64','',
  Buffer.from(message.text,'utf8').toString('base64')];
 return Buffer.from(headers.join('\r\n'),'utf8').toString('base64url');
}
export async function sendApprovedInquiry(message){
 const account=await expectedAccount();
 if(message.from.toLowerCase()!==account||message.to!==CITY_EMAIL)
  throw Error('FIAL57_DESTINATION_OR_SENDER_MISMATCH');
 const access=await accessForElektronSend();
 const r=await fetch(API,{method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+access,'content-type':'application/json'},
  body:JSON.stringify({raw:rawMessage(message)}),
  signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('FIAL57_GMAIL_SEND_HTTP_'+r.status);
 const response=await r.json();
 if(!/^[a-f0-9]{8,40}$/i.test(response?.id||'')||
  !/^[a-f0-9]{8,40}$/i.test(response?.threadId||''))
  throw Error('FIAL57_GMAIL_SEND_RECEIPT_UNKNOWN');
 return {id:response.id,threadId:response.threadId};
}
const b64=b=>Buffer.from(b).toString('base64url');
export async function connectSendPermission(){
 if(process.platform!=='win32')throw Error('FIAL57_OAUTH_WINDOWS_REQUIRED');
 const expected=await expectedAccount(),c=await credentials();
 const verifier=b64(randomBytes(48)),challenge=b64(createHash('sha256').update(verifier).digest());
 const nonce=b64(randomBytes(24));
 let resolve,fail,seen=false;
 const completed=new Promise((ok,bad)=>{resolve=ok;fail=bad});
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const state=url.searchParams.get('state')||'';
   const a=Buffer.from(state),b=Buffer.from(nonce);
   if(req.method!=='GET'||url.pathname!=='/callback'||seen||
    a.length!==b.length||!timingSafeEqual(a,b))throw Error('FIAL57_OAUTH_CALLBACK_DENIED');
   seen=true;
   const code=url.searchParams.get('code');
   if(!code||code.length<10)throw Error('FIAL57_OAUTH_CODE_MISSING');
   const redirectUri='http://127.0.0.1:'+server.address().port+'/callback';
   const token=await tokenRequest({grant_type:'authorization_code',
    code,client_id:c.id,client_secret:c.secret,code_verifier:verifier,
    redirect_uri:redirectUri});
   const scopes=String(token.scope||'').split(' ').filter(Boolean);
   if(!scopes.includes(SCOPE_SEND)||!scopes.includes(SCOPE_IDENTITY))
    throw Error('FIAL57_REQUIRED_SCOPES_NOT_GRANTED');
   if(typeof token.refresh_token!=='string'||!token.refresh_token)
    throw Error('FIAL57_REFRESH_TOKEN_REQUIRED');
   if(await accountOf(token.access_token)!==expected)
    throw Error('FIAL57_DIFFERENT_GOOGLE_ACCOUNT');
   await saveToken({email:expected,scopes:[SCOPE_SEND,SCOPE_IDENTITY],
    refresh_token:token.refresh_token,access_token:token.access_token,
    expires_at:Date.now()+Number(token.expires_in||3600)*1000});
   res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});
   res.end('ELEKTRON SEND permission connected. No email was sent.');
   resolve({state:'ELEKTRON_SEND_AUTH_CONNECTED_NO_MESSAGE_SENT'});
  }catch(e){
   res.writeHead(400,{'content-type':'text/plain','cache-control':'no-store'});
   res.end('Authorization not completed.');
   fail(Error(String(e.message||e).slice(0,180)));
  }
 });
 try{
  await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});
  const redirectUri='http://127.0.0.1:'+server.address().port+'/callback';
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:c.id,redirect_uri:redirectUri,
   response_type:'code',scope:SCOPE_SEND+' '+SCOPE_IDENTITY,state:nonce,
   code_challenge:challenge,code_challenge_method:'S256',
   access_type:'offline',prompt:'consent',login_hint:expected}))u.searchParams.set(k,v);
  console.log('FIAL57_OPERATOR_GOOGLE_SEND_CONSENT_REQUIRED');
  console.log('FIAL57_OPEN_GOOGLE_OAUTH_URL='+u.toString());
  return await Promise.race([completed,new Promise((_,bad)=>setTimeout(()=>bad(Error('FIAL57_OAUTH_TIMEOUT')),180000))]);
 }finally{server.close()}
}
