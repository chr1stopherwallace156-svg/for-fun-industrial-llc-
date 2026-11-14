// Deterministic, explicit-input business financial calculations.
// Missing/unverified values do NOT turn into a guess or a zero.
const num=x=>typeof x==='number'&&Number.isFinite(x);
const required=(fields,data)=>{
 const missing=fields.filter(k=>!num(data?.[k]));
 return missing.length?{state:'HOLD_MISSING_VERIFIED_INPUTS',missing,values:null}:null;
};
const round=v=>Math.round((v+Number.EPSILON)*10000)/10000;
export function calculateFinancials(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('FIAL56_FINANCE_INVALID');
 const results={source:'operator_supplied_numbers_not_independently_verified',actual_business_claim:false};
 const nonnegative=['unit_price','unit_variable_cost','monthly_fixed_cost','cash_available',
  'monthly_net_burn','initial_investment','period_net_benefit','revenue','cost_of_goods_sold'];
 for(const k of nonnegative)if(k in input&&(!num(input[k])||input[k]<0))
  throw Error('FIAL56_FINANCE_VALUE_INVALID_'+k);
 const unitHold=required(['unit_price','unit_variable_cost','monthly_fixed_cost'],input);
 if(unitHold)results.unit_economics=unitHold;
 else{
  const contribution=round(input.unit_price-input.unit_variable_cost);
  const result={state:contribution<=0?'HOLD_NO_POSITIVE_CONTRIBUTION':'CALCULATED_FROM_GIVEN_INPUTS',
   contribution_per_unit:contribution,contribution_margin_pct:input.unit_price>0?
    round(100*contribution/input.unit_price):null,
   monthly_break_even_units:contribution>0?
    Math.ceil(input.monthly_fixed_cost/contribution):null};
  results.unit_economics=result;
 }
 const cashHold=required(['cash_available','monthly_net_burn'],input);
 results.cash_runway=cashHold||{state:input.monthly_net_burn===0?
  'HOLD_ZERO_BURN_NOT_AN_INFINITE_GUARANTEE':'CALCULATED_FROM_GIVEN_INPUTS',
  months:input.monthly_net_burn>0?round(input.cash_available/input.monthly_net_burn):null};
 const grossHold=required(['revenue','cost_of_goods_sold'],input);
 results.gross_margin=grossHold||{state:input.revenue===0?'HOLD_ZERO_REVENUE':'CALCULATED_FROM_GIVEN_INPUTS',
   gross_profit:round(input.revenue-input.cost_of_goods_sold),
   margin_pct:input.revenue>0?round(100*(input.revenue-input.cost_of_goods_sold)/input.revenue):null};
 const roiHold=required(['initial_investment','period_net_benefit'],input);
 results.investment_return=roiHold||{state:input.initial_investment===0?
  'HOLD_ZERO_INITIAL_INVESTMENT':'CALCULATED_FROM_GIVEN_INPUTS',
  simple_period_roi_pct:input.initial_investment>0?
   round(100*input.period_net_benefit/input.initial_investment):null};
 return results;
}
export function rankEvidenceBackedOptions(options){
 if(!Array.isArray(options)||options.length<1||options.length>20)
  throw Error('FIAL56_OPTIONS_INVALID');
 const seen=new Set();
 return options.map((o,i)=>{
  if(!o||typeof o.id!=='string'||!/^[-_a-zA-Z0-9]{2,60}$/.test(o.id)||seen.has(o.id))
   throw Error('FIAL56_OPTION_ID_INVALID');
  seen.add(o.id);
  const values=['evidence_quality','cost_feasibility','operational_feasibility','risk_control'];
  const missing=values.filter(k=>!num(o[k])||o[k]<0||o[k]>5);
  return {id:o.id,input_index:i,score:missing.length?null:
   round(.35*o.evidence_quality+.25*o.cost_feasibility+.2*o.operational_feasibility+.2*o.risk_control),
   state:missing.length?'HOLD_MISSING_SCORING_INPUTS':'HEURISTIC_NOT_A_PROVEN_DECISION',
   missing};
 }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id));
}
