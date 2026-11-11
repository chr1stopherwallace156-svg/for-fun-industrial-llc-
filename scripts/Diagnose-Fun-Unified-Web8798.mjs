// FI_UNIFIED_WEB_DIAGNOSTIC_V1
// Operator-started single public HTTPS GET, no localhost service restart.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchPublicWebText,validatePublicHttps} from '../src/experimental/unified-public-web.mjs';
import {lookup} from 'node:dns/promises';

export async function diagnoseWebUrl(raw,{resolve=lookup,fetchWeb=fetchPublicWebText,write=console.log}={}){
 const url=validatePublicHttps(raw);
 write('WEB_DIAG_URL='+url.href);
 let ips;
 try{
  const found=await resolve(url.hostname,{family:4,all:true});
  ips=Array.isArray(found)?found.map(x=>x?.address).filter(x=>typeof x==='string'):[];
  write('WEB_DIAG_DNS_A_COUNT='+ips.length);
  // Do not substitute this diagnostic's DNS results for the pinned resolver
  // check in fetchPublicWebText; its own strict resolver remains authoritative.
 }catch(error){
  write('WEB_DIAG_DNS_ERROR='+String(error?.code||error?.message||error).slice(0,160));
 }
 try{
  const result=await fetchWeb(url.href);
  write('WEB_DIAG_RESULT=PASS');
  write('WEB_DIAG_SOURCE='+result.url);
  write('WEB_DIAG_BYTES='+String(result.bytes));
  write('WEB_DIAG_TEXT_CHARS='+String(result.text?.length||0));
  write('WEB_DIAG_TEXT_EXCERPT='+String(result.text||'').slice(0,350));
  return {status:'pass',url:result.url};
 }catch(error){
  const msg=String(error?.message||error).slice(0,240);
  write('WEB_DIAG_RESULT=HOLD');
  write('WEB_DIAG_CAUSE='+msg);
  write('WEB_DIAG_EXTERNAL_NETWORK=READ_ONLY_GET_NO_REDIRECT_NO_SCRIPT');
  return {status:'hold',cause:msg};
 }
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 if(process.argv.length!==3||process.argv[2]!=='--check-example-org'){
  console.log('WEB_DIAG=INACTIVE. Explicit --check-example-org required.');
 }else{
  const result=await diagnoseWebUrl('https://example.org/');
  console.log('WEB_DIAG_COMPLETE=TRUE WEB_READ_ONLY=TRUE RUNNING_SERVICES_UNCHANGED=TRUE');
  if(result.status!=='pass')process.exitCode=2;
 }
}
