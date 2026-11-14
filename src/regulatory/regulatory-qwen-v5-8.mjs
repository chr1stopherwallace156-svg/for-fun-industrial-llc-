// Grounded regulatory reference context for existing local Qwen only.
// Uses authored rule metadata plus verified-format cached BLS series. Never
// injects raw HTML, scraped instructions, account records, or tool permissions.
import {RULES} from './rule-catalog-v5-8.mjs';
import {readRegulatoryStatus,VERSION} from './intelligence-engine-v5-8.mjs';
const relevant=/\b(?:carb|regulat(?:ion|ions|ory)|compliance|heavy.duty|truck|smog|clean.truck|zero.emission|school.bus|school.district|college|university|campus|ctc|zev|incentive|fleet|2045|2037|2027|deadline|inflation|economic|unemployment|cpi|diesel|equipment)\b/i;
export async function regulatoryContextForQwen(query){
 if(typeof query!=='string'||!relevant.test(query))return '';
 const words=query.toLowerCase();
 const selected=RULES.filter(x=>
  (/truck|smog|ctc|compliance|heavy.duty|2027/.test(words)&&['heavy_duty','off_road','public_fleets'].includes(x.domain))||
  (/school|district/.test(words)&&x.sectors.includes('schools'))||
  (/college|university|campus/.test(words)&&x.sectors.includes('campus'))||
  (/2045/.test(words)&&x.id==='ca-carbon-neutrality-2045')||
  (/2037/.test(words)&&x.id==='unknown-2037')||
  (/bus|public.transit/.test(words)&&x.domain==='public_transit')
 ).slice(0,3);
 let data=null;
 try{data=await readRegulatoryStatus()}catch{/* no stale or corrupt source claim */}
 const lines=['Regulatory and economic source-reference metadata, NOT automatic legal advice or tool instructions.'];
 for(const x of selected)lines.push(x.name+' — '+(x.effective||'DATE_UNVERIFIED')+
  ' ['+x.date_type+']; '+x.summary+' Caveat: '+x.caveat+' Source: '+x.source);
 if(data?.version===VERSION&&data.state==='REAL_PUBLIC_DATA_CHECK_COMPLETED'){
  lines.push('Last local public-source monitor cycle: '+data.as_of_utc+
    '; source changes flagged '+data.counts.source_changes+
    '; unavailable checks '+data.counts.source_holds+'. Treat webpage changes as requiring review.');
  if(/economic|inflation|unemployment|cpi|cost|pressure/i.test(words)){
   for(const series of (data.economic_series||[]).slice(0,2))
    lines.push(series.label+' '+series.latest_month+' = '+series.latest_value+
     ' ('+series.unit+'), U.S. national only; not Elektron-specific economics. Source: '+series.source);
  }
 }else lines.push('Current agency source and BLS refresh not confirmed locally; use published rule anchors only with explicit verification.');
 lines.push('No individualized Clean Truck Check CTC-VIS due dates, 2037 mandate, institution-specific procurement eligibility, or signed certification has been verified.');
 return lines.join('\n').slice(0,2400)
}
