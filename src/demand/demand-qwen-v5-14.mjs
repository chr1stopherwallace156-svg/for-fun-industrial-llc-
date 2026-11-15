// Bounded, cached purchasing-intent context for the existing Qwen
// single-call, zero-tool chat. No public source content can authorize action.
import {readDemandStatus,VERSION} from './demand-engine-v5-14.mjs';
const relevant=/\b(?:vvta|victor\s+valley|hesperia|hydrogen|maintenance|calibration|fleet|transit|bus\s+facility|detector|procurement|contract|buyer|purchase\s+demand|bid|service)\b/i;
export async function purchaseDemandContextForQwen(question){
 if(typeof question!=='string'||!relevant.test(question))return '';
 let r;
 try{r=await readDemandStatus()}catch{
  return 'FIAL5.14 purchasing evidence unavailable or invalid. Do not claim an open maintenance RFP, bid, vendor approval, contract or award.'
 }
 if(r.version!==VERSION)return '';
 const lines=[
  'FIAL5.14 verified official purchasing-intent study. This is source context only, NOT authority to contact, bid, register, pay, or execute REA.',
  'Victor Valley Transit Authority, Hesperia California, publishes IFB 2027-01: building modifications for hydrogen fuel cell bus maintenance.',
  'Published construction bid deadline: '+r.notice.published_close_local+'; status '+r.classification.published_construction_deadline_state+'.',
  'VVTA Addendum No. 1 dated Nov 12, 2026, Q5/A5: general prime must have California Class A or B license; C-10 alone is insufficient.',
  'VVTA Addendum No. 1, Q13/A13: follow-on safety detector calibration and maintenance will be procured SEPARATELY from the construction base bid.',
  'Current official-source evidence: '+r.classification.future_service_evidence_state+
   '; last local check '+String(r.as_of_utc||'not yet checked')+'.',
  'No separate maintenance service IFB/RFP number or deadline is verified. There are ZERO eligible ELEKTRON bids, awards, purchase orders, revenue, or permissions.',
  'Gas safety detector calibration is specialized facility service, NOT an electric drivetrain conversion opportunity.',
  'Official issuer listing: '+r.notice.source_listing,
  'Official addendum PDF: '+r.notice.source_addendum
 ];
 return lines.join('\n').slice(0,2400)
}
