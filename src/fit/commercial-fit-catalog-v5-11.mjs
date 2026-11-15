// FIAL5.11: independent user-initiated research of official agency documents.
// Named opportunities, dates and rules were independently reviewed Nov 14, 2026.
// Funding awards are NEVER direct service contracts and none qualify ELEKTRON.
export const VERSION='fial5.11-commercial-fit-source-catalog-v1';
export const OFFICIAL_SOURCES=Object.freeze([
 {id:'morgan-hill-engineering-rfp',url:'https://www.morganhill.ca.gov/DocumentCenter/View/58391/EE-RFP-Final?bidId=',
  host:'www.morganhill.ca.gov',kind:'pdf',ttl_hours:12,limit_bytes:5000000,
  relevance:'DIRECT_DESIGN_RFP_NOT_VEHICLE_CONVERSION',anchor:'%PDF-'},
 {id:'cec-nevi-gfo-25-603',url:'https://www.energy.ca.gov/solicitations/2026-02/gfo-25-603-californias-national-electric-vehicle-infrastructure-formula',
  host:'www.energy.ca.gov',kind:'html',ttl_hours:6,limit_bytes:450000,
  relevance:'GRANT_NOT_PROCUREMENT',anchor:'GFO-25-603'},
 {id:'scaqmd-charging-incentive',url:'https://www.scaqmd.gov/nav/grants-bids',
  host:'www.scaqmd.gov',kind:'html',ttl_hours:12,limit_bytes:550000,
  relevance:'INCENTIVE_NOT_PROCUREMENT',anchor:'PA2026-03R'}
].map(x=>Object.freeze(x)));
export const OPPORTUNITIES=Object.freeze([
 {
  id:'morgan-hill-evse-design-2026',
  name:'Professional Electrical Engineering Services — Area 1 EVSE Design',
  issuer:'City of Morgan Hill',
  geography:'Morgan Hill, Santa Clara County, CA',
  program_id:'NOV-2026-PROFESSIONAL-ELECTRICAL-ENGINEERING-SERVICES',
  kind:'DIRECT_PROFESSIONAL_DESIGN_RFP',
  official_document:OFFICIAL_SOURCES[0].url,
  source_id:OFFICIAL_SOURCES[0].id,
  submission_deadline_utc:'2026-11-24T01:00:00.000Z',
  deadline_local:'November 23, 2026, 5:00 PM Pacific',
  technical_scope:'EV charging infrastructure engineering design, PG&E coordination, stamped drawings and permitting; not vehicle conversion',
  source_buyer_role:'MUNICIPAL_ENGINEERING_CONSULTANT',
  eligibility_gates:[
   'Active California Electrical PE license for personnel stamping deliverables',
   'At least three comparable public-agency projects within the previous five years',
   'City of Morgan Hill business license upon selection',
   'Required City-acceptable professional insurance',
   'Wage theft prevention certification and separate signed fee proposal'
  ],
  fit:'CONDITIONAL_ENGINEERING_PARTNER_RESEARCH_ONLY',
  verified_licenses:[],
  verified_experience_count:null,
  verified_insurance:false,
  direct_bid_eligibility_verified:false,
  source_changed_is_eligibility:false,
  project_category:'EV_CHARGING_DESIGN',
  direct_contract: true,
  validated_award_usd:0
 },
 {
  id:'cec-nevi-gfo-25-603',
  name:'NEVI Solicitation 6 — Community Charging',
  issuer:'California Energy Commission',
  geography:'California statewide EV charging corridors',
  program_id:'GFO-25-603',
  kind:'GRANT_FUNDING_OPPORTUNITY',
  official_document:OFFICIAL_SOURCES[1].url,
  source_id:OFFICIAL_SOURCES[1].id,
  submission_deadline_utc:'2026-12-12T07:59:00.000Z',
  deadline_local:'December 11, 2026, 11:59 PM Pacific',
  technical_scope:'Competitive project funding for publicly accessible high-powered DC fast charging; not a service purchase order',
  source_buyer_role:'ELIGIBLE_PROJECT_APPLICANT_OR_PARTNER',
  eligibility_gates:[
   'CEC ECAMS registration and application requirements',
   'Program solicitation manual and addenda must be reviewed',
   'Project site control, cost share, applicant eligibility and NEVI/BABA obligations require verification',
   'No evidence of approved project developer or contracted charger installer'
  ],
  fit:'PROJECT_PARTNER_RESEARCH_ONLY_NOT_CONTRACT',
  verified_licenses:[],
  verified_experience_count:null,
  verified_insurance:false,
  direct_bid_eligibility_verified:false,
  source_changed_is_eligibility:false,
  project_category:'EV_CHARGING_INFRASTRUCTURE',
  direct_contract:false,
  validated_award_usd:0
 },
 {
  id:'scaqmd-pa2026-03r',
  name:'Charging Infrastructure Deployment Incentive Program',
  issuer:'South Coast AQMD',
  geography:'South Coast AQMD jurisdiction, Southern California',
  program_id:'PA2026-03R',
  kind:'INCENTIVE_REBATE_PROGRAM',
  official_document:OFFICIAL_SOURCES[2].url,
  source_id:OFFICIAL_SOURCES[2].id,
  submission_deadline_utc:'2027-01-13T23:00:00.000Z',
  deadline_local:'January 13, 2027, 3:00 PM Pacific',
  technical_scope:'Cost-reimbursement incentives for Class 4-8 goods-movement EV DC charging projects; no direct supplier procurement',
  source_buyer_role:'QUALIFYING_CHARGING_PROJECT_APPLICANT_OR_INSTALLER_PARTNER',
  eligibility_gates:[
   'Applicant must meet program scope and project-location requirements',
   'Project reimbursement and eligible-cost restrictions require manual review',
   'At least one EVITP-certified electrician on installation crew',
   'Federal or state sourcing and installation conditions require verification',
   'No proof ELEKTRON owns a qualifying charging project or meets installer rules'
  ],
  fit:'INSTALLER_OR_SITE_HOST_PARTNER_RESEARCH_ONLY',
  verified_licenses:[],
  verified_experience_count:null,
  verified_insurance:false,
  direct_bid_eligibility_verified:false,
  source_changed_is_eligibility:false,
  project_category:'CLASS_4_TO_8_EV_CHARGING',
  direct_contract:false,
  validated_award_usd:0
 }
].map(x=>Object.freeze({...x,eligibility_gates:Object.freeze(x.eligibility_gates),verified_licenses:Object.freeze(x.verified_licenses)})));
export const PROFILE=Object.freeze({
 business:'ELEKTRON INDUSTRIAL LLC',
 scope_areas:['VEHICLE_ELECTRIFICATION_RESEARCH','FLEET_TECHNICAL_SERVICES_RESEARCH','EV_CHARGING_PARTNER_RESEARCH'],
 no_certified_vehicle_conversion_claim:true,
 pe_electrical_license:'UNVERIFIED',
 public_agency_prior_projects:'UNVERIFIED',
 electrical_contractors_license:'UNVERIFIED',
 commercial_insurance:'UNVERIFIED',
 ev_itp_electrician:'UNVERIFIED',
 site_control:'UNVERIFIED',
 transportation_operator_license:'UNVERIFIED',
 approved_grant_applicant:'UNVERIFIED',
 revenue_usd:0
});
export const AUTHORITY=Object.freeze({emails_sent:0,bids_submitted:0,
 applications_submitted:0,contract_awards:0,revenue_usd:0,payments:0,
 rea_calls:0,model_calls:0,licenses_verified:0});
