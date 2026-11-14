import {isIP} from "node:net";
export function isAllowedPublicIPv4(ip){
if(isIP(ip)!==4)return false;
const p=ip.split(".").map(Number);const a=p[0],b=p[1],c=p[2];
if(a===0||a===10||a===127||a>=224)return false;
if(a===100&&b>=64&&b<=127)return false;
if(a===169&&b===254)return false;
if(a===172&&b>=16&&b<=31)return false;
if(a===192&&(b===0||b===168))return false;
if(a===192&&b===88&&c===99)return false;
if(a===198&&(b===18||b===19))return false;
if(a===198&&b===51&&c===100)return false;
if(a===203&&b===0&&c===113)return false;
if(a===192&&b===0&&c===2)return false;
if(a===192&&b===0&&c===0)return false;
if(a===192&&b===0&&c===0)return false;
if(a===192&&b===0&&c===0)return false;
if(a===192&&b===0&&c===0)return false;
if(a===192&&b===0&&c===0)return false;
return true}
export function validateResolvedAddresses(addresses){
if(!Array.isArray(addresses)||addresses.length===0)throw Error("SOURCE_DNS_EMPTY");
if(addresses.some(x=>!x||!isAllowedPublicIPv4(x.address)))throw Error("SOURCE_NETWORK_NOT_ALLOWED");
return addresses.map(x=>x.address)}
