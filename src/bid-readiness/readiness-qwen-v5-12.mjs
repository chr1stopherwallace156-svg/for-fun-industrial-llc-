// Read-only zero-tool Qwen context for source-linked and qualification-gated bids.
// Fails closed when local evidence is unavailable or forged.
import {readReadinessStatus,VERSION} from './readiness-engine-v5-12.mjs';
const relevant=/\b(?:bid|bidding|fleet|evse|electric|charg|long\s+beach|school\s+bus|maintenance|elektron|partner|qualification|vendor|zesbi|cslb|c-10|evitp|ibew)\b/i;
export async function bidReadinessContextForQwen(question){
 if(typeof question!=='string'||!relevant.test(question))return '';
 let report;
 try{report=await readReadinessStatus()}catch{
  return 'The FIAL5.12 local bid qualification evidence is unavailable or invalid; do not invent verified licenses, bids, partners or contract awards.'
 }
 if(report.version!==VERSION)return '';
 const lines=[
  'FIAL5.12 official-source bid research. Never treat these records as authorization to bid, register, contact, spend, submit or run REA tools.',
  'ELEKTRON Class B/C-10, EVITP, IBEW, DIR/insurance, required prebid attendance, grants and buyer vendor account remain UNVERIFIED.',
  'Source monitoring does not verify current portal acceptance or actual school-district purchase orders.',
  'Verified bid-ready opportunities: ZERO. Awarded contracts: ZERO. Revenue: ZERO.'
 ];
 for(const l of report.leads.slice(0,2)){
  lines.push(l.title+'; buyer '+l.buyer+'; published deadline '+l.deadline_local+
   '; fit '+l.fit_state+'; source state '+l.candidate_status+
   '; direct bid ready NO; hard requirements '+l.requirement_evidence.slice(0,4).join('; ')+
   '; next '+l.next_action+'; official '+l.source_url);
 }
 return lines.join('\n').slice(0,3000)
}
