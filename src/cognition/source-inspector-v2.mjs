import {createHash} from "node:crypto";
import {lookup} from "node:dns/promises";
import {request as httpRequest} from "node:http";
import {request as httpsRequest} from "node:https";
import {isIP} from "node:net";
import {validatePublicUrl} from "./source-inspector-v1.mjs";
const sha=x=>createHash("sha256").update(x).digest("hex");
function publicIPv4(ip){if(isIP(ip)!==4)return false;const p=ip.split(".").map(Number);if(p[0]===0||p[0]===10||p[0]===127||p[0]>=224)return false;if(p[0]===169&&p[1]===254)return false;if(p[0]===172&&p[1]>=16&&p[1]<=31)return false;if(p[0]===192&&(p[1]===168||p[1]===0||p[1]===0&&p[2]===0))return false;if(p[0]===100&&p[1]>=64&&p[1]<=127)return false;if(p[0]===198&&p[1]>=18&&p[1]<=19)return false;return true}
export async function inspectPinnedSource({url,operatorApproved=false,dnsLookup=lookup,transport=null}){
if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
const target=validatePublicUrl(url);const u=new URL(target);
const addresses=await dnsLookup(u.hostname,{all:true});
if(!Array.isArray(addresses)||!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error("SOURCE_NETWORK_NOT_ALLOWED");
const ip=addresses[0].address;const requestFn=transport||(u.protocol==="https:"?httpsRequest:httpRequest);
const bytes=await new Promise((resolve,reject)=>{
const req=requestFn(u,{method:"GET",lookup:(_host,_opts,cb)=>cb(null,ip,4),servername:u.hostname,headers:{"accept":"text/html,text/plain","host":u.host},timeout:12000},res=>{
if(res.statusCode<200||res.statusCode>=300){res.resume();reject(Error("SOURCE_HTTP_"+res.statusCode));return}
const type=String(res.headers["content-type"]||"").toLowerCase();if(!type.includes("text/html")&&!type.includes("text/plain")){res.resume();reject(Error("SOURCE_CONTENT_TYPE_NOT_ALLOWED"));return}
if(Number(res.headers["content-length"]||0)>262144){res.destroy();reject(Error("SOURCE_TOO_LARGE"));return}
const chunks=[];let total=0;res.on("data",chunk=>{total+=chunk.length;if(total>262144){res.destroy();reject(Error("SOURCE_TOO_LARGE"));return}chunks.push(chunk)});res.on("end",()=>resolve({body:Buffer.concat(chunks),type}));res.on("error",reject);
});req.on("timeout",()=>req.destroy(Error("SOURCE_TIMEOUT")));req.on("error",reject);req.end();
});
return {state:"retrieved_unverified",source_url:target,validated_ip:ip,content_sha256:sha(bytes.body),content_type:bytes.type,bytes:bytes.body.length,excerpt:bytes.body.toString("utf8").slice(0,1800),retrieved_utc:new Date().toISOString(),verification_status:"source_retrieved_claims_unverified",score_eligible:false,external_actions:1};
}
