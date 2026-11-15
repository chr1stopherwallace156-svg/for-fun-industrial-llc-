// FIAL5.13 official California school fleet buyer discovery.
// Grounded in BCSD's currently published fleet, bids and vendor relations pages.
// A public fleet + purchasing path is NOT proof of an open order or client need.
export const CATALOG_VERSION='fial5.13-school-fleet-buyer-catalog-v1';
export const SOURCES=Object.freeze([
 {id:'bcsd-transportation',url:'https://www.bcsd.com/business-services/transportation',
  host:'www.bcsd.com',ttl_hours:24,max_bytes:500000,
  facts:['161 school buses','fleet maintenance staff']},
 {id:'bcsd-purchasing-bids',url:'https://www.bcsd.com/business-services/purchasing/bids',
  host:'www.bcsd.com',ttl_hours:12,max_bytes:500000,
  facts:['PlanetBids','Future Opportunities']},
 {id:'bcsd-vendor-relations',url:'https://www.bcsd.com/departments/purchasing/vendor-relations',
  host:'www.bcsd.com',ttl_hours:24,max_bytes:500000,
  facts:['purchase order','Purchasing Office','prior authorization']},
 {id:'zesbi-eligible-transport-costs',url:'https://californiazesbi.org/applicants/eligible-costs/',
  host:'californiazesbi.org',ttl_hours:72,max_bytes:500000,
  facts:['ZE School Bus Repairs','ZE School Bus Maintenance Contracts']}
].map(x=>Object.freeze({...x,facts:Object.freeze(x.facts)})));
export const BUYER=Object.freeze({
 id:'bakersfield-city-school-district',
 name:'Bakersfield City School District',
 area:'Bakersfield, Kern County, California',
 organization_type:'CALIFORNIA_LOCAL_EDUCATIONAL_AGENCY',
 fleet_type:'SCHOOL_BUS',
 published_total_school_buses:161,
 published_fleet_origin:'BCSD TRANSPORTATION PAGE',
 published_operating_fleet_source:SOURCES[0].url,
 publicly_stated_maintenance:'DISTRICT_HAS_FLEET_MAINTENANCE_STAFF',
 purchasing_bid_source:SOURCES[1].url,
 vendor_policy_source:SOURCES[2].url,
 relevant_program_source:SOURCES[3].url,
 vendor_registration_route:'BCSD PlanetBids — see district bids page',
 buyer_authority:'STORES_AND_PURCHASING_ONLY',
 site_visits:'PRIOR_AUTHORIZATION_REQUIRED',
 purchase_authority:'ISSUED_DISTRICT_PURCHASE_ORDER_REQUIRED',
 department_to_review:'Stores and Purchasing / Transportation',
 target_services:['ZE school-bus out-of-warranty diagnostics and repairs',
  'Fleet high-voltage safety equipment and tools','EVSE diagnostic equipment',
  'Technician training, where qualified and eligible'],
 ev_bus_count_verified:null,
 zesbi_grant_award_to_buyer_verified:false,
 open_ev_service_solicitation_verified:false,
 actual_current_need_verified:false,
 funded_procurement_budget_verified:false,
 elektron_vendor_approved:false,
 elektron_service_credentials_verified:false,
 authorized_customer_contact:false,
 invoice_or_purchase_order_verified:false,
 customer_revenue_usd:0
});
export const GATES=Object.freeze([
 'VERIFY_ACTUAL_ELECTRIC_FLEET_AND_TECHNICAL_NEED',
 'VERIFY_OPEN_PURCHASING_REQUEST_OR_BUYER_AUTHORIZED_SCOPE',
 'VERIFY_ELEKTRON_BAR_LICENSE_AS_APPLICABLE_SERVICE',
 'VERIFY_TECHNICIAN_HIGH_VOLTAGE_COMPETENCE_OEM_AND_WARRANTY',
 'VERIFY_INSURANCE_AND_DISTRICT_VENDOR_REQUIREMENTS',
 'VERIFY_BUDGET_AND_ANY_ZESBI_AWARD_STP_ELIGIBLE_COST',
 'GET_BUYER_AUTHORIZATION_BEFORE_SITE_VISIT',
 'GET_OFFICIAL_PURCHASE_ORDER_BEFORE_WORK',
 'GET_OPERATOR_APPROVAL_BEFORE_ANY_EXTERNAL_CONTACT'
]);
export const BOUNDARIES=Object.freeze({
 emails_sent:0,phone_calls_placed:0,vendor_accounts_created:0,
 bids_submitted:0,forms_submitted:0,site_visits:0,
 paid_work_started:0,purchase_orders_verified:0,
 contracts_awarded:0,revenue_usd:0,model_calls:0,rea_calls:0
});
export function decision({fleet=false,bids=false,vendor=false,zesbi=false}={}){
 const buyerVerified=!!(fleet&&bids&&vendor);
 return {
  buyer_evidence_state:buyerVerified?'PUBLIC_FLEET_OPERATOR_AND_PURCHASING_ROUTE_VERIFIED':
   'PUBLIC_BUYER_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED',
  current_need_status:'NOT_VERIFIED',
  opportunity_kind:'POTENTIAL_SERVICE_BUYER_NOT_AN_OPEN_RFP',
  direct_bid_ready:false,contact_approved:false,
  awarded_ze_bus_program_verified:false,
  zesbi_eligible_cost_category_publicly_documented:!!zesbi,
  vendor_route_publicly_documented:!!(bids&&vendor),
  qualified_service_provider_verified:false,
  verified_invoice_count:0
 }
}
