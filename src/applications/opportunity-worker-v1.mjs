// FUN_REAL_APPLICATION_WORKER_V1 — real California Grants Offered -> local editable drafts.
// Never transmits applications, signs anything, spends money, or executes REA/model tools.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
export const SOURCE_PAGE='https://publish.data.ca.gov/dataset/california-grants-portal';
export const SOURCE_CSV='https://publish.data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv';
export const VERSION='fun-real-application-worker-v1';
const MAX_BYTES=15*1024*1024,MAX_ROWS=14000;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=(value,max=1200)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const norm=value=>text(value,4000).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const DEFAULT_PROFILE=Object.freeze({
 schema:'fun-business-grants-profile-v1',business_name:'FUN INDUSTRIAL LLC',
 business_type:'California limited liability company',
 business_description:'Local-first software, applied AI, optimization, and business intelligence research and development.',
 registered_address:null,contact_name:null,contact_email:null,contact_phone:null,
 eligible_business_verified:false,good_standing_verified:false,tax_identifier_verified:false,
 proposed_project:null,verified_project_budget:null,verified_matching_funds:false,
 keywords:['business development','small business','technology','software','artificial intelligence',
 'innovation','industrial','manufacturing','energy efficiency','research and development','workforce']
});
export function parseCsv(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES)throw Error('GRANT_CSV_INVALID_OR_TOO_LARGE');
 const rows=[];let cells=[],field='',quoted=false;
 const cell=()=>{cells.push(field);field='';if(cells.length>95)throw Error('GRANT_CSV_COLUMN_LIMIT')};
 const row=()=>{cell();if(cells.some(x=>x.length))rows.push(cells);cells=[];if(rows.length>MAX_ROWS+1)throw Error('GRANT_CSV_ROW_LIMIT')};
 for(let i=0;i<raw.length;i++){
  const ch=raw[i];
  if(ch==='"'){
   if(quoted&&raw[i+1]==='"'){field+='"';i++}
   else if(quoted)quoted=false;
   else if(field==='')quoted=true;
   else throw Error('GRANT_CSV_INVALID_QUOTE');
  }else if(ch===','&&!quoted)cell();
  else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&raw[i+1]==='\n')i++;row()}
  else {field+=ch;if(field.length>50000)throw Error('GRANT_CSV_FIELD_LIMIT')}
 }
 if(quoted)throw Error('GRANT_CSV_UNCLOSED_QUOTE');
 if(field||cells.length)row();
 if(rows.length<2)throw Error('GRANT_CSV_EMPTY');
 const header=rows.shift().map(x=>x.replace(/^\uFEFF/,'').trim());
 for(const key of ['GrantID','Status','Title','ApplicantType','ApplicationDeadline','GrantURL']){
  if(!header.includes(key))throw Error('GRANT_CSV_MISSING_FIELD_'+key);
 }
 return rows.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]||''])));
}
function deadline(value,now){
 const raw=text(value,180);
 const iso=raw.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
 const usa=raw.match(/\b(\d\d?)\/(\d\d?)\/(20\d\d)\b/);
 const time=iso?Date.parse(iso[0]+'T23:59:59Z'):usa?
  Date.parse(usa[3]+'-'+usa[1].padStart(2,'0')+'-'+usa[2].padStart(2,'0')+'T23:59:59Z'):NaN;
 if(!Number.isFinite(time)){
  return {date:null,state:/rolling|ongoing|continuous|until funds/i.test(raw)?'rolling_verify':'deadline_unverified'};
 }
 return {date:new Date(time).toISOString().slice(0,10),state:time<now.getTime()?'expired':'future'};
}
function officialUrl(value){
 try{const url=new URL(text(value,1800));
  if(url.protocol!=='https:'||url.username||url.password||url.port||
    !/(?:^|\.)ca\.gov$|(?:^|\.)grants\.gov$/i.test(url.hostname))return null;
  return url.href;
 }catch{return null}
}
export function selectOpportunities(rows,{profile=DEFAULT_PROFILE,now=new Date()}={}){
 const keywords=(Array.isArray(profile.keywords)?profile.keywords:[]).filter(x=>typeof x==='string'&&x.length>=4&&x.length<=70).map(norm).slice(0,35);
 const found=[],seen=new Set();let openBusinessCount=0;
 for(const row of rows){
  if(!row||typeof row!=='object')continue;
  const id=text(row.GrantID||row.PortalID,90),title=text(row.Title,230),status=norm(row.Status);
  if(!id||!title||seen.has(id))continue;seen.add(id);
  if(!/\b(?:active|open|accepting|posted)\b/.test(status)||
    /\b(?:closed|awarded|expired|archived|cancelled)\b/.test(status))continue;
  const applicant=norm(row.ApplicantType);
  if(!/\b(?:business|small business|for profit|forprofit|private sector)\b/.test(applicant))continue;
  const due=deadline(row.ApplicationDeadline,now);if(due.state==='expired')continue;
  openBusinessCount++;
  const corpus=norm([title,row.Categories,row.Purpose,row.Description].join(' '));
  const terms=keywords.filter(t=>corpus.includes(t));
  if(!terms.length)continue;
  found.push({
   grant_id:id,title,agency:text(row.AgencyDept,180),status:text(row.Status,80),
   applicant_type:text(row.ApplicantType,330),geography:text(row.Geography,300),
   purpose:text(row.Purpose,2600),description_excerpt:text(row.Description,3200),
   estimated_awards:text(row.EstAmounts,180),matching_funds:text(row.MatchingFunds,180),
   official_source:SOURCE_PAGE,application_url:officialUrl(row.GrantURL),
   raw_application_url:text(row.GrantURL,900),
   application_deadline:text(row.ApplicationDeadline,160),
   deadline_date:due.date,deadline_state:due.state,
   matched_keywords:terms,priority:Math.min(90,30+terms.length*8+(due.state==='future'?4:0)),
   eligibility_verified:false,submitted:false,application_form_filled:false,
   evidence_gaps:['specific grant eligibility','company registration and identifiers',
    'official application questions and attachments','actual project and verified project budget']
  });
 }
 found.sort((a,b)=>b.priority-a.priority||
  (a.deadline_date||'9999').localeCompare(b.deadline_date||'9999')||
  a.grant_id.localeCompare(b.grant_id));
 return {open_business_count:openBusinessCount,shortlist:found.slice(0,60)};
}
function rtfEsc(value){
 let s='';
 for(const c of String(value??'')){
  const n=c.codePointAt(0);
  if(c==='\\'||c==='{'||c==='}')s+='\\'+c;
  else if(c==='\n')s+='\\par ';
  else if(n>=32&&n<=126)s+=c;
  else if(n<32)continue;
  else for(const unit of c){const z=unit.charCodeAt(0);s+='\\u'+(z>32767?z-65536:z)+'?'}
 }
 return s;
}
export function makeWorksheet(grant,profile=DEFAULT_PROFILE){
 const fields=[
  ['FILE STATUS','EDITABLE DRAFT — NOT THE OFFICIAL AGENCY APPLICATION'],
  ['GRANT NAME',grant.title],['GRANT ID',grant.grant_id],['AGENCY',grant.agency],
  ['OFFICIAL SOURCE',SOURCE_PAGE],
  ['APPLICATION LINK',grant.application_url||'[UNVERIFIED — USE OFFICIAL PORTAL]'],
  ['DEADLINE',grant.application_deadline||'[VERIFY WITH AGENCY]'],
  ['APPLICANT ORGANIZATION',profile.business_name||'[REQUIRED]'],
  ['ORGANIZATION TYPE',profile.business_type||'[REQUIRED]'],
  ['DESCRIPTION — DRAFT',profile.business_description||'[REVIEW REQUIRED]'],
  ['REGISTERED ADDRESS',profile.registered_address||'[MISSING — OPERATOR MUST PROVIDE]'],
  ['CONTACT NAME',profile.contact_name||'[MISSING — OPERATOR MUST PROVIDE]'],
  ['CONTACT EMAIL',profile.contact_email||'[MISSING — OPERATOR MUST PROVIDE]'],
  ['CONTACT PHONE',profile.contact_phone||'[MISSING — OPERATOR MUST PROVIDE]'],
  ['REGISTRATION',profile.good_standing_verified?'OPERATOR ASSERTED, CHECK EVIDENCE':'NOT VERIFIED'],
  ['ELIGIBILITY','[UNVERIFIED — READ GRANT RULES BEFORE APPLYING]'],
  ['PROJECT',profile.proposed_project||'[NEEDS SPECIFIC ACTUAL PROJECT DETAILS]'],
  ['BUDGET',profile.verified_project_budget||'[NEEDS REAL QUOTES AND BUDGET]'],
  ['MATCHING FUNDS',grant.matching_funds||'[VERIFY REQUIREMENT]'],
  ['QUESTIONS','[OPEN OFFICIAL PORTAL AND ENTER EXACT FORM FIELDS]'],
  ['ATTACHMENTS','[REVIEW OFFICIAL DOCUMENT CHECKLIST]'],
  ['SUBMISSION STATUS','NOT SIGNED. NOT SUBMITTED. HUMAN REVIEW REQUIRED.']
 ];
 return '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\fs22'+
  '\\b FUN INDUSTRIAL LLC — APPLICATION PREPARATION\\b0\\par\\par '+
  fields.map(([key,value])=>'\\b '+rtfEsc(key)+'\\b0\\par '+rtfEsc(value)+'\\par\\par ').join('')+'}';
}
async function download({fetchImpl=fetch}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  let res=await fetchImpl(SOURCE_CSV,{method:'GET',redirect:'manual',signal:controller.signal});
  if([301,302,303,307,308].includes(res.status)){
   const target=new URL(String(res.headers.get('location')||''),SOURCE_CSV);
   if(target.protocol!=='https:'||target.username||target.password||
    !/^[0-9a-f]{32}\.us\.r2\.cloudflarestorage\.com$/.test(target.hostname))
     throw Error('GRANTS_SOURCE_REDIRECT_REFUSED');
   res=await fetchImpl(target.toString(),{method:'GET',redirect:'error',signal:controller.signal});
  }
  if(!res.ok||!res.body)throw Error('GRANTS_SOURCE_HTTP_'+res.status);
  if(Number(res.headers.get('content-length')||0)>MAX_BYTES)throw Error('GRANTS_SOURCE_SIZE');
  let n=0,parts=[];
  for await(const part of res.body){n+=part.length;if(n>MAX_BYTES)throw Error('GRANTS_SOURCE_SIZE');parts.push(part)}
  return Buffer.concat(parts);
 }finally{clearTimeout(timer)}
}
const defaultDirectory=()=>join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'FunIndustrial','RealApplicationWorkerV1');
const fileId=id=>String(id).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,65)||'unknown';
async function atomic(path,contents){
 const tmp=path+'.'+randomUUID()+'.tmp';
 await writeFile(tmp,contents,{flag:'wx'});await rename(tmp,path);
}
export async function runOpportunityCycle({directory=defaultDirectory(),fetchImpl=fetch,now=new Date()}={}){
 const when=new Date(now);if(!Number.isFinite(when.getTime()))throw Error('GRANTS_INVALID_TIME');
 await mkdir(directory,{recursive:true});
 const profileFile=join(directory,'business-profile.json');
 let profile;
 try{profile=JSON.parse(await readFile(profileFile,'utf8'))}
 catch(e){if(e.code!=='ENOENT')throw e;profile=DEFAULT_PROFILE;
  await writeFile(profileFile,JSON.stringify(profile,null,2)+'\n',{flag:'wx'})}
 if(profile.schema!==DEFAULT_PROFILE.schema||typeof profile.business_name!=='string'||
   profile.business_name.length>250)throw Error('GRANTS_PROFILE_UNVERIFIED_SCHEMA');
 const bytes=await download({fetchImpl}),sha=digest(bytes),rows=parseCsv(bytes.toString('utf8'));
 const selected=selectOpportunities(rows,{profile,now:when});
 const evidenceDir=join(directory,'evidence'),draftDir=join(directory,'drafts');
 await mkdir(evidenceDir,{recursive:true});await mkdir(draftDir,{recursive:true});
 const rawFile=join(evidenceDir,'grants-offered-'+sha+'.csv');
 try{await writeFile(rawFile,bytes,{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}
 let created=0;const drafts=[];
 for(const grant of selected.shortlist.slice(0,3)){
  const folder=join(draftDir,fileId(grant.grant_id));await mkdir(folder,{recursive:true});
  const draftFile=join(folder,'application-worksheet.rtf');
  try{await writeFile(draftFile,makeWorksheet(grant,profile),{flag:'wx'});created++}
  catch(e){if(e.code!=='EEXIST')throw e} // never overwrite edited drafts
  await atomic(join(folder,'source-record.json'),JSON.stringify({grant,source_sha256:sha,
   source_url:SOURCE_CSV,captured_utc:when.toISOString(),submitted:false,
   actual_grant_eligibility_verified:false},null,2)+'\n');
  drafts.push({grant_id:grant.grant_id,title:grant.title,path:draftFile,status:'NOT_SUBMITTED'});
 }
 const reportFile=join(directory,'last-run.json');
 let previous=null;
 try{previous=JSON.parse(await readFile(reportFile,'utf8'))}
 catch(e){if(e.code!=='ENOENT')throw e}
 const report={version:VERSION,run_id:randomUUID(),timestamp:when.toISOString(),
  state:'REAL_SOURCE_SCANNED_DRAFTS_PREPARED',official_source:SOURCE_PAGE,
  source_url:SOURCE_CSV,source_sha256:sha,evidence_file:rawFile,
  records_scanned:rows.length,open_business_opportunities:selected.open_business_count,
  relevant_candidates:selected.shortlist.length,
  new_editable_drafts:created,available_drafts:drafts,
  top_candidates:selected.shortlist.slice(0,12),profile_file:profileFile,
  source_changed_since_previous:previous?.source_sha256?previous.source_sha256!==sha:null,
  submitted_applications:0,approved_spending:0,
  next_step:'Operator must review program-specific eligibility and missing details. No official application was submitted.'};
 await atomic(reportFile,JSON.stringify(report,null,2)+'\n');
 return report;
}
