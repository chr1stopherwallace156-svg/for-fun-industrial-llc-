// Read-only attestation of a currently listening Fun Industrial HTTPS gateway.
// No secret/password/private key access; no socket bind or request to iPhone.
// Trusted local CA and exact certificate pin, then local source IP must be 403.
import https from "node:https";
import {readFileSync} from "node:fs";
import {X509Certificate} from "node:crypto";

const configPath=process.argv[2];
if(!configPath)throw Error("FI_GATEWAY_ATTEST_CONFIG_REQUIRED");
const cfg=JSON.parse(readFileSync(configPath,"utf8"));
if(cfg.schema!=="fun.voice.gateway.private.v1"||
   cfg.pcIp!=="100.109.4.20"||Number(cfg.port)!==8443||
   cfg.publicHost!=="100.109.4.20:8443"||
   cfg.iphonePeerIp!=="100.109.87.100"){
 throw Error("FI_GATEWAY_ATTEST_POLICY_HOLD");
}
const ca=readFileSync(cfg.caPublicPem);
const expectedCert=new X509Certificate(readFileSync(cfg.tlsCertificate));
const response=await new Promise((resolve,reject)=>{
 const req=https.request({
  hostname:cfg.pcIp,port:8443,method:"GET",path:"/api/voice/mobile/status",
  ca,rejectUnauthorized:true,timeout:5000,agent:false,
  headers:{host:cfg.publicHost}
 },res=>{
  try{
   const peer=res.socket.getPeerCertificate(true);
   if(!peer||peer.fingerprint256!==expectedCert.fingerprint256){
    req.destroy(Error("FI_GATEWAY_ATTEST_CERT_MISMATCH"));return;
   }
  }catch(e){req.destroy(e);return}
  let body="",n=0;
  res.on("data",part=>{
   n+=part.length;
   if(n>512){req.destroy(Error("FI_GATEWAY_ATTEST_BODY_TOO_LARGE"));return}
   body+=part.toString();
  });
  res.on("end",()=>resolve({code:res.statusCode,body}));
 });
 req.on("timeout",()=>req.destroy(Error("FI_GATEWAY_ATTEST_TIMEOUT")));
 req.on("error",reject);req.end();
});
if(response.code!==403||response.body.trim()!=="VPN client address not allowed"){
 throw Error("FI_GATEWAY_ATTEST_LOCAL_DENY_HOLD");
}
console.log("FI_GATEWAY_PRIVATE_ATTEST=PASS TLS_PIN=EXACT LOCAL_ACCESS_DENIED=403");
