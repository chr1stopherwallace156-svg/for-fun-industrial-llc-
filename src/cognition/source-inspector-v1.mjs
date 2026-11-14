import {createHash} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
const sha=x=>createHash("sha256").update(x).digest("hex");
function blocked(ip){if(!isIP(ip))return true;if(ip.includes(":"))return true;const p=ip.split(".").map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===192&&p[1]===168||p[0]===100&&p[1]>=64&&p[1]<=127||p[0]===192&&p[1]===0||p[0]===198&&p[1]>=18&&p[1]<=19};
export function validatePublicUrl(value){let u;try{u=new URL(value)}catch{throw Error("SOURCE_URL_INVALID")}if(!["https:","http:"].includes(u.protocol)||!u.hostname||u.username||u.password||u.port)throw Error("SOURCE_URL_INVALID");if(isIP(u.hostname)||u.hostname==="localhost"||u.hostname.endsWith(".local"))throw Error("SOURCE_HOST_NOT_ALLOWED");return u.href}
export async function inspectSource({url,operatorApproved=false,fetchImpl=fetch,dnsLookup=lookup}){
if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
const target=validatePublicUrl(url);
const addresses=await dnsLookup(new URL(target).hostname,{all:true});
if(!Array.isArray(addresses)||!addresses.length||addresses.some(x=>blocked(x.address)))throw Error("SOURCE_NETWORK_NOT_ALLOWED");
const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
try{const response=await fetchImpl(target,{method:"GET",redirect:"error",signal:controller.signal,headers:{"accept":"text/html,text/plain"}});
if(!response.ok)throw Error("SOURCE_HTTP_"+response.status);
const type=(response.headers.get("content-type")||"").toLowerCase();
if(!type.includes("text/html")&&!type.includes("text/plain"))throw Error("SOURCE_CONTENT_TYPE_NOT_ALLOWED");
const declared=Number(response.headers.get("content-length")||0);if(declared>262144)throw Error("SOURCE_TOO_LARGE");
const reader=response.body.getReader();const chunks=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>262144){await reader.cancel();throw Error("SOURCE_TOO_LARGE")}chunks.push(value)}
const bytes=Buffer.concat(chunks.map(x=>Buffer.from(x)));const body=new TextDecoder("utf-8",{fatal:false}).decode(bytes);
return {state:"retrieved_unverified",source_url:target,content_sha256:sha(bytes),content_type:type,bytes:bytes.length,excerpt:body.slice(0,1800),retrieved_utc:new Date().toISOString(),verification_status:"source_retrieved_claims_unverified",score_eligible:false,external_actions:1};
}finally{clearTimeout(timeout)}}
