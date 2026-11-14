// Independent ELEKTRON INDUSTRIAL LLC read-only Gmail OAuth adapter.
// The expected address is read only from the private local business profile.
// No mailbox access from a plain email address. No sends, deletes, drafts API,
// unrestricted REA tools, or automatic memory writes.
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {homedir} from 'node:os';
import {validateIdentity} from './real-operations-v5-5.mjs';
export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const ROOT=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial');
const CLIENT=()=>join(ROOT(),'ElektronGmail','desktop-oauth-client.json');
const TOKENS=()=>join(ROOT(),'ElektronGmail','gmail-token.dpapi');
const GMAIL='https://gmail.googleapis.com/gmail/v1/users/me';
const OAUTH='https://oauth2.googleapis.com/token';
const cmp=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
async function identity(){
 const file=join(ROOT(),'ExecutiveOperatorV1','business-identity-v5-5.json');
 const p=validateIdentity(JSON.parse(await readFile(file,'utf8')));
 return p.company.email.toLowerCase();
}
export function oauthClient(raw){
 const cfg=raw?.installed;
 if(typeof cfg?.client_id!=='string'||!cfg.client_id.endsWith('.apps.googleusercontent.com')||
  typeof cfg.client_secret!=='string'||!cfg.client_secret||
  (cfg.token_uri&&cfg.token_uri!==OAUTH))throw Error('ELEKTRON_GMAIL_OAUTH_CLIENT_INVALID');
 return {id:cfg.client_id,secret:cfg.client_secret};
}
async function client(){
 return oauthClient(JSON.parse(await readFile(CLIENT(),'utf8')));
}
function dpapi(input,encrypt){
 if(process.platform!=='win32')throw Error('GMAIL_DPAPI_WINDOWS_REQUIRED');
 const script=encrypt?
  '$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force;ConvertFrom-SecureString $s':
  '$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd());$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}';
 return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
  {input,encoding:'utf8',timeout:12000,windowsHide:true,maxBuffer:200000}).trim();
}
async function saveToken(t){
 await mkdir(join(ROOT(),'ElektronGmail'),{recursive:true});
 await writeFile(TOKENS(),dpapi(JSON.stringify(t),true)+'\n',{encoding:'utf8',mode:0o600});
}
async function savedToken(){
 let t;try{t=JSON.parse(dpapi((await readFile(TOKENS(),'utf8')).trim(),false))}
 catch(e){if(e.code==='ENOENT')throw Error('ELEKTRON_GMAIL_OAUTH_NOT_CONNECTED');throw e}
 if(t.email!==await identity()||typeof t.refresh_token!=='string'||!t.refresh_token||
  t.scope!==GMAIL_SCOPE)throw Error('ELEKTRON_GMAIL_ACCOUNT_OR_SCOPE_MISMATCH');
 return t;
}
async function tokenRequest(fields){
 const r=await fetch(OAUTH,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams(fields),signal:AbortSignal.timeout(25000),redirect:'error'});
 if(!r.ok)throw Error('ELEKTRON_GMAIL_OAUTH_HTTP_'+r.status);
 const result=await r.json();
 if(typeof result.access_token!=='string'||!result.access_token)throw Error('ELEKTRON_GMAIL_ACCESS_TOKEN_MISSING');
 return result;
}
async function token(){
 const t=await savedToken();
 if(t.expires_at>Date.now()+60000&&typeof t.access_token==='string')return t.access_token;
 const c=await client();
 const updated=await tokenRequest({client_id:c.id,client_secret:c.secret,refresh_token:t.refresh_token,grant_type:'refresh_token'});
 const next={...t,access_token:updated.access_token,expires_at:Date.now()+Number(updated.expires_in||3600)*1000};
 await saveToken(next);return next.access_token
}
async function call(endpoint,access){
 if(!endpoint.startsWith(GMAIL+'/'))throw Error('ELEKTRON_GMAIL_API_ENDPOINT_DENIED');
 const r=await fetch(endpoint,{method:'GET',redirect:'error',
  headers:{authorization:'Bearer '+access},signal:AbortSignal.timeout(22000)});
 if(!r.ok)throw Error('ELEKTRON_GMAIL_API_HTTP_'+r.status);
 return r.json()
}
export async function readElektronInboxHeaders(){
 const account=await identity();
 const access=await token();
 const p=await call(GMAIL+'/profile',access);
 if(String(p.emailAddress||'').toLowerCase()!==account)throw Error('ELEKTRON_GMAIL_AUTHENTICATED_ACCOUNT_MISMATCH');
 const results=await call(GMAIL+'/messages?maxResults=6&q='+encodeURIComponent('newer_than:10d'),access);
 if(!Array.isArray(results.messages))return {account_verified:true,messages:[]};
 const messages=[];
 for(const m of results.messages.slice(0,6)){
  if(!/^[a-f0-9]{8,32}$/i.test(m?.id||''))continue;
  try{
   const msg=await call(GMAIL+'/messages/'+m.id+'?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date',access);
   const headers=msg.payload?.headers||[];
   const get=n=>String(headers.find(x=>x.name?.toLowerCase()===n.toLowerCase())?.value||'').slice(0,230);
   messages.push({id:m.id,from:get('From'),subject:get('Subject')||'(no subject)',date:get('Date')});
  }catch{ /* One inaccessible message does not block the remaining inbox. */ }
 }
 return {account_verified:true,messages}
}
const base64url=b=>Buffer.from(b).toString('base64url');
export async function connectElektronGmail(){
 if(process.platform!=='win32')throw Error('ELEKTRON_OAUTH_WINDOWS_REQUIRED');
 const expected=await identity(),c=await client();
 const verifier=base64url(randomBytes(48));
 const challenge=base64url(createHash('sha256').update(verifier).digest());
 const state=base64url(randomBytes(24));
 let done,failed,seen=false;
 const promise=new Promise((ok,err)=>{done=ok;failed=err});
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://127.0.0.1');
   if(req.method!=='GET'||u.pathname!=='/oauth2callback'||!cmp(u.searchParams.get('state')||'',state)||seen)
    throw Error('ELEKTRON_OAUTH_CALLBACK_UNEXPECTED');
   seen=true;
   const code=u.searchParams.get('code');
   if(!code||code.length<10)throw Error('ELEKTRON_OAUTH_AUTHORIZATION_DENIED');
   const redirectUri='http://127.0.0.1:'+server.address().port+'/oauth2callback';
   const result=await tokenRequest({grant_type:'authorization_code',code,
    client_id:c.id,client_secret:c.secret,code_verifier:verifier,redirect_uri:redirectUri});
   if(typeof result.refresh_token!=='string'||!result.refresh_token)throw Error('ELEKTRON_OAUTH_REFRESH_TOKEN_MISSING');
   if(result.scope&&!String(result.scope).split(' ').includes(GMAIL_SCOPE))throw Error('ELEKTRON_OAUTH_SCOPE_NOT_READONLY');
   const profile=await call(GMAIL+'/profile',result.access_token);
   if(String(profile.emailAddress||'').toLowerCase()!==expected)throw Error('ELEKTRON_OAUTH_WRONG_GOOGLE_ACCOUNT');
   await saveToken({email:expected,scope:GMAIL_SCOPE,refresh_token:result.refresh_token,
    access_token:result.access_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000});
   res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'});
   res.end('Read-only Elektron Gmail authorization completed. Return to PowerShell.');
   done({state:'READONLY_CONNECTED',scopes:'gmail.readonly'});
  }catch(e){
   res.writeHead(400,{'content-type':'text/plain','cache-control':'no-store'});
   res.end('Gmail connection not authorized. Return to PowerShell.');
   failed(Error(String(e.message||e).slice(0,170)))
  }
 });
 try{
  await new Promise((ok,err)=>{server.once('error',err);server.listen(0,'127.0.0.1',ok)});
  const redirectUri='http://127.0.0.1:'+server.address().port+'/oauth2callback';
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,val] of Object.entries({client_id:c.id,redirect_uri:redirectUri,
   response_type:'code',scope:GMAIL_SCOPE,state,code_challenge:challenge,
   code_challenge_method:'S256',access_type:'offline',prompt:'consent',login_hint:expected}))
   u.searchParams.set(key,val);
  console.log('FIAL55_ELEKTRON_GMAIL_CONNECT=OPERATOR_OAUTH_APPROVAL_REQUIRED');
  console.log('FIAL55_OAUTH_URL='+u.toString());
  return await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('ELEKTRON_OAUTH_CALLBACK_TIMEOUT')),180000))]);
 }finally{server.close()}
}
