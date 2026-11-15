// FIAL5.10 source-reviewed procurement notices (as researched 2026-11-14).
// An official issuer's notice establishes scope and response date, not vendor eligibility.
// A historical third-party result never overrides the issuing agency's deadline.
export const VERSION='fial5.10-verified-procurement-catalog-v1';
export const SOURCE_REVIEW_DATE='2026-11-14';
export const OFFICIAL=Object.freeze({
 jurupaBids:'https://jurupausd.org/our-district/BizServ/css/Pages/Bids.aspx',
 jurupaNotice:'https://jurupausd.org/our-district/BizServ/css/Bid%20Documents/26-27-02TR%20-Notice%20Inviting%20Bids.pdf',
 jurupaPortal:'https://pbsystem.planetbids.com/portal/60604/portal-home',
 carlsbadBids:'https://www.carlsbadusd.net/current-bids',
 bonsallBids:'https://www.bonsallusd.com/apps/pages/purchasing',
 bon13:'https://drive.google.com/file/d/1Q_rCUNbP9eOynhH8tFggQHZfEhsldjfC/view?usp=sharing',
 bon14:'https://drive.google.com/file/d/1bha6GQpWsQzoow0YYyEwO56HehoQyplR/view?usp=sharing',
 calEprocure:'https://www.dgs.ca.gov/PD/Resources/Page-Content/Procurement-Division-Resources-List-Folder/Cal-eProcure-Portal-to-Access-Bid-Opportunities'
});
export const SOURCE_WATCH=Object.freeze([
 {id:'jurupa-official-bids',url:OFFICIAL.jurupaBids,host:'jurupausd.org',
  media:'html',refresh_hours:6,max_bytes:300000,
  issuer:'Jurupa Unified School District',
  expected_notice_id:'26-27-02TR',linked_notice_source:OFFICIAL.jurupaNotice},
 {id:'jurupa-signed-notice',url:OFFICIAL.jurupaNotice,host:'jurupausd.org',
  media:'pdf',refresh_hours:6,max_bytes:1000000,
  issuer:'Jurupa Unified School District',expected_notice_id:'26-27-02TR'},
 {id:'carlsbad-official-bids',url:OFFICIAL.carlsbadBids,host:'www.carlsbadusd.net',
  media:'html',refresh_hours:12,max_bytes:350000,
  issuer:'Carlsbad Unified School District',expected_notice_id:'RFB 2627-10'},
 {id:'bonsall-official-bids',url:OFFICIAL.bonsallBids,host:'www.bonsallusd.com',
  media:'html',refresh_hours:24,max_bytes:260000,
  issuer:'Bonsall Unified School District',expected_notice_id:'2027-13'}
].map(x=>Object.freeze(x)));

