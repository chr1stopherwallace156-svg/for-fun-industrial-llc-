// FIAL5.14: fixed, official VVTA buying intent (not an award).
// Reviewed 2026-11-15: VVTA procurement page and 2026-11-12 Addendum 1,
// Q5/A5 and Q13/A13. Binary PDF GET is NOT semantic PDF re-parsing.
export const CATALOG_VERSION='fial5.14-vvta-official-purchase-intent-v1';
export const SOURCES=Object.freeze([
 Object.freeze({
  id:'vvta-published-ifb-listing',
  url:'https://vvta.org/procurement/',
  host:'vvta.org',type:'html',ttl_hours:6,max_bytes:500000,
  required_identifier:'IFB 2027-01'
 }),
 Object.freeze({
  id:'vvta-ifb-2027-01-addendum-1',
  url:'https://vvta.org/wp-content/uploads/2026/10/2027-01-Addendum-No.-1.pdf',
  host:'vvta.org',type:'pdf',ttl_hours:24,max_bytes:4000000,
  required_identifier:'IFB 2027-01 / Addendum No. 1 (PDF, 3 pages)'
 })
]);
export const VVTA=Object.freeze({
 issuer:'Victor Valley Transit Authority',
 issuer_location:'17150 Smoke Tree Street, Hesperia, California',
 solicitation:'IFB 2027-01',
 title:'Building Modifications for Hydrogen Fuel Cell Bus Maintenance',
 published:'2026-10-12',
 source_listing:SOURCES[0].url,
 source_addendum:SOURCES[1].url,
 addendum_issue_date:'2026-11-12',
 published_close_utc:'2026-11-19T23:00:00.000Z',
 published_close_local:'November 19, 2026 at 3:00 PM PST',
 procurement_type:'ACTIVE_MAINTENANCE_FACILITY_CONSTRUCTION_IFB',
 construction_scope:'Hydrogen/CH4/CO gas detection, flame detection, alarms, integration and commissioning at a bus maintenance facility',
 mandatory_bid_bond_percent:10,
 prebid_conference:'October 27, 2026 — nonmandatory per IFB; already past',
 prime_classification_addendum_q5:'California Class A or B construction contractor license; C-10 alone is NOT acceptable',
 addendum_q13:'Follow-on calibration and maintenance services will be procured separately; the original base bid does not include scheduled calibration visits or replacement service',
 future_service_category:'FACILITY_SAFETY_DETECTOR_CALIBRATION_AND_MAINTENANCE',
 future_service_status:'DOCUMENTED_FOLLOW_ON_PURCHASING_INTENT_NOT_PUBLISHED_SERVICE_RFP',
 maintenance_service_solicitation_id_verified:null,
 future_maintenance_due_date_verified:null,
 buyer_portal_accepting_submissions_verified:false,
 site_visit_or_prebid_attendance_verified:false,
 elektrik_direct_construction_eligibility_verified:false,
 elektron_specialty_maintenance_eligibility_verified:false,
 future_maintenance_award_verified:false,
 subcontractor_or_prime_partner_verified:false,
 contract_price_usd_verified:0,
 awarded_contracts:0,revenue_usd:0,
 document_reference:'VVTA IFB 2027-01 ADDENDUM 1, page 1 Q5/A5 and page 2 Q13/A13',
 review_scope:'Reviewed published PDF text; running software checks binary integrity, not PDF semantic equivalence'
});
export const QUALIFICATION_GATES=Object.freeze([
 'CHECK_ALL_OFFICIAL_ADDENDA_AND_SUBMISSION_PORTAL_CURRENT_STATUS',
 'DIRECT_GENERAL_PRIME_REQUIRES_CURRENT_CA_A_OR_B_LICENSE',
 'VERIFY_DIR_PREVAILING_WAGE_INSURANCE_AND_TEN_PERCENT_BID_SECURITY',
 'VERIFY_SPECIALTY_GAS_DETECTION_AND_CALIBRATION_SERVICE_COMPETENCE',
 'VERIFY_ELEKTRON_OR_PARTNER_CONTRACTOR_LICENSE_INSURANCE_AND_CERTIFICATIONS',
 'WAIT_FOR_SEPARATELY_PUBLISHED_CALIBRATION_MAINTENANCE_RFP_OR_AUTHORIZED_SCOPE',
 'NO_BID_NO_CONTACT_NO_VENDOR_REGISTRATION_WITHOUT_OPERATOR_APPROVAL'
]);
export const AUTHORITY=Object.freeze({
 emails_sent:0,phone_calls:0,government_forms:0,bids_submitted:0,
 vendor_accounts_created:0,site_visits:0,service_work_started:0,
 orders_received:0,contracts_awarded:0,revenue_usd:0,
 models_started:0,model_calls:0,rea_calls:0
});
export function classify({listing=false,addendum=false}={},now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(+now))throw Error('FIAL514_CLOCK_INVALID');
 const deadline=Date.parse(VVTA.published_close_utc),inFuture=+now<deadline;
 return {
  published_construction_deadline_state:inFuture?'BEFORE_PUBLISHED_CLOSING':'PUBLISHED_CLOSING_ELAPSED',
  construction_source_state:listing&&addendum&&inFuture?
   'OFFICIAL_IFB_PUBLISHED_FUTURE_DEADLINE_PORTAL_NOT_VERIFIED':'SOURCE_OR_DEADLINE_REQUIRES_REVIEW',
  documented_future_service_intents:listing&&addendum?1:0,
  future_service_evidence_state:listing&&addendum?
   'HUMAN_REVIEWED_OFFICIAL_ADDENDUM_FOLLOW_ON_PURCHASE_INTENT':
   'OFFICIAL_ADDENDUM_EVIDENCE_MISSING_OR_STALE',
  current_service_rfps_verified:0,qualified_elektron_bids:0,
  expected_revenue_usd:null,open_specialty_service_procurement_verified:false,
  vendor_approval_verified:false,
  supporting_pdf_semantically_reparsed_by_runtime:false,
  direct_submission_authorized:false,
  contract_awarded:false
 }
}
export function validateProcurementHtml(html){
 if(typeof html!=='string'||html.length>500000)return false;
 const stripped=html.replace(/<[^>]*>/g,' ')
  .replace(/&(?:nbsp|#160);/gi,' ').replace(/\s+/g,' ');
 return /IFB\s*2027-01/i.test(stripped)&&
  /Building Modifications (?:for )?Hydrogen Fuel Cell Bus Maintenance/i.test(stripped)&&
  /IFB\s*2027-01.{0,650}\bOpen\b/i.test(stripped)&&
  /2027-01-Addendum-No\.-1\.pdf/i.test(html);
}
