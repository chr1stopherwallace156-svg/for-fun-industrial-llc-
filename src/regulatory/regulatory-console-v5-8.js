// Plain in-dashboard plots: only real BLS observations and published rule anchors.
// No canvas loop, image service, model, outside scripts or inferred economics.
(()=>{'use strict';
 const root=document.getElementById('fi-regulatory-intelligence');
 if(!root)return;
 const SVG='http://www.w3.org/2000/svg', $=id=>document.getElementById(id);
 const subtitle=$('fi-regulatory-updated'),counts=$('fi-regulatory-counts'),
  rules=$('fi-regulatory-deadlines'),sources=$('fi-regulatory-sources'),
  trends=$('fi-regulatory-trends'),timeline=$('fi-regulatory-timeline'),
  institutions=$('fi-regulatory-institutions');
 const p=(where,label,value)=>{
  const element=document.createElement('p'),strong=document.createElement('strong');
  strong.textContent=label+': ';element.append(strong,document.createTextNode(String(value??'unavailable')));
  where.append(element);
 };
 function node(name,attrs={},text){
  const element=document.createElementNS(SVG,name);
  for(const [k,v] of Object.entries(attrs))element.setAttribute(k,String(v));
  if(text!==undefined)element.textContent=String(text);
  return element;
 }
 function chart(observations,label,unit){
  const values=observations.filter(x=>x&&typeof x.value==='number'&&Number.isFinite(x.value)&&
   /^\d{4}-\d{2}$/.test(x.month||'')).slice(-20);
  const width=640,height=190,svg=node('svg',{viewBox:'0 0 640 190',
   role:'img','aria-label':label+' — published national monthly observations',
   style:'width:100%;max-width:720px;display:block;background:#102132;border-radius:8px'});
  if(values.length<2)return null;
  const min=Math.min(...values.map(x=>x.value)),max=Math.max(...values.map(x=>x.value)),
   span=Math.max(max-min,.01);
  const pts=values.map((v,i)=>[58+i*(width-85)/(values.length-1),
   145-(v.value-min)/span*104]);
  for(let i=0;i<=3;i++){
   const y=145-i*104/3;
   svg.append(node('line',{x1:50,y1:y,x2:615,y2:y,stroke:'#3c5568','stroke-width':1}));
   svg.append(node('text',{x:5,y:y+4,fill:'#bed4e2','font-size':11},
    (min+i*span/3).toFixed(unit==='percent'?1:2)));
  }
  svg.append(node('polyline',{points:pts.map(x=>x.join(',')).join(' '),
   stroke:'#76cfd1','stroke-width':2.5,fill:'none','stroke-linejoin':'round'}));
  for(const [x,y] of pts)svg.append(node('circle',{cx:x,cy:y,r:2,fill:'#b3f7e9'}));
  svg.append(node('text',{x:50,y:174,fill:'#bfd4e0','font-size':12},values[0].month));
  svg.append(node('text',{x:553,y:174,fill:'#bfd4e0','font-size':12},values.at(-1).month));
  return svg;
 }
 function renderTimeline(entries){
  timeline.replaceChildren();
  if(!entries.length){p(timeline,'Milestones','Unavailable');return}
  // The date points are published milestone reference years, not actual vehicle deadlines.
  const yrs=entries.map(e=>e.year),min=Math.min(...yrs)-.3,max=Math.max(...yrs)+.3;
  const height=Math.max(160,entries.length*40+50);
  const svg=node('svg',{viewBox:'0 0 800 '+height,role:'img',
   'aria-label':'Regulatory milestone timeline, not vehicle-specific deadlines',
   style:'display:block;width:100%;max-width:800px'});
  svg.append(node('line',{x1:100,y1:24,x2:760,y2:24,stroke:'#799eb7','stroke-width':2}));
  for(let i=0;i<entries.length;i++){
   const e=entries[i],x=100+(e.year-min)/(max-min)*660,y=55+i*40;
   svg.append(node('line',{x1:x,y1:24,x2:x,y2:y,stroke:'#456476',
    'stroke-dasharray':'3 4'}));
   svg.append(node('circle',{cx:x,cy:y,r:5,fill:'#91dbcd'}));
   const label=(e.year+' · '+String(e.name||'').slice(0,70));
   // Add text to DOM outside SVG to avoid illegible overlap on narrow screens.
   const row=document.createElement('p');
   row.textContent=label+' — '+String(e.type||'');
   timeline.append(row);
  }
  // Keep the graphical axis above the readable list of exact dates.
  timeline.prepend(svg);
 }
 function clear(where){where.replaceChildren()}
 (async()=>{
  try{
   const resp=await fetch('/api/operator/regulatory/status',{method:'GET',
    cache:'no-store',credentials:'same-origin'});
   if(!resp.ok)throw Error('HTTP '+resp.status);
   const data=await resp.json();
   if(data.version!=='fial5.8-regulatory-economic-v1')throw Error('WRONG_MONITOR_VERSION');
   subtitle.textContent=data.state==='NOT_ACTIVATED'?'Not yet activated':
    data.state!=='REAL_PUBLIC_DATA_CHECK_COMPLETED'?
    'DATA INTEGRITY HOLD: '+data.state+' — do not use stale compliance alerts or economic graphs':
    'Last local cycle: '+String(data.as_of_utc||'unknown')+
    ' · Current ACF 2026 amendment supersedes the old January 2027 100% purchasing requirement'+
    ' · Next source refresh follows 24–48 hour TTL';
   clear(counts);
   p(counts,'Sources configured',data.counts?.monitored||0);
   p(counts,'Sources fetched this cycle',data.counts?.refreshed||0);
   p(counts,'Published pages changed',data.counts?.source_changes||0);
   p(counts,'Unavailable source checks',data.counts?.source_holds||0);
   p(counts,'Personally verified due dates',0);
   for(const warning of (Array.isArray(data.data_quality_warnings)?data.data_quality_warnings:[]).slice(0,5))
    p(counts,'DATA QUALITY WARNING',warning);
   clear(rules);
   for(const m of (Array.isArray(data.rule_watch)?data.rule_watch:[]).slice(0,18)){
    const card=document.createElement('div');card.className='item';
    p(card,'Milestone',m.name);
    p(card,'Date',m.effective||'Unverified / vehicle-specific');
    p(card,'Category',m.date_type);
    p(card,'Applicability',m.applies_to);
    p(card,'Review priority',m.urgency);
    p(card,'Not a universal mandate',m.caveat);
    if(typeof m.source==='string'&&/^https:\/\/(?:ww2\.arb\.ca\.gov|www\.calstate\.edu)/.test(m.source)){
     const a=document.createElement('a');a.href=m.source;a.textContent='Official source';
     a.target='_blank';a.rel='noopener noreferrer';card.append(a);
    }
    rules.append(card);
   }
   clear(sources);
   for(const s of (Array.isArray(data.sources)?data.sources:[])){
    const card=document.createElement('p');
    card.textContent=String(s.id)+' · '+String(s.state)+
      ' · '+String(s.change_state)+
      (s.sha256?' · SHA256 '+s.sha256.slice(0,16):'')+
      ' · checked '+String(s.last_checked_utc||'never');
    sources.append(card);
   }
   clear(trends);
   const observed=Array.isArray(data.economic_series)?data.economic_series:[];
   for(const series of observed){
    const section=document.createElement('div');
    p(section,'BLS series',series.label+' ('+series.id+')');
    p(section,'Latest published observation',series.latest_month+' · '+series.latest_value+' '+series.unit);
    p(section,'Interpretation',series.context);
    if(typeof series.year_over_year_change_pct==='number')
     p(section,'Measured year-on-year change',series.year_over_year_change_pct+'%');
    const svg=chart(Array.isArray(series.observations)?series.observations:[],
     series.label,series.unit);
    if(svg)section.append(svg);
    trends.append(section);
   }
   if(!observed.length)p(trends,'Economic API','No verified published BLS observations; no economic trend inferred');
   renderTimeline(Array.isArray(data.timeline)?data.timeline:[]);
   clear(institutions);
   p(institutions,'Schools','AB 579, school bus assets, CTC vehicle inspection deadlines, campus utility and maintenance equipment');
   p(institutions,'Colleges / UC / CSU','Classify actual fleet owner and equipment first; watch university supplier procurement sites, not invented bid opportunities');
   p(institutions,'Official bids','Not authenticated or extracted. UC CalUsource and CSU CSUBUY require separate public bid verification');
  }catch(e){subtitle.textContent='Regulatory intelligence HOLD: '+String(e.message||e).slice(0,150)}
 })();
})();
