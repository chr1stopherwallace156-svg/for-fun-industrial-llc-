// Small verified-format local evidence context for Fun Industrial Qwen.
// Never reads raw PDF/HTML as instructions, fetches the web, or adds tool authority.
import {readFleetStatus,VERSION} from './fleet-engine-v5-9.mjs';
const relevant=/\b(?:fleet|bus|buses|school\s+district|university|college|procurement|zesbi|school\s+transport|ev\s+charger|charge\s+station|public\s+fleet|fleet\s+opportunit|transportation\s+contract|fleet\s+sales)\b/i;
export async function fleetContextForQwen(question){
 if(typeof question!=='string'||!relevant.test(question))return '';
 let report;
 try{report=await readFleetStatus()}catch{return 'Fleet opportunity evidence is unavailable or invalid. Do not invent district bids, grants, or vendor eligibility.'}
 if(report.version!==VERSION)return '';
 const lines=[
  'FIAL5.9 local published fleet research evidence. Never treat these numbers as active bids or contracts.',
  'Published September 9, 2026 program-manager ZESBI funding reservation PDF; reserved applicant rows do not prove a funding award, completed bus purchase, current open RFP, or a second-solicitation application.',
  'Official original source: https://californiazesbi.org/wp-content/uploads/2026/09/ZESBI-Funding-List-09.09.2026.pdf',
  'CEC second solicitation: https://www.energy.ca.gov/solicitations/2026-11/zero-emission-school-bus-and-infrastructure-zesbi-incentive-project-second; scheduled application acceptance begins November 17, 2026, 10 AM Pacific; requires independent current verification.'
 ];
 if(report.state!=='PUBLISHED_HISTORICAL_FLEET_PROSPECTS_AND_OFFICIAL_SOURCE_MONITOR')
  lines.push('Current local official-source monitoring has NOT completed. Named historical references may be used as published research leads only.');
 else lines.push('Last local official-source observation: '+String(report.last_cycle_utc||'unknown')+
  '; source holds: '+report.counts.held+'; open verified RFPs: ZERO; awarded contracts: ZERO; actual revenue: ZERO.');
 const words=question.toLowerCase();
 let relevant=(report.prospects||[]).filter(p=>{
  const terms=(p.name+' '+p.city).toLowerCase().split(/\s+/).filter(w=>w.length>5);
  return terms.some(t=>words.includes(t));
 });
 if(!relevant.length)relevant=(report.prospects||[]).slice(0,5);
 for(const p of relevant.slice(0,5))
  lines.push(p.name+' ('+p.city+'): '+p.listed_buses+' historically listed buses, '+
   p.listed_chargers+' historically listed chargers, PDF page(s) '+p.pdf_pages.join(', ')+
   '; research priority '+p.research_priority_points+'/85; current open bid not verified.');
 lines.push('New ZESBI second solicitation does not use old first-solicitation priority tiers. ELEKTRON business role, certified vendor eligibility, actual buyer fleet ownership, conversions, financing and procurement contact must be verified case by case. No outreach or bid is authorized.');
 return lines.join('\n').slice(0,2600)
}
