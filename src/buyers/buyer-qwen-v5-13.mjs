// FIAL5.13: bounded published school buyer evidence in existing local Qwen.
// Cached local facts never authorize buyer outreach, vendor entry or REA calls.
import {readBuyerStatus,VERSION} from './buyer-engine-v5-13.mjs';
const relevant=/\b(?:bakersfield|bcsd|fleet\s+customer|school\s+district|school\s+bus|fleet\s+sales|bus\s+maintenance|purchasing|vendor\s+route|zesbi|school\s+fleet|purchase\s+order|buyer)\b/i;
export async function buyerContextForQwen(question){
 if(typeof question!=='string'||!relevant.test(question))return '';
 let r;
 try{r=await readBuyerStatus()}catch{
  return 'FIAL5.13 source evidence unavailable or tampered. Do not claim a purchasing contract, awarded grant, contact permission or revenue.'
 }
 if(r.version!==VERSION)return '';
 const lines=[
  'FIAL5.13 BCSD official-source buyer and purchasing evidence, NOT permission to contact.',
  'Bakersfield City School District publishes 161 school buses and its own maintenance staff. This is total published school buses, NOT a verified electric-bus count.',
  'Bids are announced through BCSD PlanetBids; BCSD Stores and Purchasing controls purchase orders and requires prior authorization for site visits.',
  'BCSD has NOT been verified to need a zero-emission bus repair, have a ZESBI incentive recipient award, approve ELEKTRON, issue a repair RFP, or purchase any service.',
  'Potential work research: out-of-warranty ZE bus repair and diagnostics, high-voltage safety/shop tools, EVSE diagnostics and qualified technician training.',
  'Program-eligible costs are not purchase orders; no budgets, signed PO, revenue, contact approval or qualified service provider is verified.',
  'Buyer evidence state: '+r.decision.buyer_evidence_state+'; last local public-source check '+String(r.as_of_utc||'not activated'),
  'Official fleet: https://www.bcsd.com/business-services/transportation',
  'Official bids: https://www.bcsd.com/business-services/purchasing/bids',
  'Official vendor policy: https://www.bcsd.com/business-services/purchasing/vendor-relations'
 ];
 return lines.join('\n').slice(0,2400)
}