export function rankCommercialFit(entry,now=new Date()){
 if(!OPPORTUNITIES.includes(entry)||!(now instanceof Date)||!Number.isFinite(+now))throw Error('FIAL511_RANK_INPUT_INVALID');
 const deadlineFuture=now.getTime()<Date.parse(entry.submission_deadline_utc);
 const classification=entry.kind==='DIRECT_PROFESSIONAL_DESIGN_RFP'?
  'DIRECT_RFP_QUALIFICATION_GATES_UNVERIFIED':entry.kind==='GRANT_FUNDING_OPPORTUNITY'?
  'GRANT_NOT_A_DIRECT_CONTRACT':'REBATE_NOT_A_DIRECT_CONTRACT';
 return {id:entry.id,technical_overlap:entry.project_category,
  deadline_state:deadlineFuture?'PUBLISHED_DEADLINE_IN_FUTURE':'DEADLINE_ELAPSED',
  readiness_state:deadlineFuture?classification:'DEADLINE_EXPIRED_NOT_ACTIONABLE',
  direct_bid_ready:false,vendor_eligibility_verified:false,
  licenses_verified:false,insured_for_contract:false,
  contract_amount_usd_verified:0,
  follow_up:'VERIFY_ELIGIBILITY_PARTNER_ROUTE_SCOPE_AND_CURRENT_ISSUER_UPDATES',
  research_priority:entry.kind==='DIRECT_PROFESSIONAL_DESIGN_RFP'?40:
    entry.kind==='INCENTIVE_REBATE_PROGRAM'?32:30,
  score_semantics:'RESEARCH_ORDER_ONLY_NOT_WIN_PROBABILITY_OR_CONTRACT_VALUE'}
}
