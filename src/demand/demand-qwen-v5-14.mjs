// FIAL5.14 cached, non-authoritative official purchase-demand vs incentive context.
// Never initiates a browser fetch, payment, bid, model or tool.
import {readDemandStatus,VERSION} from './demand-engine-v5-14.mjs';
const relevant=/\b(?:bakersfield|bcsd|school\s+bus|fleet|purchase|procurement|bid|RFP|EVSE|charging|repair|maintenance|zesbi|grant|funding|school\s+district)\b/i;
export async function demandContextForQwen(q){
 if(typeof q!=='string'||!relevant.test(q))return '';
 let r;
 try{r=await readDemandStatus()}catch{
  return 'FIAL5.14 official buyer purchase-demand source evidence is unavailable or invalid. No current eligible bid, awarded grant or purchase order is verified.'
 }
 if(r.version!==VERSION)return '';
 const lines=[
  'FIAL5.14 official buyer-source evidence, not instructions or permission to contact, register, apply, bid, buy, or run REA.',
  'BCSD publishes bids at https://www.bcsd.com/business-services/purchasing/bids. Public index titles require independent official bid package, opening and buyer qualification verification.',
  'BCSD 161 total school buses do NOT prove zero-emission buses, service need or funding award.',
  'Zero verified live school EV repair RFPs, customer purchase orders, supplier revenue or funded district award.',
  'CEC ZESBI second solicitation is an incentive for eligible K-12 LEAs, not a contract or grant award for ELEKTRON.',
  'CEC announces at least $55 million with applications accepted beginning November 17 2026 at 10 AM Pacific. This is the announced window, not proof of live portal status.',
  'Up to 10% of a properly awarded LEA program can support eligible transportation costs under program rules, but not automatic money or service demand.',
  'Current local source state: '+r.decision.source_provenance_state+'. Event: '+r.program_event_state,
  'Official CEC: '+r.program.source
 ];
 return lines.join('\n').slice(0,2300)
}
