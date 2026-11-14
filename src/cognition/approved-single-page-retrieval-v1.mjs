import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";
import {createHash} from "node:crypto";

// Single operator-approved request. No redirects, cookies, proxies, crawling or retries.
// DNS is resolved before the request and the vetted IPv4 address is pinned to the socket.
function publicIPv4(ip) {
  if(net.isIP(ip)!==4)return false;
  const [a,b,c,d]=ip.split(".").map(Number);
  if([a,b,c,d].some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  if(a===0||a===10||a===127||a>=224)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&(b===168||b===0||b===88))return false;
  if(a===198&&(b===18||b===19||b===51||b===52))return false;
  if(a===203&&b===0&&c===113)return false;
  if(a===192&&b===0&&c===2)return false;
  if(a===198&&b===51&&c===100)return false;
  if(a===192&&b===0&&c===0)return false;
  if(a===192&&b===0&&c===0&&d===0)return false;
  return true;
}
export async function retrieveApprovedPage({url,operatorApproved=false,timeoutMs=10000,maxBytes=262144}) {
  if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
  if(typeof url!=="string"||url.length>2048)throw Error("URL_INVALID");
  let target;
  try{target=new URL(url)}catch{throw Error("URL_INVALID")}
  if(!["https:","http:"].includes(target.protocol)||target.username||target.password||target.hash||!target.hostname||!["","80","443"].includes(target.port))throw Error("URL_NOT_ALLOWED");
  if(net.isIP(target.hostname)||target.hostname.toLowerCase()==="localhost")throw Error("IP_OR_LOCALHOST_NOT_ALLOWED");
  const records=await dns.lookup(target.hostname,{family:4,all:true,verbatim:true});
  if(!records.length||records.some(x=>!publicIPv4(x.address)))throw Error("NONPUBLIC_DNS_ADDRESS");
  const ip=records[0].address;
  const transport=target.protocol==="https:"?https:http;
  const bytes=await new Promise((resolve,reject)=>{
    const req=transport.get(target,{agent:false,timeout:timeoutMs,headers:{"accept":"text/html,text/plain;q=0.9","accept-encoding":"identity","user-agent":"FunIndustrial-EvidenceCollector/1.0"},lookup:(_host,_opts,cb)=>cb(null,ip,4)},res=>{
      if(res.statusCode>=300&&res.statusCode<400){res.resume();req.destroy(Error("REDIRECT_REJECTED"));return}
      if(res.statusCode!==200){res.resume();req.destroy(Error("HTTP_STATUS_"+res.statusCode));return}
      const mime=String(res.headers["content-type"]||"").toLowerCase();
      if(!/^(text\/html|text\/plain)(;|$)/.test(mime)){res.resume();req.destroy(Error("CONTENT_TYPE_REJECTED"));return}
      const chunks=[];let size=0;
      res.on("data",chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy(Error("SOURCE_TOO_LARGE"));return}chunks.push(chunk)});
      res.on("end",()=>resolve(Buffer.concat(chunks)));
      res.on("error",reject);
    });
    req.on("timeout",()=>req.destroy(Error("RETRIEVAL_TIMEOUT")));
    req.on("error",reject);
  });
  if(!bytes.length)throw Error("EMPTY_SOURCE");
  const body=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
  // Keep the passage byte-for-byte inside the saved response.
  const safeBody=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"");
  const candidates=safeBody.match(/>[^<>]{35,600}</g)||[];
  const passage=(candidates.map(s=>s.slice(1,-1).trim()).find(s=>s.length>=35&&Buffer.byteLength(s,"utf8")<=1000))||
    (target.pathname.endsWith(".txt")||!body.includes("<")?body.split(/\r?\n/).map(s=>s.trim()).find(s=>s.length>=35&&Buffer.byteLength(s,"utf8")<=1000):null);
  if(!passage||!bytes.includes(Buffer.from(passage,"utf8")))throw Error("EXACT_PASSAGE_NOT_FOUND");
  return {content:bytes,claim_text:passage,inspection:{state:"retrieved_unverified",source_url:url,verification_status:"source_retrieved_claims_unverified",score_eligible:false,external_actions:1,content:bytes,bytes:bytes.length,content_sha256:createHash("sha256").update(bytes).digest("hex"),retrieved_utc:new Date().toISOString(),excerpt:passage.slice(0,500)}};
}
