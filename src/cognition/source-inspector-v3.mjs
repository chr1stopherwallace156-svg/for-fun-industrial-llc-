import {lookup} from "node:dns/promises";
import {validatePublicUrl} from "./source-inspector-v1.mjs";
import {validateResolvedAddresses} from "./source-network-policy-v1.mjs";
import {inspectPinnedSource} from "./source-inspector-v2.mjs";
export async function inspectPolicyBoundSource({url,operatorApproved=false,dnsLookup=lookup,transport}){
if(operatorApproved!==true)throw Error("OPERATOR_APPROVAL_REQUIRED");
const target=validatePublicUrl(url);const hostname=new URL(target).hostname;
const resolved=await dnsLookup(hostname,{all:true});
const allowed=validateResolvedAddresses(resolved);
const pinnedLookup=async()=>allowed.map(address=>({address,family:4}));
return inspectPinnedSource({url:target,operatorApproved:true,dnsLookup:pinnedLookup,transport});
}
