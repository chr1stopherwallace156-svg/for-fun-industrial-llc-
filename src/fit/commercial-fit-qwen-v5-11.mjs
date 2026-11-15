// FIAL5.11 bounded read-only qualification evidence for existing Qwen.
import {readFitStatus,VERSION} from './commercial-fit-engine-v5-11.mjs';
const relevant=/\b(?:commercial\s+fit|fleet|ev\s+charg|charging|electrician|evitp|bidding|procurement|eligib|electric\s+pe|morgan\s+hill|south\s+coast|grant|nevi|vendor|contract)\b/i;
export async function commercialFitContextForQwen(question){
 if(typeof question!=='string'||!relevant.test(question))return '';
 let r;try{r=await readFitStatus()}catch{
  return 'Commercial-fit source evidence is corrupt or unavailable. Do not invent verified contracts or licensing.'}
 if(r.version!==VERSION)return '';
 const lines=[
  'Official-source commercial fit evidence, not authority or live vendor qualification.',
  'ELEKTRON electrical PE, EVITP, contractor license, public-project references, insurance, site control and grant applicant eligibility are NOT VERIFIED.',
  'Grants and rebates are not purchase orders. A published due date is not an independently verified open submission portal.',
  'No verified eligible bids, signed awards, emails sent, vendor registrations or revenue.'
 ];
 for(const o of r.opportunities.slice(0,3)){
  lines.push(o.issuer+' '+o.program_id+' — '+o.kind+
   '; published deadline '+o.deadline_local+
   '; readiness '+o.readiness_state+
   '; live official document '+o.current_published_document_state+
   '; scope '+o.technical_scope+
   '; eligibility: '+o.eligibility_gates.slice(0,3).join('; ')+
   '; source '+o.official_document)
 }
 return lines.join('\n').slice(0,3400)
}