export const NOTICES=Object.freeze([
 {id:'jurupa-26-27-02tr',issuer:'Jurupa Unified School District',
  city:'Jurupa Valley',notice_id:'26-27-02TR',title:'Student Transportation Services',
  kind:'RFP',scope:'Qualified operators to provide special education buses, small vehicle, field trips and coach transportation for five-year contracts beginning July 1, 2027.',
  source_url:OFFICIAL.jurupaNotice,listing_url:OFFICIAL.jurupaBids,
  submission_url:OFFICIAL.jurupaPortal,
  deadline_local:'2026-12-11T14:00:00-08:00',
  questions_deadline_local:'2026-11-18T12:00:00-08:00',
  prebid_local:'2026-11-16T10:00:00-08:00',
  source_page:1,reviewed_on:SOURCE_REVIEW_DATE,
  source_ids:['jurupa-official-bids','jurupa-signed-notice'],
  source_authority:'ISSUING_DISTRICT_OFFICIAL_PDF_LINKED_ON_DISTRICT_BID_PAGE',
  confirmation:'OFFICIAL_ISSUER_NOTICE_ID_SCOPE_DEADLINE_AND_PORTAL_REVIEWED',
  sector:'student_transportation_operations',
  vendor_fit:'NOT_VERIFIED_TRANSPORTATION_CARRIER_REQUIREMENTS',
  conversion_opportunity_verified:false,bidding_eligibility_verified:false,
  possible_relevance:'Transportation operator relationship and future fleet service research only; solicitation is not a vehicle conversion or maintenance RFP',
  procurement_contact:'Lindsey Hopson, Senior Buyer, lindsey_hopson@jusd.k12.ca.us',
  official_source_may_require_addenda_review:true},
 {id:'carlsbad-rfb-2627-10',issuer:'Carlsbad Unified School District',
  city:'Carlsbad',notice_id:'RFB 2627-10',title:'Fleet Vehicles',
  kind:'RFB',scope:'New fleet vehicle procurement; third-party sites report inconsistent response dates.',
  source_url:OFFICIAL.carlsbadBids,listing_url:OFFICIAL.carlsbadBids,
  submission_url:null,
  deadline_local:'2026-11-04T16:00:00-07:00',
  source_page:null,reviewed_on:SOURCE_REVIEW_DATE,
  source_ids:['carlsbad-official-bids'],
  source_authority:'DISTRICT_OFFICIAL_BID_TABLE_CONTROLS_OVER_THIRD_PARTY',
  confirmation:'OFFICIAL_ISSUER_LISTS_NOVEMBER_4_DEADLINE_CONFLICTING_AGGREGATORS',
  vendor_fit:'REQUIRES_CURRENT_NOTICE_AND_VENDOR_REVIEW',
  sector:'fleet_vehicle_purchase',conversion_opportunity_verified:false,
  bidding_eligibility_verified:false,possible_relevance:'Fleet supply or upfitting research; official listed deadline already passed',
  procurement_contact:null,official_source_may_require_addenda_review:true},
 {id:'bonsall-bid-2027-13',issuer:'Bonsall Unified School District',
  city:'Bonsall',notice_id:'2027-13',title:'Home to School Transportation',
  kind:'IFB',scope:'District-owned public purchasing page links to official document hosted on Google Drive. Exact response deadline needs primary-document verification.',
  source_url:OFFICIAL.bon13,listing_url:OFFICIAL.bonsallBids,
  submission_url:null,
  deadline_local:null,source_page:null,reviewed_on:SOURCE_REVIEW_DATE,
  source_ids:['bonsall-official-bids'],
  source_authority:'DISTRICT_LINKED_DOCUMENT_PRIMARY_DEADLINE_NOT_VERIFIED',
  confirmation:'OFFICIAL_DISTRICT_LISTS_NOTICE_BUT_DEADLINE_UNVERIFIED',
  vendor_fit:'TRANSPORTATION_CARRIER_REQUIREMENTS_NOT_VERIFIED',
  sector:'student_transportation_operations',conversion_opportunity_verified:false,
  bidding_eligibility_verified:false,possible_relevance:'Potential school fleet operating services only',
  procurement_contact:null,official_source_may_require_addenda_review:true},
 {id:'bonsall-bid-2027-14',issuer:'Bonsall Unified School District',
  city:'Bonsall',notice_id:'2027-14',title:'Field Trips Transportation Services',
  kind:'IFB',scope:'District-owned purchasing page links to official document hosted on Google Drive. Primary deadline and eligibility await review.',
  source_url:OFFICIAL.bon14,listing_url:OFFICIAL.bonsallBids,
  submission_url:null,deadline_local:null,source_page:null,reviewed_on:SOURCE_REVIEW_DATE,
  source_ids:['bonsall-official-bids'],
  source_authority:'DISTRICT_LINKED_DOCUMENT_PRIMARY_DEADLINE_NOT_VERIFIED',
  confirmation:'OFFICIAL_DISTRICT_LISTS_NOTICE_BUT_DEADLINE_UNVERIFIED',
  vendor_fit:'TRANSPORTATION_CARRIER_REQUIREMENTS_NOT_VERIFIED',
  sector:'student_transportation_operations',conversion_opportunity_verified:false,
  bidding_eligibility_verified:false,possible_relevance:'Potential school fleet operating services only',
  procurement_contact:null,official_source_may_require_addenda_review:true}
].map(x=>Object.freeze(x)));
export function noticeStatus(n,sourceStatuses,{now=new Date()}={}){
 if(!n||typeof n!=='object'||!Number.isFinite(+now))throw Error('FIAL510_NOTICE_INPUT_INVALID');
 if(!Array.isArray(n.source_ids)||!Array.isArray(sourceStatuses))throw Error('FIAL510_SOURCE_STATUS_INVALID');
 const byId=new Map(sourceStatuses.map(x=>[x.id,x]));
 const sourceOK=n.source_ids.every(id=>byId.get(id)?.state==='SOURCE_RETRIEVED'&&
  typeof byId.get(id)?.sha256==='string'&&/^[a-f0-9]{64}$/.test(byId.get(id).sha256)&&
  byId.get(id)?.content_state==='EXPECTED_NOTICE_PRESENT'&&
  byId.get(id)?.review_state!=='CHANGED_REQUIRES_HUMAN_REVIEW');
 const instant=n.deadline_local?Date.parse(n.deadline_local):NaN;
 const timeValid=Number.isFinite(instant)&&n.deadline_local?.endsWith(/./);
 if(!Number.isFinite(instant))
  return {status:'PRIMARY_DEADLINE_UNVERIFIED',deadline_epoch_ms:null,is_open_verified:false,source_verified:sourceOK};
 if(+now>=instant)
  return {status:'CLOSED_BY_OFFICIAL_ISSUER_DEADLINE',deadline_epoch_ms:instant,is_open_verified:false,source_verified:sourceOK};
 if(!sourceOK)
  return {status:'SOURCE_HOLD_NO_OPEN_CLAIM',deadline_epoch_ms:instant,is_open_verified:false,source_verified:false};
 if(n.id==='jurupa-26-27-02tr'&&n.confirmation==='OFFICIAL_ISSUER_NOTICE_ID_SCOPE_DEADLINE_AND_PORTAL_REVIEWED')
  return {status:'OPEN_PER_REVIEWED_OFFICIAL_ISSUER_NOTICE',deadline_epoch_ms:instant,
   is_open_verified:true,source_verified:true};
 return {status:'OFFICIAL_DATE_REVIEW_REQUIRED',deadline_epoch_ms:instant,is_open_verified:false,source_verified:sourceOK};
}
export function classifyRelevance(n){
 if(!n||typeof n.title!=='string'||typeof n.scope!=='string')throw Error('FIAL510_RELEVANCE_INPUT_INVALID');
 const direct=/(electric vehicle conversion|fleet electrification conversion|ev powertrain retrofit)/i.test(n.scope);
 return {service_alignment:direct?'RESEARCH_POTENTIAL_CONVERSION_FIT':'ADJACENT_OR_UNVERIFIED_NOT_CONVERSION',
  evidence_based_vendor_fit:false,contract_value_usd:null,win_probability:null,
  submit_authorized:false,verified_owner_vehicles:false,priority:'OPERATOR_REVIEW_REQUIRED'};
}
