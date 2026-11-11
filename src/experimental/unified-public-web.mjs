// FI_UNIFIED_PUBLIC_WEB_V1: bounded public HTTPS text observations only.
// Never executes scripts, follows redirects, sends credentials or fetches private
// addresses. User must provide an explicit HTTPS URL. No crawler or downloads.
import {lookup as dnsLookup} from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';

export function isPublicIPv4(ip){
 if(net.isIP(ip)!==4)return false;
 const [a,b,c,d]=ip.split('.').map(Number);
 if([a,b,c,d].some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 // Block loopback, private, link-local, CGNAT, reserved, documentation,
 // benchmark, multicast, future-use and limited-broadcast ranges.
 if(a===0||a===10||a===127||a>=224)return false;
 if(a===100&&b>=64&&b<=127)return false;
 if(a===169&&b===254)return false;
 if(a===172&&b>=16&&b<=31)return false;
 if(a===192&&(b===168||b===0||b===88||b===0&&c===0))return false;
 if(a===192&&b===0&&c===2)return false;
 if(a===198&&(b===18||b===19||b===51&&c===100))return false;
 if(a===203&&b===0&&c===113)return false;
 if(a===255)return false;
 return true;
}
export function validatePublicHttps(raw){
 if(typeof raw!=='string'||raw.length>1400||raw.trim()!==raw)throw Error('WEB_URL_INVALID');
 let uri;
 try{uri=new URL(raw)}catch{throw Error('WEB_URL_INVALID')}
 if(uri.protocol!=='https:'||uri.port||uri.username||uri.password||uri.hash||
    net.isIP(uri.hostname)!==0||uri.hostname==='localhost'||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/i.test(uri.hostname)||
    !uri.hostname.includes('.')||uri.hostname.length>240)
  throw Error('WEB_ONLY_PUBLIC_HTTPS_HOSTNAMES');
 return uri;
}
export function extractText(html){
 const source=String(html).slice(0,131072);
 const withoutMarkup=source.replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|noscript|svg|iframe|form|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ');
 return withoutMarkup.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi,
  m=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[m.toLowerCase()]||' '))
  .replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,7000);
}
// Node may ask a custom lookup callback for an address list (options.all=true)
// when auto-select-family is enabled. Returning a single address for that call
// causes ERR_INVALID_IP_ADDRESS on recent Node versions. Both forms must pin
// only the already validated public IPv4 address, never re-resolve the hostname.
export function createPinnedPublicLookup(target){
 if(!isPublicIPv4(target))throw Error('WEB_PINNED_ADDRESS_NOT_PUBLIC');
 return (_hostname,options,callback)=>{
  const cb=typeof options==='function'?options:callback;
  if(typeof cb!=='function')throw Error('WEB_LOOKUP_CALLBACK_MISSING');
  if(options&&typeof options==='object'&&options.all===true)
   return cb(null,[{address:target,family:4}]);
  return cb(null,target,4);
 };
}
export async function fetchPublicWebText(raw,{lookup=dnsLookup,request=https.request}={}){
 const uri=validatePublicHttps(raw);
 const resolved=await lookup(uri.hostname,{family:4,all:true});
 if(!Array.isArray(resolved)||!resolved.length||
    resolved.some(x=>!isPublicIPv4(x?.address)))throw Error('WEB_DNS_NOT_PUBLIC');
 const target=resolved[0].address;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const fail=msg=>{if(settled)return;settled=true;reject(Error(msg))};
  const req=request(uri,{
   method:'GET',timeout:12000,
   family:4,lookup:createPinnedPublicLookup(target),
   headers:{'accept':'text/html,text/plain;q=0.9','accept-encoding':'identity',
    'user-agent':'FunIndustrial-ReadOnlyResearch/1.0'}
  },res=>{
   const status=res.statusCode;
   if(status!==200){res.resume?.();return fail('WEB_HTTP_'+String(status||'UNKNOWN'))}
   const ct=String(res.headers?.['content-type']||'').toLowerCase();
   if(!/^(text\/html|text\/plain)(?:[;\s]|$)/.test(ct)){
    res.resume?.();return fail('WEB_CONTENT_TYPE_UNSUPPORTED');
   }
   let bytes=0;const chunks=[];
   res.on('data',chunk=>{
    bytes+=chunk.length;
    if(bytes>131072){req.destroy?.();return fail('WEB_TEXT_SIZE_LIMIT')}
    chunks.push(chunk);
   });
   res.on('end',()=>{
    if(settled)return;
    settled=true;
    const rawText=Buffer.concat(chunks).toString('utf8');
    const text=ct.startsWith('text/html')?extractText(rawText):
      rawText.replace(/[\u0000-\u001f\u007f]+/g,' ').slice(0,7000);
    resolve({url:uri.href,kind:'public_web_static_text',text,bytes,
     noScriptsExecuted:true,redirectsFollowed:0,sourceTrust:'untrusted'});
   });
   res.on('error',e=>fail('WEB_RESPONSE_ERROR_'+String(e.code||'UNKNOWN')));
  });
  req.on('timeout',()=>{req.destroy?.();fail('WEB_TIMEOUT')});
  req.on('error',e=>fail('WEB_REQUEST_ERROR_'+String(e.code||'UNKNOWN')));
  req.end();
 });
}
