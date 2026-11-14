// Offline qualifications for the LIVE California Grants Offered application-prep worker.
// Synthetic fixtures only in tests; live runner reads official State of California data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseCsv,selectOpportunities,makeWorksheet,runOpportunityCycle,VERSION,SOURCE_CSV} from '../src/applications/opportunity-worker-v1.mjs';

const HEADER='PortalID,GrantID,Status,AgencyDept,Title,ApplicantType,Categories,Purpose,Description,ApplicationDeadline,GrantURL,EstAmounts,MatchingFunds,Geography';
const rows=[
 ['100','CA-001','Active','California Energy Commission','Energy efficiency small business technology grant','Businesses','technology','Small business innovation','Equipment funding for small business energy efficiency','2027-06-30','https://www.grants.ca.gov/grants/example-001','Up to $50000','None','California'],
 ['101','CA-002','Closed','California State Library','Software grant','Businesses','technology','Software development','Research','2027-06-30','https://www.grants.ca.gov/grants/example-002','','','California'],
 ['102','CA-003','Active','California Arts Council','Nonprofit music grants','Nonprofit organizations','arts','Arts support','Nonprofit creativity funding','2027-06-30','https://www.grants.ca.gov/grants/example-003','','','California'],
 ['103','CA-004','Active','CA Agency','Tech startup cybersecurity research','Small Businesses','innovation','Small business research','AI and software startup research and development','2027-07-01','https://www.grants.ca.gov/grants/example-004','Up to $100000','match possible','California'],
 ['104','CA-005','Active','CA Agency','Technology award closed last year','Businesses','technology','Technology','Award expired','2025-07-01','https://www.grants.ca.gov/grants/example-005','','','California'],
 ['105','CA-006','Active','CA Agency','Sports celebrity news','Individuals','entertainment','Sports news','Unknown','2027-06-30','https://www.grants.ca.gov/grants/example-006','','','California']
];
const csvField=s=>/[",\r\n]/.test(String(s))?'"'+String(s).replace(/"/g,'""')+'"':String(s);
const CSV=HEADER+'\r\n'+rows.map(row=>row.map(csvField).join(',')).join('\r\n')+'\r\n';
const NOW=new Date('2026-11-14T12:00:00Z');
test('California official source and real metadata columns are fixed, not grants-awarded historical dataset',()=>{
 assert.equal(SOURCE_CSV,'https://publish.data.ca.gov/dataset/e1b1c799-cdd4-4219-af6d-93b79747fffb/resource/111c8c88-21f6-453c-ae2c-b4785a0624f5/download/california-grants-portal-data.csv');
 assert.equal(VERSION,'fun-real-application-worker-v1');
 const parsed=parseCsv(CSV);
 assert.equal(parsed.length,6);
 assert.equal(parsed[0].AgencyDept,'California Energy Commission');
});
test('CSV parser supports embedded commas, newlines, escaped quotes; refuses incorrect columns',()=>{
 const tricky=HEADER+'\n'+[...rows[0].slice(0,8),'Research, design\nand "verification"',...rows[0].slice(9)].map(csvField).join(',')+'\n';
 const parsed=parseCsv(tricky);
 assert.match(parsed[0].Description,/Research, design\nand "verification"/);
 assert.throws(()=>parseCsv('name,value\nx,5\n'),/SOURCE|GRANT_CSV/);
 assert.throws(()=>parseCsv(''),/SOURCE|GRANT_CSV/);
});
test('only open business-type relevant grants with future/unverified deadlines reach drafts',()=>{
 const result=selectOpportunities(parseCsv(CSV),{now:NOW});
 assert.equal(result.open_business_count,2);
 assert.equal(result.shortlist.length,2);
 assert.deepEqual(new Set(result.shortlist.map(x=>x.grant_id)),new Set(['CA-001','CA-004']));
 for(const item of result.shortlist){
  assert.equal(item.eligibility_verified,false);
  assert.equal(item.submitted,false);
  assert.equal(item.application_form_filled,false);
  assert.equal(item.deadline_state,'future');
  assert.equal(item.evidence_gaps.length,4);
  assert.ok(item.priority>0);
 }
});
test('worksheet is an actual editable RTF file payload, with source-specific content and missing fields visible',()=>{
 const candidate=selectOpportunities(parseCsv(CSV),{now:NOW}).shortlist[0];
 const content=makeWorksheet(candidate);
 assert.ok(content.startsWith('{\\rtf1'));
 assert.match(content,/APPLICATION PREPARATION/);
 assert.match(content,/NOT THE OFFICIAL AGENCY APPLICATION/);
 assert.match(content,/CA-00[14]/);
 assert.match(content,/PROGRAM PURPOSE FROM OFFICIAL DATASET/);
 assert.match(content,/PROGRAM DESCRIPTION EXCERPT/);
 assert.match(content,/ELIGIBLE APPLICANT TYPES AS PUBLISHED/);
 assert.match(content,/ESTIMATED AWARD AS PUBLISHED/);
 assert.match(content,/MISSING/);
 assert.match(content,/NOT SIGNED. NOT SUBMITTED/);
 assert.doesNotMatch(content,/verified_legal_status.*true|tax_identifier.*[0-9]{9}/);
});
test('one cycle fetches only official CSV once, stores hash, generates local files and preserves edits on a second run',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fun-grants-live-pilot-test-'));
 let fetches=0;
 const fetchImpl=async(url,options)=>{
  fetches++;
  assert.equal(url,SOURCE_CSV);assert.equal(options.method,'GET');
  assert.equal(options.redirect,'manual');
  return new Response(CSV,{status:200,headers:{'content-type':'text/csv'}});
 };
 try{
  const first=await runOpportunityCycle({directory,fetchImpl,now:NOW});
  assert.equal(first.version,VERSION);assert.equal(first.state,'REAL_SOURCE_SCANNED_DRAFTS_PREPARED');
  assert.equal(first.records_scanned,6);
  assert.equal(first.relevant_candidates,2);
  assert.equal(first.new_editable_drafts,2);
  assert.equal(first.submitted_applications,0);assert.equal(first.approved_spending,0);
  assert.equal(first.available_drafts.length,2);
  const hash=createHash('sha256').update(CSV).digest('hex');
  assert.equal(first.source_sha256,hash);
  const original=await readFile(first.evidence_file,'utf8');
  assert.equal(original,CSV);
  const worksheet=first.available_drafts[0].path;
  const firstContents=await readFile(worksheet,'utf8');
  assert.ok(firstContents.includes('NOT SUBMITTED'));
  await writeFile(worksheet,firstContents+'\\par USER APPROVED LOCAL EDITS');
  const second=await runOpportunityCycle({directory,fetchImpl,now:new Date('2026-11-14T18:00:00Z')});
  assert.equal(second.new_editable_drafts,0);
  assert.equal(second.source_changed_since_previous,false);
  assert.match(await readFile(worksheet,'utf8'),/USER APPROVED LOCAL EDITS/);
  assert.equal(fetches,2);
  assert.equal((await readdir(join(directory,'evidence'))).length,1);
  assert.ok((await readFile(join(directory,'last-run.json'),'utf8')).includes('REAL_SOURCE_SCANNED_DRAFTS_PREPARED'));
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('source is blocked if server redirects to another arbitrary host; no file or application is submitted',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'fun-grants-redirect-'));
 try{
  await assert.rejects(runOpportunityCycle({directory,now:NOW,fetchImpl:async(url,options)=>{
   return new Response(null,{status:302,headers:{location:'https://bad.example.com/secret.csv'}});
  }}),/GRANTS_SOURCE_REDIRECT_REFUSED/);
  await assert.rejects(readFile(join(directory,'last-run.json'),'utf8'),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('single-run and Task Scheduler are explicit separate steps, with no default daemon',async()=>{
 const script=await readFile(new URL('../scripts/Run-Fun-Grant-Applications-V1.mjs',import.meta.url),'utf8');
 const runner=await readFile(new URL('../Run-Fun-Grant-Applications-V1.ps1',import.meta.url),'utf8');
 const setup=await readFile(new URL('../Activate-Fun-Grant-Applications-V1.ps1',import.meta.url),'utf8');
 assert.match(script,/--once/);
 assert.match(script,/FUN_GRANTS_APPLICATION_SUBMISSIONS=0/);
 assert.match(runner,/Local\\FunIndustrial-GrantApplications-V1/);
 assert.match(runner,/ALREADY_RUNNING NO_DUPLICATE/);
 assert.match(setup,/Register-ScheduledTask/);
 assert.match(setup,/New-ScheduledTaskPrincipal -UserId \$User -LogonType Interactive -RunLevel Limited/);
 assert.match(setup,/REAL_CYCLE_NOT_VERIFIED_SCHEDULE_NOT_CREATED/);
 assert.match(setup,/00:00/);assert.match(setup,/06:00/);assert.match(setup,/12:00/);assert.match(setup,/18:00/);
 assert.match(setup,/SCHEDULE_ALREADY_EXISTS_DIFFERENT_ACTION_REFUSED/);
 assert.doesNotMatch(setup,/Start-Fun-Industrial|Stop-Process|taskkill|REA_ALLOWED_TOOLS|FUN_SHOPIFY_ADMIN_TOKEN/);
});
