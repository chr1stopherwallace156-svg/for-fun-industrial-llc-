// FIAL5.14: official buyer notices are different from LEA incentives.
// Research-only. Public evidence does not create sales, funding eligibility or rights.
export const VERSION='fial5.14-purchase-demand-catalog-v1';
export const SOURCES=Object.freeze([
 {id:'bcsd-active-bids',url:'https://www.bcsd.com/business-services/purchasing/bids',
  host:'www.bcsd.com',ttl_hours:12,max_bytes:650000,
  anchors:['Active Bids','Awarded Bids','PlanetBids'],kind:'BUYER_SOLICITATIONS'},
 {id:'cec-zesbi-second-solicitation',url:'https://www.energy.ca.gov/solicitations/2026-11/zero-emission-school-bus-and-infrastructure-zesbi-incentive-project-second',
  host:'www.energy.ca.gov',ttl_hours:24,max_bytes:650000,
  anchors:['Zero-Emission School Bus','November 17','55 million'],kind:'FUNDING_TO_SCHOOL_AGENCIES'},
 {id:'zesbi-applicant-faq',url:'https://californiazesbi.org/applicants/faqs/',
  host:'californiazesbi.org',ttl_hours:24,max_bytes:650000,
  anchors:['November 17','second solicitation'],kind:'APPLICATION_PROGRAM_RULES'}
].map(s=>Object.freeze({...s,anchors:Object.freeze(s.anchors)})));
export const BUYER=Object.freeze({
 id:'bakersfield-city-school-district',
 name:'Bakersfield City School District',
 publicly_reported_school_buses:161,
 buyer_bid_list:SOURCES[0].url,
 vendor_process:'BCSD PlanetBids and Stores/Purchasing',
 buyer_ev_bus_count_verified:null,
 buyer_ev_service_need_verified:false,
 direct_elektron_bid_verified:false,
 validated_buyer_purchase_order:false,
 business_revenue_usd:0
});
export const PROGRAM=Object.freeze({
 id:'zesbi-second-solicitation-2026',
 name:'California ZESBI — Second Solicitation',
 lead_agency:'California Energy Commission',
 eligible_applicant_type:'ELIGIBLE_LOCAL_EDUCATIONAL_AGENCY_NOT_ELEKTRON',
 opening_local:'2026-11-17T10:00:00-08:00',
 officially_announced_funds_minimum_usd:55000000,
 allowed_stp_share_max_fraction:0.10,
 eligible_service_categories:['zero-emission bus repairs','charging repairs',
  'technical workforce training','transportation shop equipment'],
 awarded_to_bcsd_verified:false,
 awarded_to_elektron_verified:false,
 direct_vendor_order:false,
 verified_supplier_revenue_usd:0,
 source:SOURCES[1].url
});
export const BOUNDARIES=Object.freeze({
 emails_sent:0,forms_submitted:0,applications_filed:0,
 bids_submitted:0,vendor_accounts_created:0,phone_calls:0,site_visits:0,
 purchases:0,money_spent_usd:0,contracts_awarded:0,
 customer_purchase_orders:0,revenue_usd:0,rea_calls:0,model_calls:0
});
export const REQUIREMENTS=Object.freeze([
 'FIND_AN_ACTUAL_CURRENT_EV_SERVICE_PURCHASING_NOTICE_OR_AUTHORIZED_BUYER_SCOPE',
 'VERIFY_VALID_BUYER_BID_DOCUMENT_ID_AND_OPEN_DEADLINE',
 'VERIFY_APPLICABLE_ELEKTRON_LICENSE_AND_REPAIR_COMPETENCE',
 'VERIFY_PURCHASING_OFFICE_RULES_AND_VENDOR_REGISTRATION_IF_NEEDED',
 'VERIFY_BUYER_AWARD_OR_PROCUREMENT_BUDGET_SEPARATELY_FROM_CEC_ANNOUNCEMENT',
 'GET_OPERATOR_APPROVAL_BEFORE_OUTREACH_OR_REGISTRATION',
 'OBTAIN_BUYER_PURCHASE_ORDER_BEFORE_STARTING_WORK'
]);
const SERVICE=/\b(?:school[- ]?bus|fleet|vehicle|electric[- ]?bus|zero[- ]?emission|evse|charger|charging)\b/i;
const ACTIVITY=/\b(?:repair|maintenance|diagnostic|inspect|inspection|service|retrofit|upgrade|electric[- ]?bus|charging|charger)\b/i;
export function reviewActiveBidTitles(markup){
 if(typeof markup!=='string'||markup.length>800000)throw Error('FIAL514_HTML_INVALID');
 const cleaned=markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/[ \t\r\n]+/g,' ').trim();
 const a=cleaned.search(/\bActive Bids\b/i);
 const b=cleaned.search(/\bAwarded Bids\b/i);
 if(a<0||b<0||b<=a||b-a>40000)throw Error('FIAL514_ACTIVE_AWARDED_SECTION_UNVERIFIED');
 const zone=cleaned.slice(a+11,b);
 // Extract only human-review title hints. Nothing can become a verified open solicitation
 // without its independent dated official bid package and legal qualification.
 const m=[...zone.matchAll(/\b(?:BCSD\s+)?([^.!?]{4,160}?)\s+(?:Bid|RFPQ|RFP|RFQ)\s*#?\s*(\d{2}-\d{2}-\d{2})\b/gi)];
 const hints=m.slice(0,25).map(x=>({
  title:x[0].trim().slice(0,180),
  bid_id:x[2],
  service_relevant_hint:SERVICE.test(x[0])&&ACTIVITY.test(x[0]),
  official_bid_package_verified:false,
  open_deadline_verified:false,
  vendor_fit_verified:false,
  contact_authorized:false
 }));
 return {active_bid_area_seen:true,possible_relevant_titles:hints.filter(x=>x.service_relevant_hint),
  parsed_titles_count:hints.length,buyer_service_bid_verified:0,
  qualification_state:'OFFICIAL_INDEX_TITLE_ONLY_NOT_A_VERIFIED_OPEN_BUYER_SERVICE_RFP'}
}
export function demandDecision({bids=false,cec=false,faq=false,possible=0}={}){
 return {
  source_provenance_state:bids&&cec&&faq?'OFFICIAL_INDEX_AND_INCENTIVE_SOURCES_CURRENT':
   'OFFICIAL_SOURCE_EVIDENCE_INCOMPLETE',
  published_program_event_verified:!!(cec&&faq),
  potential_matching_bid_titles_for_manual_review:possible,
  confirmed_current_ev_maintenance_buyers:0,
  verified_live_ev_repair_rfps:0,
  bcsd_ev_bus_count_verified:null,
  bcsd_current_ev_service_requirement_verified:false,
  elektron_funding_applicant_eligible_verified:false,
  direct_approved_vendor_route_verified:false,
  contact_authorized:false,
  bids_ready:0,
  purchase_orders_verified:0,
  revenue_usd:0
 }
}
