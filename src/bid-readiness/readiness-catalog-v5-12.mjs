// FIAL5.12 — Two verified *commercial pathways*, not qualified bids.
// Source: City of Long Beach official bid PW-26-800/R-7282 (Nov. 2026);
// ZESBI official eligible-cost categories and CSLB classification.
// Unverified company credentials are NEVER converted to true by model text.
export const VERSION='fial5.12-bid-readiness-catalog-v1';
export const SOURCES=Object.freeze([
 Object.freeze({
  id:'long-beach-r7282',type:'html',max_bytes:650000,ttl_hours:6,
  host:'longbeachbuys.buyspeed.com',
  url:'https://longbeachbuys.buyspeed.com/bso/external/bidDetail.sda?docId=PW-26-800&external=true&parentUrl=close',
  anchors:['PW-26-800','R-7282','Fleet Services EV Charging Depot'],
  publisher:'CITY_OF_LONG_BEACH_OFFICIAL_BUYER_PORTAL'
 }),
 Object.freeze({
  id:'zesbi-eligible-costs',type:'html',max_bytes:450000,ttl_hours:12,
  host:'californiazesbi.org',
  url:'https://californiazesbi.org/applicants/eligible-costs/',
  anchors:['School Transportation Program','ZE School Bus Repairs','Maintenance Contracts'],
  publisher:'ZESBI_PROGRAM_MANAGERS_OFFICIAL_ELIGIBLE_COSTS'
 }),
 Object.freeze({
  id:'cslb-c10-class',type:'html',max_bytes:350000,ttl_hours:72,
  host:'web.cslb.ca.gov',
  url:'https://web.cslb.ca.gov/About_Us/Library/Licensing_Classifications/Licensing_Classifications_Detail.aspx?Class=C10',
  anchors:['C-10','Electrical Contractor'],
  publisher:'CA_CONTRACTORS_STATE_LICENSE_BOARD_CLASSIFICATION'
 })
]);
export const LEADS=Object.freeze([
 Object.freeze({
  id:'long-beach-depot',
  buyer:'City of Long Beach, Public Works',
  title:'R-7282 Fleet Services EV Charging Depot',
  solicitation_number:'PW-26-800',
  type:'DIRECT_CONSTRUCTION_SOLICITATION',
  source_id:'long-beach-r7282',
  source_url:SOURCES[0].url,
  published_deadline_utc:'2026-11-20T19:00:00.000Z',
  deadline_local:'Nov 20, 2026 at 11:00 AM PST',
  source_scope:'Install five dual-port DC fast chargers, battery energy storage, electrical switchgear, conduit, wiring and hardscape improvements',
  scope_overlap:'FLEET_EVSE_INFRASTRUCTURE_NOT_VEHICLE_CONVERSION',
  mandatory_prebid_local:'Oct 27, 2026; virtual conference and on-site walkthrough; attendance not verified',
  requirement_evidence:[
   'California Class B contractor license for general prime',
   'California C-10 license for EVSE-installing contractors or subcontractors',
   'EVITP-certified personnel for EVSE installation',
   'IBEW signatory for EVSE-installation contractors/subcontractors',
   'Mandatory Oct 27 prebid conference and job-site walkthrough; attendance unverified',
   'DIR prevailing wage, project labor agreement and applicable insurance/bonding',
   'Verify applicable similar-project minimums and all addenda in original specifications'
  ],
  hard_gates:['class_b_prime_license','c10_installation_license',
   'evitp','ibew','mandatory_prebid_attendance','similar_project_experience',
   'insurance_bonding_and_dir','current_submission_portal_status'],
  commercial_pathway:'QUALIFIED_PRIME_OR_SUBCONTRACT_REVIEW_ONLY',
  direct_bid_status:'BLOCKED_UNVERIFIED_CREDENTIALS_AND_MANDATORY_ATTENDANCE',
  partner_role_status:'PARTNER_REQUIRES_PROOF_SCOPE_AND_ALLOWED_SUBCONTRACTING',
  contract_value_usd_verified:0,contract_awarded:false
 }),
 Object.freeze({
  id:'zesbi-school-bus-maintenance',
  buyer:'California K-12 LEA transportation departments receiving ZESBI awards',
  title:'ZESBI School Transportation Program — eligible repair and training costs',
  solicitation_number:'ZESBI-STP-ELIGIBLE-COST-CATEGORIES',
  type:'PROGRAM_ELIGIBLE_COST_PATHWAY_NOT_A_PROCUREMENT',
  source_id:'zesbi-eligible-costs',
  source_url:SOURCES[1].url,
  published_deadline_utc:null,deadline_local:'No supplier bid deadline identified',
  source_scope:'Out-of-warranty zero-emission school bus repairs, parts, maintenance contracts, fleet plans, charging equipment repairs, diagnostic and high-voltage shop equipment, technician training',
  scope_overlap:'CONDITIONAL_VEHICLE_REPAIR_TRAINING_SHOP_EQUIPMENT',
  mandatory_prebid_local:null,
  requirement_evidence:[
   'Eligible applicant is an LEA transportation department, not an automatic ELEKTRON grant award',
   'LEA must actually receive a ZESBI award and have eligible costs in its grant agreement',
   'Costs are subject to the up-to-10-percent STP cap and program conditions',
   'Actual current LEA needs, written scope, procurement rules and vendor approvals are not established',
   'Service authorization, repair competence, OEM warranty restrictions, business insurance and pricing need review'
  ],
  hard_gates:['verified_lea_recipient_and_budget','actual_purchasing_notice_or_direct_authorized_scope',
   'service_qualification_and_insurance','work_within_award_period','buyer_approval'],
  commercial_pathway:'DIRECT_LEA_SERVICE_RESEARCH_ONLY',
  direct_bid_status:'NO_PUBLISHED_VENDOR_RFP_VERIFIED',
  partner_role_status:'POTENTIAL_MAINTENANCE_TRAINING_OR_SHOP_EQUIPMENT_VENDOR',
  contract_value_usd_verified:0,contract_awarded:false
 })
]);
export const QUALIFICATIONS=Object.freeze({
 company:'ELEKTRON INDUSTRIAL LLC',
 bar_automotive_repair_registration:'UNVERIFIED_FOR_SPECIFIC_SERVICE',
 cslb_class_b:'UNVERIFIED',cslb_class_c10:'UNVERIFIED',
 electrical_pe:'UNVERIFIED',evitp:'UNVERIFIED',ibew_signatory:'UNVERIFIED',
 dir_registration:'UNVERIFIED',bonding:'UNVERIFIED',commercial_insurance:'UNVERIFIED',
 bid_conference_attended:'UNVERIFIED',jobsite_walkthrough_attended:'UNVERIFIED',
 oem_certification:'UNVERIFIED',current_buyer_vendor_account:'UNVERIFIED',
 funded_lea_approved_scope:'UNVERIFIED',
 verified_signed_contracts:0,verified_revenue_usd:0
});
export const BOUNDARIES=Object.freeze({
 bids_submitted:0,emails_sent:0,registrations_made:0,applications_submitted:0,
 payments_made:0,rea_tool_calls:0,model_calls:0,
 verified_bid_ready:0,awarded_contracts:0,verified_revenue_usd:0
});
export function stage(lead,now=new Date()){
 if(!LEADS.includes(lead)||!(now instanceof Date)||!Number.isFinite(+now))
  throw Error('FIAL512_INPUT_INVALID');
 const deadline=lead.published_deadline_utc;
 const dateStatus=deadline?(now.getTime()<Date.parse(deadline)?
  'FUTURE_PUBLISHED_DEADLINE':'PUBLISHED_DEADLINE_EXPIRED'):'NO_VENDOR_BID_DEADLINE';
 return Object.freeze({lead_id:lead.id,
  deadline_state:dateStatus,
  fit_state:lead.type==='DIRECT_CONSTRUCTION_SOLICITATION'?
   'RELEVANT_EVSE_WORK_BUT_DIRECT_BID_BLOCKED':'POTENTIAL_LEA_SERVICE_PATH_NOT_A_RFP',
  direct_bid_ready:false,verified_eligibility:false,
  next_action:lead.type==='DIRECT_CONSTRUCTION_SOLICITATION'?
   'VERIFY_MANDATORY_ATTENDANCE_CSLB_C10_IBEW_EVITP_INSURANCE_OR_QUALIFIED_PRIME_PARTNER':
   'VERIFY_AWARDED_LEA_AND_ACTUAL_BUS_REPAIR_OR_TRAINING_PROCUREMENT',
  revenue_projection_usd:null,
  current_portal_accepting_bids_verified:false})
}
