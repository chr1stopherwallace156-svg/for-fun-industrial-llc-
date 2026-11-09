// Validate private HTTPS gateway with trusted public CA only.
// Read-only status request; does not upload or modify any voice recording.
// Credentials are inherited temporarily from PowerShell, not logged or saved.
import https from "node:https";
import {readFileSync} from "node:fs";
const caPath=process.env.FI_GATEWAY_LOCAL_CA_PUBLIC_PEM;
const target=process.env.FI_GATEWAY_PUBLIC_HOST;
const username=process.env.FI_GATEWAY_USERNAME;
const password=process.env.FI_GATEWAY_PASSWORD;
if(!caPath||!target||!username||!password)throw Error("FI_GATEWAY_SELFTEST_CONFIGURATION_HOLD");
const [host,portText]=target.split(":");
if(!/^100\.\d+\.\d+\.\d+$/.test(host)||!Number.isInteger(Number(portText)))
 throw Error("FI_GATEWAY_SELFTEST_HOST_HOLD");
const ca=readFileSync(caPath);
const url="https://"+host+":"+portText+"/api/voice/mobile/status";
const result=await new Promise((resolve,reject)=>{
 const req=https.request(url,{method:"GET",ca,rejectUnauthorized:true,
  headers:{authorization:"Basic "+Buffer.from(username+":"+password).toString("base64")},
  timeout:10000},res=>{
  let size=0,body="";
  res.on("data",chunk=>{size+=chunk.length;if(size>16000){req.destroy(Error("TOO_MUCH_DATA"));return}body+=chunk.toString()});
  res.on("end",()=>resolve({http:res.statusCode,body}));
 });
 req.on("timeout",()=>req.destroy(Error("SELFTEST_TIMEOUT")));
 req.on("error",reject);
 req.end();
});
// The gateway accepts ONLY the iPhone peer's NetBird source address.
// A request from this Windows host to its own NetBird IP must be denied
// *after* the TLS certificate is validated. Do not widen the allowlist
// to make a local smoke test pass.
if(result.http!==403||!result.body.includes("VPN client address not allowed"))
 throw Error("FI_GATEWAY_SELFTEST_LOCAL_IP_MUST_BE_DENIED_HTTP_"+result.http);
// Independently verify the existing LOOPBACK voice endpoint is enabled.
// This does not claim the iPhone can reach the gateway until tested on iOS.
const local=await fetch("http://127.0.0.1:8789/api/voice/mobile/status",{
 signal:AbortSignal.timeout(10000)});
if(local.status!==200)throw Error("FI_GATEWAY_BACKEND_VOICE_STATUS_HTTP_"+local.status);
const status=await local.json();
if(status.code!=="FI_VOICE_MOBILE_UPLOAD_V1"||status.enabled!==true)
 throw Error("FI_GATEWAY_BACKEND_VOICE_NOT_ENABLED");
console.log("FI_IPHONE_GATEWAY_HTTPS_SELFTEST=PASS TLS=TRUSTED_LOCAL_CA LOCAL_PC_IP_DENIED=403 BACKEND_VOICE_UPLOAD=ENABLED");
console.log("FI_IPHONE_SAFARI_AUTHENTICATED_ACCESS=NOT_YET_TESTED_ON_PHONE");
