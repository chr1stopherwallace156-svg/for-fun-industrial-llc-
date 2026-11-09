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
if(result.http!==200)throw Error("FI_GATEWAY_SELFTEST_HTTP_"+result.http);
let status;try{status=JSON.parse(result.body)}catch{throw Error("FI_GATEWAY_SELFTEST_INVALID_JSON")}
if(status.code!=="FI_VOICE_MOBILE_UPLOAD_V1"||status.enabled!==true||status.gatewayHttpsRequest!==true)
 throw Error("FI_GATEWAY_SELFTEST_VOICE_STATUS_HOLD");
console.log("FI_IPHONE_GATEWAY_HTTPS_SELFTEST=PASS TLS=TRUSTED_LOCAL_CA HTTP=200 VOICE_UPLOAD=ENABLED");
console.log("FI_IPHONE_SAFARI_CERT_TRUST=STILL_REQUIRES_PHONE_VERIFICATION");
