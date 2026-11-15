// FIAL5.10: fixed official issuer notice. Data reviewed from JUSD's
// 2026-11-03 / 2026-11-10 published notice, not a marketplace scrape.
export const CATALOG_VERSION='fial5.10-procurement-sources-v1';
export const ISSUER_PAGE='https://jurupausd.org/our-district/BizServ/css/Pages/Bids.aspx';
export const NOTICE_PDF='https://jurupausd.org/our-district/BizServ/css/Bid%20Documents/26-27-02TR%20-Notice%20Inviting%20Bids.pdf';
export const SUBMISSION_PORTAL='https://pbsystem.planetbids.com/portal/60604/portal-home';
export const NOTICE=Object.freeze({
 id:'jusd-26-27-02tr',
 issuer:'Jurupa Unified School District',
 state:'CA',city:'Jurupa Valley',
 solicitation_id:'26-27-02TR',
 title:'Student Transportation Services RFP',
 scope:'Qualified student transportation services: special education buses, small vehicles, field trips and coaches',
 source_notice_url:NOTICE_PDF,source_listing_url:ISSUER_PAGE,
 submission_url:SUBMISSION_PORTAL,
 due_utc:'2026-12-11T22:00:00.000Z',
 due_local:'December 11, 2026 at 2:00 PM Pacific',
 question_due_utc:'2026-11-18T20:00:00.000Z',
 nonmandatory_prebid_utc:'2026-11-16T18:00:00.000Z',
 term_starts:'2027-07-01',term_years:5,
 original_notice_advertised:['2026-11-03','2026-11-10'],
 verified_by_operator_research:'REVIEWED_OFFICIAL_ONE_PAGE_DISTRICT_NOTICE_2026_11_14',
 vendor_requirements:'Qualified student transportation firm; other RFP requirements need portal review',
 elektron_fit:'NOT_ESTABLISHED_FULL_SERVICE_TRANSPORT_PROVIDER_UNVERIFIED',
 conversion_or_ev_requirement:'NOT_STATED',
 verified_contract_value_usd:0,
 actual_award:false,
 auto_submit:false
});
export const SOURCES=Object.freeze([
 Object.freeze({id:'jusd-official-bids-page',url:ISSUER_PAGE,kind:'html',
  host:'jurupausd.org',limit_bytes:220000,ttl_hours:6}),
 Object.freeze({id:'jusd-26-27-02tr-official-pdf',url:NOTICE_PDF,kind:'pdf',
  host:'jurupausd.org',limit_bytes:1500000,ttl_hours:12})
]);
export function validateOfficialListing(text){
 if(typeof text!=='string'||text.length>220000)return false;
 // Require both district-published listing identifiers and exact opportunity scope,
 // and the notice download link within the same page.
 return /26-27-02TR/i.test(text)&&/Student\s+Transportation\s+Services\s+RFP/i.test(text)&&
  /26-27-02TR[\s\S]{0,400}Notice\s+Inviting\s+Bids/i.test(text);
}
export function deadlineState(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(+now))throw Error('FIAL510_CLOCK_INVALID');
 const end=Date.parse(NOTICE.due_utc);
 return now.getTime()<end?'BEFORE_PUBLISHED_DEADLINE':'PAST_PUBLISHED_DEADLINE';
}
export const SAFETY=Object.freeze({
 actual_rfps_submitted:0,emails_sent:0,rea_calls:0,
 model_calls:0,orders:0,awarded_contracts:0,revenue_usd:0,
 vendor_fitness_qualified:false,individual_vehicle_due_dates_verified:0
});
