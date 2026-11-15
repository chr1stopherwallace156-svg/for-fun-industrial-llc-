// FIAL5.9 curated factual seed — published September 9, 2026 ZESBI
// funding-reservation LIST. These are NOT grants awarded, signed bus orders,
// approved vendors, open public RFPs, or proof of actual procurement intent.
// Every row reproduces a named LEA / municipality and BUS/CHARGER quantities
// in the linked five-page program-manager PDF, annotated by 1-based page.
export const VERSION='fial5.9-fleet-opportunity-source-catalog-v1';
export const FUNDING_PDF='https://californiazesbi.org/wp-content/uploads/2026/09/ZESBI-Funding-List-09.09.2026.pdf';
export const CEC_SOLICITATION='https://www.energy.ca.gov/solicitations/2026-11/zero-emission-school-bus-and-infrastructure-zesbi-incentive-project-second';
export const ZESBI_HOME='https://californiazesbi.org/';
export const CDE_DIRECTORY='https://www.cde.ca.gov/ds/si/ds/pubschls.asp';
export const UC_PROCUREMENT='https://procurement.ucop.edu/';
export const CSU_PROCUREMENT='https://www.calstate.edu/csu-system/doing-business-with-the-csu/contract-services-and-procurement/supplier-resources';
export const EXPECTED_PDF_DATE='2026-09-09';
export const ZESBI_PROGRAM=Object.freeze({
 id:'zesbi-second-solicitation-2026',
 name:'ZESBI Second Solicitation',
 status_source:CEC_SOLICITATION,
 published_date:'2026-11-03',
 application_earliest:'2026-11-17T10:00:00-08:00',
 funding_floor_usd:55000000,
 applicant_class:'California eligible Local Educational Agencies (LEAs)',
 business_role:'POTENTIAL_VENDOR_OR_SERVICE_PROVIDER_NOT_VERIFIED',
 eligible_cost_categories:['zero_emission_school_buses','charging_infrastructure','qualified_training',
  'qualified_technical_assistance','charger_or_zero_emission_bus_repairs',
  'transportation_shop_equipment','transportation_yard_improvements'],
 conditional_nonbus_cost_share_cap:0.10,
 cautions:['The program is a grant/incentive for LEAs, not a supplier purchase order',
  '10% category has program conditions; do not presume vendor or used-vehicle conversion eligibility',
  'A historical funding reservation list does not show a current request for bids',
  'An application acceptance date is a scheduled milestone; after that date the portal must be reverified'],
});
export const SOURCES=Object.freeze([
 {id:'cec-zesbi-second',url:CEC_SOLICITATION,host:'www.energy.ca.gov',type:'html',refresh_hours:6,max_bytes:210000,
  purpose:'Current CEC solicitation status, documented opening schedule and eligible cost language'},
 {id:'zesbi-program',url:ZESBI_HOME,host:'californiazesbi.org',type:'html',refresh_hours:12,max_bytes:210000,
  purpose:'Program operator, application reference and funding list link'},
 {id:'zesbi-reserved-funding-pdf',url:FUNDING_PDF,host:'californiazesbi.org',type:'pdf',refresh_hours:48,max_bytes:1900000,
  purpose:'September 9, 2026 historical reserved funding list; never a confirmed award'},
 {id:'cde-public-districts',url:CDE_DIRECTORY,host:'www.cde.ca.gov',type:'html',refresh_hours:72,max_bytes:220000,
  purpose:'CDE public district directory index; directory not proof of fleet ownership'},
 {id:'uc-supplier',url:UC_PROCUREMENT,host:'procurement.ucop.edu',type:'html',refresh_hours:72,max_bytes:220000,
  purpose:'UC supplier procurement portal; no bid extracted or inferred'},
 {id:'csu-supplier',url:CSU_PROCUREMENT,host:'www.calstate.edu',type:'html',refresh_hours:72,max_bytes:220000,
  purpose:'CSU supplier procurement portal; no bid extracted or inferred'}
].map(x=>Object.freeze(x)));
// Each integer count represents a specific line/row in the funding-list PDF.
// Where an agency filed multiple applications the separate records are kept.
// p is a 1-based source page, never a guessed application/vehicle id.
const ROWS=Object.freeze([
 ['Victor Valley Union High School District','Victorville',1,6,3,5],
 ['Palmdale Elementary School District','Palmdale',1,3,3,4],
 ['Bakersfield City School District','Bakersfield',1,32,20,1],
 ['Kern County Office of Education','Bakersfield',2,23,23,3],
 ['Kern County Office of Education','Bakersfield',2,17,5,3],
 ['Kern High School District','Bakersfield',2,20,20,3],
 ['Greenfield Union School District','Bakersfield',1,13,13,2],
 ['Vineland Elementary School District','Bakersfield',1,3,3,5],
 ['Southern Kern Unified School District','Rosamond',1,4,0,5],
 ['Sierra Sands Unified School District','Ridgecrest',1,6,0,5],
 ['Keppel Union Elementary School District','Pearblossom',1,1,0,3],
 ['Moreno Valley Unified School District','Moreno Valley',2,43,43,3],
 ['Ontario-Montclair School District','Ontario',1,6,6,3],
 ['Redlands Unified School District','Redlands',2,12,9,4],
 ['Colton Joint Unified School District','Colton',1,14,14,2],
 ['Banning Unified School District','Banning',1,6,6,1],
 ['Beaumont Unified School District','Beaumont',2,1,1,1],
 ['Beaumont Unified School District','Beaumont',2,2,2,1],
 ['San Marcos Unified School District','San Marcos',2,23,23,4],
 ['San Marcos Unified School District','San Marcos',2,1,1,4],
 ['Oceanside Unified School District','Oceanside',2,14,14,3],
 ['Poway Unified School District','San Diego',2,35,35,4],
 ['San Diego Unified School District','San Diego',2,50,50,4],
 ['Temecula Valley Unified School District','Temecula',2,5,5,5],
 ['Murrieta Valley Unified School District','Murrieta',2,11,11,3],
 ['Menifee Union School District','Menifee',2,14,14,3],
 ['Jurupa Unified School District','Jurupa Valley',1,39,39,3],
 ['Bonita Unified School District','San Dimas',2,6,6,1],
 ['Covina-Valley Unified School District','Covina',2,5,5,2],
 ['Montebello Unified School District','Montebello',1,32,32,3],
 ['Los Angeles Unified School District','Los Angeles',1,20,20,3],
 ['Los Angeles Unified School District','Los Angeles',1,109,109,3],
 ['Los Angeles Unified School District','Los Angeles',1,56,56,3],
 ['Whittier Union High School District','Whittier',2,23,23,5],
 ['Porterville Unified School District','Porterville',1,14,14,4],
 ['Fullerton Elementary School District','Fullerton',2,15,15,2],
 ['Manteca Unified School District','MANTECA',2,47,0,3],
 ['Panama-Buena Vista Union School District','Bakersfield',2,24,12,4],
 ['Rim of The World Unified School District','Crestline',1,3,3,4],
 ['San Dieguito Union High School District','Encinitas',2,5,5,4],
 ['San Dieguito Union High School District','Encinitas',2,8,8,4],
 ['West County Transportation JPA','Santa Rosa',1,7,7,5],
 ['Lodi Unified School District','Lodi',2,10,0,3],
 ['Oxnard School District','Oxnard',1,4,4,4]
]);
export const PUBLISHED_RESERVATIONS=Object.freeze(ROWS.map(([name,city,tier,buses,chargers,page],i)=>
 Object.freeze({id:'zesbi-sep2026-row-'+String(i+1).padStart(3,'0'),
  name,city,tier,buses,chargers,pdf_page:page,source_url:FUNDING_PDF,
  source_published_date:EXPECTED_PDF_DATE,
  source_claim:'RESERVED_FUNDING_APPLICATION_NOT_CONFIRMED_AWARD',
  current_bid_confirmed:false,customer_vendor_agreement_verified:false,
  project_purchase_order_verified:false})));
