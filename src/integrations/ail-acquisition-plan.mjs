// RAEM-014: fail-closed source acquisition plan, not a network client.
// No URL is embedded: real AIL endpoint and API version must be verified first.
import {isAbsolute,resolve,extname} from 'node:path';
import {validateAilSource} from './ail-source-registry.mjs';
const idPattern=/^[a-z][a-z0-9_-]{2,47}$/;
const shaPattern=/^[a-f0-9]{64}$/;
export function planAilAcquisition(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).sort().join(',')!=='destination,expectedSha256,sourceId,sourceKind')
  throw Error('RAEM014_PLAN_INVALID');
 const {destination,expectedSha256,sourceId,sourceKind}=input;
 if(sourceKind!=='operator_supplied_metadata_export'||!idPattern.test(sourceId)||
  !shaPattern.test(expectedSha256)||typeof destination!=='string'||
  !isAbsolute(destination)||resolve(destination)!==destination||
  !['.jsonl'].includes(extname(destination).toLowerCase())||destination.startsWith('\\\\'))
  throw Error('RAEM014_PLAN_INVALID');
 const source=validateAilSource({id:sourceId,path:destination,expectedSha256});
 return Object.freeze({
  state:'PLAN_ONLY',sourceKind,sourceId:source.id,expectedSha256:source.expectedSha256,
  destination:source.path,maxBytes:4*1024*1024,maxRecords:512,
  networkEnabled:false,automaticRefresh:false,requiresOperatorApproval:true,
  nextStep:'VERIFY_LOCAL_EXPORT_WITH_RAEM013',
  note:'No provider endpoint, credentials or live acquisition authority is configured.'
 });
}
export function validateAilNetworkCandidate(input){
 // Deliberate hold until source identity, API schema and trust policy are independently verified.
 if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)))throw Error('RAEM014_NETWORK_CANDIDATE_INVALID');
 return Object.freeze({state:'HOLD',reason:'LIVE_AIL_ENDPOINT_NOT_VERIFIED',
  networkEnabled:false,requiresOperatorApproval:true});
}
