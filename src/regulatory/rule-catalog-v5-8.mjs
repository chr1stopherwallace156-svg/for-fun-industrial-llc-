// Fun Industrial FIAL5.8: curated regulatory anchors, NOT an automatic legal
// interpretation engine. All source dates require official revalidation.
export const CATALOG_VERSION='fial5.8.1-regulatory-catalog-2026-amendment-v1';
export const RULES=Object.freeze([
 {id:'ctc-obd-quarterly',domain:'heavy_duty',name:'Clean Truck Check OBD testing frequency',
  effective:'2027-10',date_type:'program_frequency_change_month',applies_to:'Covered on-road OBD-equipped vehicles subject to California Clean Truck Check (exceptions exist)',
  summary:'OBD-equipped covered vehicles move from two to four emissions compliance tests per year beginning October 2027. Only the month, not an October 1 legal effective day, is documented here.',
  caveat:'Not one fixed fleet-wide due date: check each vehicle CTC-VIS account for specific compliance deadlines; agricultural vehicles and certain motorhomes differ.',
  source:'https://ww2.arb.ca.gov/vehicle-owners-emissions-compliance-testing-requirements-clean-truck-check',
  legal_status:'published_regulatory_guidance',sectors:['trucking','schools','campus','public_fleets','vendors'],priority:95},
 {id:'acf-annual-public-reporting',domain:'public_fleets',name:'Annual state/local government ACF reporting',
  effective:'2027-04-01',date_type:'recurring_reporting_anchor',
  applies_to:'California state and local government fleets subject to the current ACF reporting provisions',
  summary:'CARB states reporting is due annually by April 1 for covered state and local fleets.',
  caveat:'The exact entity reporting obligation and any applicable extension or amendment must be verified; do not claim an individual university or school district has filed.',
  source:'https://ww2.arb.ca.gov/advanced-clean-fleets-truckstop',
  legal_status:'published_regulatory_guidance',sectors:['public_fleets','schools','campus'],priority:88},
 {id:'acf-state-local-purchasing',domain:'public_fleets',name:'State/local fleet acquisition milestone — amended 2026',
  effective:'2030-01-01',date_type:'amended_vehicle_purchase_standard',
  applies_to:'Covered California state/local agency fleet purchases under the current ACF ZEV Purchase Schedule, not all fleet vehicles or every school bus',
  summary:'CARB 2026 final amendment extends the 50% ZEV/NZEV purchase requirement through 2029 and delays the 100% purchase requirement to 2030.',
  caveat:'The previous 2027 100% purchasing deadline is SUPERSEDED. The optional ZEV Milestones Option, small-fleet/designated-county delays, exemptions and actual buyer applicability require independent case review.',
  source:'https://ww2.arb.ca.gov/rulemaking/2025/acfab1594',
  amendment_approved:'2026-09-10',supersedes:'2027-01-01',
  legal_status:'oal_approved_final_regulation',sectors:['public_fleets','schools','campus'],priority:96},
 {id:'school-bus-ab579',domain:'schools',name:'New school bus acquisition standard',
  effective:'2035-01-01',date_type:'vehicle_purchase_standard',
  applies_to:'California school districts, county offices of education and charter schools for covered newly purchased or contracted school buses',
  summary:'AB 579 requires new/contracted school buses to be zero-emission from 2035 where feasible.',
  caveat:'Feasibility exceptions and the exact acquisition must be reviewed; does not require every existing bus replaced on 2035-01-01.',
  source:'https://ww2.arb.ca.gov/our-work/programs/school-buses/regulations-affecting-school-fleets',
  legal_status:'statutory_requirement_with_exceptions',sectors:['schools'],priority:85},
 {id:'transit-bus-new-purchase',domain:'public_transit',name:'Public transit new-bus acquisitions',
  effective:'2029-01-01',date_type:'purchase_share_target',
  applies_to:'Transit agencies subject to the California Innovative Clean Transit regulation',
  summary:'By 2029, 100% of new transit agency bus purchases must be zero-emission under ICT.',
  caveat:'A school district, university or private shuttle is not automatically a public transit agency.',
  source:'https://ww2.arb.ca.gov/innovative-clean-transit-regulation-summary',
  legal_status:'published_regulatory_guidance',sectors:['public_transit','airport_shuttle'],priority:82},
 {id:'transit-fleet-2040',domain:'public_transit',name:'ICT zero-emission fleet goal',
  effective:'2040-01-01',date_type:'program_goal',
  applies_to:'Public transit bus fleets regulated under ICT',
  summary:'ICT targets 100% zero-emission transit buses by 2040.',
  caveat:'Program goal must not be confused with a date-specific legal replacement duty for a university or school fleet.',
  source:'https://ww2.arb.ca.gov/innovative-clean-transit-regulation-summary',
  legal_status:'program_goal',sectors:['public_transit'],priority:55},
 {id:'ca-carbon-neutrality-2045',domain:'state_policy',name:'California 2045 carbon neutrality policy',
  effective:'2045-01-01',date_type:'statewide_policy_goal',
  applies_to:'California statewide climate policy',
  summary:'California law sets a statewide carbon-neutrality policy target no later than 2045.',
  caveat:'Not a universal individual vehicle retirement, business-license, procurement or conversion deadline.',
  source:'https://ww2.arb.ca.gov/ghg-limits',
  legal_status:'statewide_policy_goal',sectors:['schools','campus','public_fleets','trucking','public_transit'],priority:45},
 {id:'airport-shuttle-2028',domain:'airport_shuttle',name:'Airport shuttle phase-in',
  effective:'2028-01-01',date_type:'fleet_share_milestone',
  applies_to:'Covered California airport shuttle fleets under the Zero-Emission Airport Shuttle Regulation',
  summary:'33% zero-emission covered shuttle fleet by the end of 2027, expressed in CARB schedule as 2028; 100% by the end of 2035, expressed as 2036.',
  caveat:'Verify which shuttles are covered and exemptions; this is not a university-wide or all-campuses mandate.',
  source:'https://ww2.arb.ca.gov/zero-emission-airport-shuttle-regulation-summary',
  legal_status:'published_regulatory_guidance',sectors:['airport_shuttle'],priority:70},
 {id:'offroad-fleet-phaseout',domain:'off_road',name:'Off-road diesel engine tier phase-out',
  effective:null,date_type:'fleet_specific_schedule',
  applies_to:'Covered California off-road diesel and alternative diesel fleets, dependent on equipment size and category',
  summary:'CARB phases out older engine tiers over multiple years through 2036; individual fleet schedules vary.',
  caveat:'Do not invent a universal 2037 rule or infer engine-level due dates from a general brochure. Verify DOORS and actual equipment class.',
  source:'https://ww2.arb.ca.gov/new-california-requirements-road-and-road-heavy-duty-vehicles',
  legal_status:'fleet_specific_verification_required',sectors:['off_road','schools','campus','public_fleets','vendors'],priority:80},
 {id:'unknown-2037',domain:'watchlist',name:'2037 date mentioned for investigation',
  effective:null,date_type:'UNVERIFIED_REQUESTED_YEAR',
  applies_to:'Unknown until the user or an official source identifies a specific regulation',
  summary:'2037 is a research watchpoint; it is not presently registered as a legal deadline.',
  caveat:'No notifications should claim a 2037 compliance obligation without exact source regulation and applicability.',
  source:'https://ww2.arb.ca.gov/zero-emission-regulation-deadline-schedules-truckstop',
  legal_status:'unverified_watch_only',sectors:['trucking','schools','campus'],priority:20}
].map(x=>Object.freeze({...x,sectors:Object.freeze(x.sectors)})));
export const SOURCES=Object.freeze([
 {id:'carb-ctc',kind:'regulatory_html',url:'https://ww2.arb.ca.gov/clean-truck-check-emissions-compliance-testing-requirements',refresh_hours:24,sectors:['trucking','schools','campus'],host:'ww2.arb.ca.gov'},
 {id:'carb-acf',kind:'regulatory_html',url:'https://ww2.arb.ca.gov/rulemaking/2025/acfab1594',refresh_hours:24,sectors:['public_fleets','campus','schools'],host:'ww2.arb.ca.gov'},
 {id:'carb-school',kind:'regulatory_html',url:'https://ww2.arb.ca.gov/our-work/programs/school-buses/regulations-affecting-school-fleets',refresh_hours:24,sectors:['schools'],host:'ww2.arb.ca.gov'},
 {id:'carb-offroad',kind:'regulatory_html',url:'https://ww2.arb.ca.gov/our-work/programs/truckstop-resources/road-zone',refresh_hours:48,sectors:['off_road','campus','schools'],host:'ww2.arb.ca.gov'},
 {id:'uc-procurement',kind:'procurement_portal_page',url:'https://procurement.ucop.edu/',refresh_hours:48,sectors:['campus'],host:'procurement.ucop.edu'},
 {id:'csu-procurement',kind:'procurement_portal_page',url:'https://www.calstate.edu/csu-system/doing-business-with-the-csu/contract-services-and-procurement/supplier-resources',refresh_hours:48,sectors:['campus'],host:'www.calstate.edu'},
 {id:'bls-inflation',kind:'economic_api',url:'https://api.bls.gov/publicAPI/v1/timeseries/data/',refresh_hours:48,sectors:['economy'],host:'api.bls.gov'},
 {id:'federal-register',kind:'federal_api',url:'https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=newest&conditions%5Bterm%5D=truck%20emissions',refresh_hours:24,sectors:['regulatory'],host:'www.federalregister.gov'}
].map(x=>Object.freeze({...x,sectors:Object.freeze(x.sectors)})));
export const BLS_SERIES=Object.freeze([
 {id:'CUUR0000SA0',label:'U.S. CPI-U (all items)',unit:'index',claim:'National consumer price level, not a truck-fleet cost quote'},
 {id:'LNS14000000',label:'U.S. unemployment rate',unit:'percent',claim:'National labor market context, not verified local hiring costs'}
]);
function isoDate(x){return typeof x==='string'&&/^\d{4}-\d{2}(?:-\d{2})?$/.test(x)&&
 Number.isFinite(Date.parse((x.length===7?x+'-01':x)+'T00:00:00Z'))}