export const FOCUS_CITIES=Object.freeze([
 'Victorville','Palmdale','Bakersfield','Rosamond','Ridgecrest','Pearblossom',
 'Moreno Valley','Ontario','Redlands','Colton','San Dimas','Covina',
 'Temecula','Murrieta','Menifee','San Marcos','Oceanside'
]);
// Research focus is chosen for geographic work-planning only. NOT distance,
// customer interest, travel time, approved purchasing authority, or sales.
export const PROCUREMENT_WATCH=Object.freeze([
 {sector:'university_college',name:'University of California Procurement',source:UC_PROCUREMENT,
  confirmed_active_bid_count:0,buyer_qualification_verified:false},
 {sector:'university_college',name:'California State University supplier resources',source:CSU_PROCUREMENT,
  confirmed_active_bid_count:0,buyer_qualification_verified:false},
 {sector:'school_district',name:'California Department of Education directory',source:CDE_DIRECTORY,
  confirmed_active_bid_count:0,buyer_qualification_verified:false}
]);
export function normalizedAgency(x){return String(x||'').toLowerCase().replace(/\s+/g,' ').trim()}
export function groupReservedApplicants(rows=PUBLISHED_RESERVATIONS){
 if(!Array.isArray(rows)||rows.length>500)throw Error('FIAL59_RESERVATION_INPUT_INVALID');
 const groups=new Map(),seen=new Set();
 for(const r of rows){
  if(!r||typeof r.name!=='string'||typeof r.city!=='string'||
    !/^[1-3]$/.test(String(r.tier))||
    !Number.isSafeInteger(r.buses)||r.buses<0||r.buses>1000||
    !Number.isSafeInteger(r.chargers)||r.chargers<0||r.chargers>1000||
    r.source_url!==FUNDING_PDF||r.source_claim!=='RESERVED_FUNDING_APPLICATION_NOT_CONFIRMED_AWARD'||
    !Number.isInteger(r.pdf_page)||r.pdf_page<1||r.pdf_page>5||
    typeof r.id!=='string'||seen.has(r.id))throw Error('FIAL59_SOURCE_RESERVATION_FORGED_OR_DUPLICATED');
  seen.add(r.id);
  const key=normalizedAgency(r.name)+'|'+normalizedAgency(r.city);
  const current=groups.get(key)||{id:'lea-'+Buffer.from(key).toString('hex').slice(0,60),
   name:r.name,city:r.city,source_tier:r.tier,application_rows:0,
   listed_buses:0,listed_chargers:0,pdf_pages:[],row_ids:[]};
  if(current.source_tier!==r.tier)throw Error('FIAL59_DISAGREEING_LEA_TIER');
  current.application_rows++;current.listed_buses+=r.buses;current.listed_chargers+=r.chargers;
  if(!current.pdf_pages.includes(r.pdf_page))current.pdf_pages.push(r.pdf_page);
  current.row_ids.push(r.id);groups.set(key,current);
 }
 return Array.from(groups.values()).map(r=>({...r,pdf_pages:r.pdf_pages.sort((a,b)=>a-b)}));
}
export function ranking(agency){
 if(!agency||!Number.isSafeInteger(agency.listed_buses)||!Number.isSafeInteger(agency.listed_chargers))
  throw Error('FIAL59_RANK_INPUT_INVALID');
 const published_reservation=25;
 const vehicle_scale=agency.listed_buses>=30?25:agency.listed_buses>=10?16:agency.listed_buses>=3?8:3;
 const charging_scale=agency.listed_chargers>=20?20:agency.listed_chargers>=5?12:agency.listed_chargers>=1?5:0;
 const chosen_city_focus=FOCUS_CITIES.some(x=>normalizedAgency(x)===normalizedAgency(agency.city))?15:0;
 const total=published_reservation+vehicle_scale+charging_scale+chosen_city_focus;
 return {research_priority_points:total,components:{published_reservation,vehicle_scale,charging_scale,chosen_city_focus},
  score_type:'TRANSPARENT_RESEARCH_PRIORITY_NOT_CONTRACT_PROBABILITY_OR_EXPECTED_REVENUE',
  confirmed_bid:false,verified_contract_value_usd:0,
  verified_supplier_margin_usd:0,verified_buyer_vehicle_ownership:false,
  candidate_next_action:'VERIFY_LEA_PROCUREMENT_CONTACT_AND_ACTUAL_FLEET_NEED',
  source_pdf:FUNDING_PDF,
  conditional_service_categories:['technical_assistance','training',
   'electric_school_bus_repairs','charging_repairs','transportation_shop_equipment'],
  vendor_eligibility:'NOT_VERIFIED'};
}
export function fleetQueue({limit=40}={}){
 if(!Number.isInteger(limit)||limit<1||limit>150)throw Error('FIAL59_QUEUE_LIMIT_INVALID');
 return groupReservedApplicants().map(a=>({...a,...ranking(a),
  evidence_status:'OFFICIAL_PROGRAM_MANAGER_FUNDING_RESERVATION_LIST_2026_09_09',
  application_funding_status:'RESERVED_NOT_AWARD_PROVEN',
  is_2026_second_solicitation_applicant:false,
  current_bid_deadline:null,
  source_published_date:EXPECTED_PDF_DATE,
  sector:'education_school_bus'}))
  .sort((a,b)=>b.research_priority_points-a.research_priority_points||
   b.listed_buses-a.listed_buses||a.name.localeCompare(b.name)).slice(0,limit)
}
