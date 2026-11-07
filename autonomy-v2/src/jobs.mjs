import {Job,Sidequest} from "sidequest";
import {atomicJSON,checkGithubUrl,classifyRea,detectResearchChange,hash,localGet,logEvent,pendingTask,readJSON,safeText,statusAssessment,fetchJson} from "./core.mjs";
const enqueue=async(cls,data)=>Sidequest.build(cls).queue("fi-autonomy").maxAttempts(1).timeout(30000).enqueue(data);

export class Discover extends Job {
 async run(){
  const d={at:new Date().toISOString()};
  const [tools,status]=await Promise.allSettled([localGet("/api/rea/tools"),localGet("/api/unified/status")]);
  d.tools=tools.status==="fulfilled"?(Array.isArray(tools.value.tools)?tools.value.tools.length:-1):-1;
  if(status.status==="fulfilled"){d.enabled=Number(status.value.rea_enabled);d.unified=status.value.state}
  else{d.enabled=-1;d.unified="offline"}
  d.sources={rea:tools.status,unified:status.status};
  atomicJSON("latest-discovery.json",d);logEvent("discover",{tools:d.tools,enabled:d.enabled,unified:d.unified});
  await enqueue(Analyze,d);return d;
 }
}
export class Analyze extends Job {
 async run(d){const assessment=statusAssessment(d);logEvent("analyze",assessment);await enqueue(Verify,assessment);return assessment}
}
export class Verify extends Job {
 async run(a){
  atomicJSON("platform-health.json",{...a,checkedAt:new Date().toISOString()});
  logEvent("verify",{pass:a.ready,reaTools:a.reaTools});
  if(!a.ready)await enqueue(Followup,{kind:"platform_health",title:"Review Fun Industrial platform health",detail:"Unified "+a.unified+", REA "+a.reaTools+", enabled "+a.reaEnabled+". Read-only investigation suggested."});
  return {verified:a.ready};
 }
}
export class Registry extends Job {
 async run(){try{
  const c=await localGet("/api/rea/catalog"),a=Array.isArray(c.tools)?c.tools:[];
  if(a.length===0)throw Error("EMPTY_REGISTRY");
  const classified=a.map(classifyRea),previous=readJSON("rea-registry.json");
  const record={count:a.length,reviewCandidates:classified.filter(x=>x.requiresReview).length,unclassified:classified.filter(x=>!x.requiresReview).length,digest:hash(classified),checkedAt:new Date().toISOString(),classification:"heuristic_not_safety_certification",execution:"disabled"};
  atomicJSON("rea-registry.json",record);logEvent("rea_registry",{count:record.count,reviewCandidates:record.reviewCandidates});
  if(record.count!==229||(previous?.digest&&previous.digest!==record.digest))await enqueue(Followup,{kind:"rea_registry",title:"Review REA tool registry change",detail:"Count "+record.count+"; fingerprint "+record.digest.slice(0,16)+"; previous "+(previous?.count??"none")+". No REA tools were called."});
  return record;
 }catch(e){logEvent("rea_registry_error",{reason:safeText(e.message,200)});await enqueue(Followup,{kind:"rea_registry",title:"REA registry inspection unavailable",detail:safeText(e.message)});return {verified:false}}}
}
export class Research extends Job {
 async run(){
  const sources=readJSON("research-sources.json",[]);if(!Array.isArray(sources))throw Error("RESEARCH_SOURCES_INVALID");
  const results=[];
  for(const row of sources.slice(0,5)){
   const name=safeText(row.name,90);
   try{
    const url=checkGithubUrl(row.url),j=await fetchJson(url);
    const next={name,tag:safeText(j.tag_name,100),publishedAt:safeText(j.published_at,80),url:safeText(j.html_url,500),checkedAt:new Date().toISOString(),source:"GitHub release API"};
    const fn="release-"+hash(name).slice(0,16)+".json",prev=readJSON(fn),changed=detectResearchChange(prev,next);
    atomicJSON(fn,next);logEvent("research",{name,tag:next.tag,changed});
    if(changed&&prev)await enqueue(Followup,{kind:"research_change",title:"New release noticed: "+name,detail:"Previous "+(prev.tag||"?")+"; new "+next.tag+"; official "+next.url});
    results.push({name,ok:true,changed,tag:next.tag});
   }catch(e){logEvent("research_error",{name,reason:safeText(e.message)});results.push({name,ok:false,error:safeText(e.message)})}
  }
  atomicJSON("latest-research.json",{checkedAt:new Date().toISOString(),results});
  await enqueue(ResearchVerify,{results});
  return {sources:results.length};
 }
}
export class ResearchVerify extends Job {
 async run(data){
  const ok=data.results.every(x=>x.ok);logEvent("research_verify",{pass:ok,sources:data.results.length});
  if(!ok)await enqueue(Followup,{kind:"research_sources",title:"Check research sources",detail:"An allowlisted GitHub releases endpoint failed; inspect latest-research.json."});
  return {verified:ok};
 }
}
export class ProductSnapshot extends Job {
 async run(){
  const products=readJSON("products.json",[]);if(!Array.isArray(products))throw Error("PRODUCTS_INVALID");
  const previous=readJSON("product-snapshot.json",{}),next={};
  for(const row of products.slice(0,150)){
   const id=safeText(row.id,70);if(!/^[\w-]{1,70}$/.test(id))continue;
   const price=row.price==null?null:Number(row.price);
   const product={id,name:safeText(row.name,120),price:Number.isFinite(price)?price:null,currency:safeText(row.currency||"USD",4),availability:safeText(row.availability||"unknown",50),source:"operator-entered"};
   next[id]=product;const old=previous[id];
   if(old&&(old.price!==product.price||old.availability!==product.availability))await enqueue(Followup,{kind:"product_tracking",title:"Product update: "+product.name,detail:"Price "+old.price+" -> "+product.price+" "+product.currency+"; availability "+old.availability+" -> "+product.availability+". Verify supplier information."});
  }
  atomicJSON("product-snapshot.json",next);logEvent("product_snapshot",{count:Object.keys(next).length});return {count:Object.keys(next).length};
 }
}
export class Followup extends Job {
 async run(info){const id=pendingTask(info);return {id,execution:"operator_review_only"}}
}
