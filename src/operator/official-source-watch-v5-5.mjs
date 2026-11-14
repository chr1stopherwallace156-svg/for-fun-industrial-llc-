// FIAL5.5 bounded official public-source status monitor; no forms or credentials.
// Source is governmental text only; never directives. No redirects, allowlist only.
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
export const SOURCES=Object.freeze([
 {id:'victorville-business-license',url:'https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division'},
 {id:'victorville-license-requirements',url:'https://www.victorvilleca.gov/Government/City-Departments/Business-License-Division/Business-License-Links-and-Resources'},
 {id:'ca-sos-entity-records',url:'https://www.sos.ca.gov/business-programs/business-entities/information-requests'}
]);
const OFFICIAL_HOSTS=new Set(['www.victorvilleca.gov','www.sos.ca.gov']);
const validUrl=target=>{
 const u=new URL(target);
 return u.protocol==='https:'&&OFFICIAL_HOSTS.has(u.hostname)&&u.port===''&&!u.username&&!u.password&&!u.search&&!u.hash;
};
const safeFetch=async(url,fetcher)=>{
 if(!validUrl(url))throw Error('FIAL55_OFFICIAL_URL_DENIED');
 const reply=await fetcher(url,{method:'GET',redirect:'manual',
  headers:{'accept':'text/html','user-agent':'FunIndustrial-OfficialEvidence/1.0'},
  signal:AbortSignal.timeout(8500)});
 if(reply.status<200||reply.status>299||reply.redirected)throw Error('OFFICIAL_HTTP_'+reply.status);
 const type=reply.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('text/html'))throw Error('OFFICIAL_UNEXPECTED_CONTENT_TYPE');
 const length=Number(reply.headers.get('content-length')||0);
 if(length>180000)throw Error('OFFICIAL_DOCUMENT_TOO_LARGE');
 const reader=reply.body?.getReader();
 if(!reader)throw Error('OFFICIAL_BODY_MISSING');
 const chunks=[];let total=0;
 try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;
  if(total>180000)throw Error('OFFICIAL_DOCUMENT_TOO_LARGE');chunks.push(part.value)}}finally{reader.releaseLock()}
 const raw=Buffer.concat(chunks);
 // Keep source evidence bounded and in local filesystem, not the AI prompt or public repo.
 return {bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),
  text:raw.toString('utf8')};
};
export async function monitorOfficialSites({dir,now=new Date(),fetcher=fetch}={}){
 if(!dir)throw Error('MONITOR_DIRECTORY_REQUIRED');
 await mkdir(dir,{recursive:true});
 const file=join(dir,'official-watch-v1.json');
 let old=null;
 try{old=JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const out=[];
 for(const source of SOURCES){
  const prior=old?.sources?.find(x=>x.id===source.id)||null;
  const intervalMs=24*3600000;
  if(prior?.last_checked&&+now-Date.parse(prior.last_checked)<intervalMs&&
   +now>=Date.parse(prior.last_checked)){out.push({...prior,checked_this_cycle:false});continue}
  let next;
  try{
   const response=await safeFetch(source.url,fetcher);
   const changed=!!prior?.sha256&&prior.sha256!==response.sha256;
   const evidence=join(dir,source.id+'-'+response.sha256.slice(0,16)+'.html');
   try{await writeFile(evidence,response.text,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
   next={...source,sha256:response.sha256,bytes:response.bytes,
    last_checked:now.toISOString(),state:changed?'OFFICIAL_PAGE_CHANGED':'OFFICIAL_PAGE_SEEN',
    changed,source_file:evidence,checked_this_cycle:true};
  }catch(e){
   next={...source,sha256:prior?.sha256||null,bytes:prior?.bytes||null,
    last_checked:now.toISOString(),state:'OFFICIAL_PAGE_FETCH_HOLD',
    changed:false,source_file:prior?.source_file||null,
    checked_this_cycle:true,reason:String(e.message||e).slice(0,100)};
  }
  out.push(next)
 }
 const result={version:'fial5.5-official-source-watch-v1',at_utc:now.toISOString(),
  sources:out,changed:out.filter(x=>x.changed).length,
  fetched:out.filter(x=>x.checked_this_cycle).length,
  errors:out.filter(x=>x.state==='OFFICIAL_PAGE_FETCH_HOLD').length,
  no_form_submissions:true};
 const tmp=file+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 await rename(tmp,file);
 return result;
}
