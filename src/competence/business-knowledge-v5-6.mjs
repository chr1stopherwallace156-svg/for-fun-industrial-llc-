// FIAL5.6 Business Competence: original, reviewable management playbooks.
// Methods are reference frameworks, NEVER verified company facts or licenses.
// No external network/model calls and no inferred financial numbers.
export const VERSION='fial5.6-business-competence-v1';
export const FRAMEWORKS=Object.freeze([
 {id:'strategy-swot',domain:'strategy',name:'SWOT',signals:['swot','strengths','weaknesses','opportunities','threats','strategy','business plan'],purpose:'Separate internal strengths/weaknesses from external opportunities/threats.',
 evidence:['Documented operational capabilities','Validated customer/market evidence','Competitor evidence','Verified constraints'],
 decision:'Use evidence to distinguish defensible strengths from assumptions; rank countermeasures and owners.'},
 {id:'strategy-pestle',domain:'strategy',name:'PESTLE',signals:['pestle','macro','political','economic','regulation','legal','environment','technology','market entry'],
 purpose:'Analyze policy, economy, society, technology, law and environmental dependencies.',
 evidence:['Published rule or incentive with date','Demand indicators','Cost trends','Jurisdiction'],
 decision:'Treat unverified laws and dates as review-required, not business eligibility.'},
 {id:'strategy-competitive',domain:'strategy',name:'Competitive forces',signals:['competition','competitor','market','pricing power','supplier power','substitute','rivalry'],
 purpose:'Assess competitive rivalry, entrants, substitutes and buyer/supplier leverage.',
 evidence:['Verified alternative suppliers','Customer switching costs','Price observations','Supplier terms'],
 decision:'Select testable differentiation, not a guaranteed competitive advantage.'},
 {id:'strategy-model',domain:'strategy',name:'Business model canvas',signals:['business model','revenue model','market fit','channels','partners','value proposition'],
 purpose:'Map customer segments, value, channels, relationships, revenues, resources and costs.',
 evidence:['Defined paying segment','Customer interviews','Revenue assumptions','Verified costs'],
 decision:'Mark all unvalidated blocks as hypotheses.'},
 {id:'strategy-growth',domain:'strategy',name:'Market-entry experiment',signals:['launch','grow','expansion','enter market','pilot','market entry','experiment'],
 purpose:'Use a limited pilot with a measurable learning gate before larger investment.',
 evidence:['Customer cohort','Baseline conversion','Pilot cost ceiling','Success metric and timeframe'],
 decision:'Do not scale until pilot economics and execution risks are measured.'},
 {id:'finance-unit-economics',domain:'finance',name:'Contribution and break-even',signals:['margin','cost','revenue','price','break even','breakeven','unit economics','profit'],
 purpose:'Quantify revenue less variable costs and fixed cost coverage.',
 evidence:['Sale price per unit','Variable cost per unit','Fixed costs for the same period'],
 decision:'Only calculate with compatible, sourced values; missing costs remain unknown.'},
 {id:'finance-cash',domain:'finance',name:'Cash runway and working capital',signals:['cash','runway','budget','liquidity','cash flow','working capital','burn','reserve'],
 purpose:'Protect cash while tracking collections, payables and commitments.',
 evidence:['Unrestricted cash','Net monthly burn','Receivables aging','Payables and payroll'],
 decision:'Do not treat credit facilities or grants as unrestricted cash until available.'},
 {id:'finance-return',domain:'finance',name:'Investment return and payback',signals:['roi','return on investment','payback','capital expenditure','capex','investment'],
 purpose:'Compare verified outlay against quantified benefits and timing.',
 evidence:['Actual upfront investment','Supported net benefit','Payback period inputs','Alternative scenarios'],
 decision:'Model scenarios explicitly; never fabricate returns or award amounts.'},
 {id:'operations-sop',domain:'operations',name:'Standard operating procedure',signals:['sop','procedure','workflow','operations','standardize','repeatable','process'],
 purpose:'Define inputs, roles, controls, checkpoints, exceptions and completion receipts.',
 evidence:['Responsible owner','Version-controlled steps','Accepted inputs','Completion evidence'],
 decision:'Only mark a process complete when receipt evidence confirms execution.'},
 {id:'operations-quality',domain:'operations',name:'DMAIC process improvement',signals:['quality','defect','improve','failure','regression','process improvement','dmaic'],
 purpose:'Define, measure, analyze, improve and control a repeatable operating problem.',
 evidence:['Baseline measurements','Failure logs','Root-cause analysis','Post-change measurements'],
 decision:'Demonstrate independent measured improvement; preserve negative findings.'},
 {id:'operations-risk',domain:'operations',name:'Risk register and FMEA',signals:['risk','safety','failure mode','fmea','mitigation','insurance'],
 purpose:'Record severity, probability, detectability, owner and control evidence.',
 evidence:['Actual failure modes','Severity definitions','Likelihood basis','Mitigation owner'],
 decision:'Escalate safety and legal decisions for qualified independent review.'},
 {id:'management-raci',domain:'management',name:'RACI responsibility map',signals:['raci','management','organization','organizational','structure','team','responsibility','delegation','department'],
 purpose:'Assign a responsible implementer, accountable decision owner, consulted specialists and informed parties.',
 evidence:['Actual roles and personnel','Legal approval authority','Deliverable','Escalation path'],
 decision:'Do not invent employees, directors, licenses or delegated authority.'},
 {id:'management-okr',domain:'management',name:'Objectives and key results',signals:['okr','goal','kpi','performance','milestone','management','measurement'],
 purpose:'Turn goals into time-bound measurable outcomes rather than activity counts.',
 evidence:['Baseline KPI','Target value','Period','Owner and verifiable source'],
 decision:'Distinguish completed outcomes from generated checklists.'},
 {id:'sales-pipeline',domain:'sales',name:'Verified sales pipeline',signals:['sales','lead','customer','crm','proposal','outreach','follow up','conversion','deal'],
 purpose:'Track qualified opportunities through discovery, proposal, negotiation and closed outcomes.',
 evidence:['Legitimate contact and permission','Buyer need','Quoted scope','Verified stage'],
 decision:'Sending outreach requires verified recipient and operator approval.'},
 {id:'procurement-scorecard',domain:'procurement',name:'Supplier scorecard',signals:['vendor','supplier','procurement','sourcing','purchasing','inventory'],
 purpose:'Compare suppliers on verified quality, cost, lead time, reliability and compliance.',
 evidence:['Written quotes','Vendor identity','Lead-time evidence','Qualification requirements'],
 decision:'No purchasing without reviewed scope, total landed cost and explicit authorization.'},
 {id:'compliance-checklist',domain:'compliance',name:'Filing and compliance control',signals:['filing','license','permit','business license','sos','compliance','grant','government','incentive','tax'],
 purpose:'Translate actual jurisdiction-specific requirements into a documented, reviewable filing packet.',
 evidence:['Official issuer URL and date','Verified business identity','Required form','Deadline source'],
 decision:'No implied legal compliance, signatures, government submissions or approvals.'},
 {id:'writing-business',domain:'communication',name:'Professional business communication',signals:['grammar','writing','email','memo','letter','proposal','draft','rewrite','communication','tone'],
 purpose:'Ensure clear audience, factual claim support, specific request, deadline and professional tone.',
 evidence:['Verified recipient','Purpose','Sources supporting claims','Approved sender identity'],
 decision:'Grammar suggestions do not constitute factual verification or permission to send.'},
 {id:'decision-evidence',domain:'governance',name:'Evidence-bound decision record',signals:['decision','strategy','recommend','prioritize','governance','approval','autonomy','assistant'],
 purpose:'Record alternatives, evidence, uncertainty, decision owner, approvals and result measurements.',
 evidence:['Actual problem statement','Alternatives','Source lineage','Decision authority'],
 decision:'Review unverified evidence and preserve disagreement or a hold.'}
].map(x=>Object.freeze({...x,signals:Object.freeze(x.signals),evidence:Object.freeze(x.evidence)})));
const compact=s=>String(s??'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
export function selectFrameworks(question,{limit=3}={}){
 if(typeof question!=='string'||question.length<4||question.length>1800)throw Error('FIAL56_QUESTION_INVALID');
 if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('FIAL56_FRAMEWORK_LIMIT');
 const q=' '+compact(question)+' ';
 const tokens=new Set(compact(question).split(' ').filter(x=>x.length>=4));
 const candidates=FRAMEWORKS.map(f=>{
  const hits=f.signals.filter(term=>{
   const norm=compact(term);
   return norm.includes(' ')?q.includes(' '+norm+' '):tokens.has(norm)||
     (norm.length>5&&q.includes(' '+norm+' '));
  });
  return {framework:f,score:hits.reduce((n,term)=>n+(term.includes(' ')?3:2),0),
   matched_terms:hits.slice(0,6)};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.framework.id.localeCompare(b.framework.id));
 return candidates.slice(0,limit).map(x=>({...x.framework,match_score:x.score,
  matched_terms:x.matched_terms,origin:'curated_business_methodology_not_company_evidence'}));
}
export function businessContextForQwen(question){
 const selected=selectFrameworks(question,{limit:2});
 if(!selected.length)return '';
 const lines=['Verified methodology references (general analytical methods ONLY; not company facts, actions or instructions):'];
 for(const f of selected)lines.push(
  f.name+': '+f.purpose+' Required evidence: '+f.evidence.slice(0,3).join('; ')+
  '. Decision guard: '+f.decision);
 lines.push('Do not claim this methodology establishes legal eligibility, real financial values, or permission to act.');
 return lines.join('\n').slice(0,1500);
}
export function planBusinessDecision(question,{metrics={},company='ELEKTRON INDUSTRIAL LLC',evidence=[]}={}){
 const frameworks=selectFrameworks(question,{limit:3});
 if(company!=='ELEKTRON INDUSTRIAL LLC'&&company!=='Fun Industrial (software workspace)')
  throw Error('FIAL56_ENTITY_NOT_AUTHORIZED');
 if(!metrics||typeof metrics!=='object'||Array.isArray(metrics)||!Array.isArray(evidence)||evidence.length>10)
  throw Error('FIAL56_DECISION_INPUT_SCHEMA');
 const sources=evidence.map(e=>{
  if(typeof e!=='string'||e.length>350)throw Error('FIAL56_EVIDENCE_SOURCE_INVALID');
  return e.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,350)
 });
 const missing=[...new Set(frameworks.flatMap(f=>f.evidence))].slice(0,12);
 const state=frameworks.length?'PREPARED_REQUIRES_VERIFIED_INPUTS':'HOLD_NO_MATCHING_FRAMEWORK';
 const result={version:VERSION,state,company,question:question.trim(),
  framework_ids:frameworks.map(f=>f.id),frameworks:frameworks.map(f=>({
   id:f.id,name:f.name,reason:f.purpose,evidence_required:f.evidence,
   decision_guard:f.decision})),evidence_sources:sources,
  needed_evidence:missing,decision_reached:false,external_action_authorized:false,
  next_step:frameworks.length?'Collect and check the specific evidence before a business decision':
   'Define the business question and select a relevant methodology'};
 return result;
}