export function dueWatch({now=new Date(),limit=16}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now))throw Error('FIAL58_INVALID_CLOCK');
 const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 return RULES.map(rule=>{
  const valid=isoDate(rule.effective);
  const days=valid?Math.round((Date.parse((rule.effective.length===7?rule.effective+'-01':rule.effective)+'T00:00:00Z')-today)/86400000):null;
  return {...rule,days_until_milestone:days,milestone_precision:rule.effective?.length===7?'month':'day',
   urgency:!valid?'REQUIRES_SPECIFIC_SOURCE':days<0?'HISTORICAL_MILESTONE_REVERIFY_RULE':days<=90?'UPCOMING_MILESTONE_REVIEW':days<=365?'YEAR_AHEAD_PLANNING':'LONG_RANGE_PLANNING',
   person_or_vehicle_due_date_verified:false,
   certified_applicability:false,
   alert_is_not_legal_notice:true};
 }).sort((a,b)=>(a.days_until_milestone??1e8)-(b.days_until_milestone??1e8)).slice(0,limit);
}
export function graphMilestones(){
 return RULES.filter(x=>x.effective!==null).map(x=>({
  year:Number(x.effective.slice(0,4)),date:x.effective,id:x.id,name:x.name,
  type:x.date_type,applies_to:x.applies_to,
  is_legal_individual_deadline:false,source:x.source
 })).sort((a,b)=>a.date.localeCompare(b.date));
}
export function classifyInstitutions(type){
 if(!['school_district','county_office','charter_school','uc_campus','csu_campus','community_college','public_transit','private_fleet'].includes(type))
  throw Error('FIAL58_INSTITUTION_TYPE_INVALID');
 return {type,can_identify_sourcing_needs:true,
  compliance_decision:'CASE_BY_CASE_HUMAN_VERIFICATION',
  coverage:type==='school_district'||type==='county_office'||type==='charter_school'?
   ['potential_ab579_school_bus','potential_clean_truck_check','potential_offroad']:
   type==='public_transit'?['potential_ict']:
   ['potential_clean_truck_check','potential_offroad','potential_public_acf_if_covered'],
  bids_are_verified:false,grant_eligibility_verified:false,
  evidence_required:['actual buyer or fleet owner','vehicle or equipment class','official agency applicability','current rule edition','procurement or portal listing']};
}
