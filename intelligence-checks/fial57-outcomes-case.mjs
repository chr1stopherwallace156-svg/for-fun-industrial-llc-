import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {inquiryForBusiness,contentFingerprint,prepareOutcome,markAttempt,recordGmailSend,
 observeOutcome,readOutcomeStatus,classifyInbox,authorizationPhrase,VERSION,CITY_EMAIL} from '../src/outcomes/outcome-engine-v5-7.mjs';
import {rawMessage,SCOPE_SEND,SCOPE_IDENTITY} from '../src/outcomes/elektron-send-v5-7.mjs';
const stamp=new Date('2026-11-14T23:30:00.000Z');
const business={
 legal_name:'ELEKTRON INDUSTRIAL LLC',owner:'Fixture Person',email:'fixture@example.invalid',
 business_license_file_reference:'B-FIXTURE-42',business_address:'123 Example St',
 city:'Victorville',state:'CA',zip:'92392'};
async function testRoot(){
 const root=await mkdtemp(join(tmpdir(),'fi57-outcome-'));
 await writeFile(join(root,'business-identity-v5-5.json'),JSON.stringify({
  schema:'fun-industrial-business-identity-v5-5',
  software:{name:'Fun Industrial',type:'software_workspace',
   licensed_business_claim:false,has_business_license_claim:false},
  company:{...business,phone:'760-000-0000',website:'https://example.invalid',
   business_license_reference_type:'operator_supplied_number_not_issuer_verified',
   official_registration_verified:false,business_license_status_verified:false,
   source:'operator_provided'}
 }));
 return root;
}
test('prepared inquiry is limited to official city and admits no license verification claim',()=>{
 const m=inquiryForBusiness(business);
 assert.equal(m.to,CITY_EMAIL);
 assert.match(m.text,/not verified by the City/);
 assert.match(m.text,/whether a license has been issued/);
 assert.match(m.subject,/ELEKTRON/);
 assert.equal(m.claim,'OPERATOR_PROVIDED_NOT_CITY_VERIFIED');
 assert.match(contentFingerprint(m),/^[a-f0-9]{64}$/);
 assert.throws(()=>contentFingerprint({...m,to:'random@example.com'}),/MESSAGE_UNVERIFIED/);
});
test('actual profile yields immutable draft and no external operation',async()=>{
 const root=await testRoot();
 try{
  const one=await prepareOutcome({root,now:stamp});
  assert.equal(one.record.state,'DRAFT_AWAITING_REVIEW');
  assert.equal(one.record.send_attempts,0);
  assert.equal(one.record.external_form_submissions,0);
  const d=await readFile(one.draftFile,'utf8');
  assert.match(d,/Fixture Person/);
  assert.match(authorizationPhrase(one.fingerprint),/SEND ELEKTRON INQUIRY/);
  const two=await prepareOutcome({root,now:new Date(+stamp+30000)});
  assert.equal(two.fingerprint,one.fingerprint);
  assert.equal(two.record.send_attempts,0);
  assert.equal((await readdir(join(root,'OutcomeV57'))).length,2);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('one approved attempt persists irreversibly before any external network call',async()=>{
 const root=await testRoot();
 try{
  const p=await prepareOutcome({root,now:stamp});
  const a=await markAttempt({root,fingerprint:p.fingerprint,now:new Date(+stamp+1000)});
  assert.equal(a.state,'SEND_ATTEMPT_STARTED');
  assert.equal(a.send_attempts,1);
  assert.equal(a.receipt_state,'PENDING_UNKNOWN_OUTCOME');
  await assert.rejects(markAttempt({root,fingerprint:p.fingerprint,now:stamp}),/REPLAY_OR_IDENTITY_HOLD/);
  await assert.rejects(recordGmailSend({root,fingerprint:p.fingerprint,response:{id:'invalid',threadId:'0'},now:stamp}),
   /GMAIL_RESPONSE_INVALID/);
  const still=await readOutcomeStatus({root});
  assert.equal(still.state,'SEND_ATTEMPT_STARTED');
  assert.equal(still.progress_measure,'NO_CONFIRMED_EXTERNAL_OUTCOME');
  const b=await recordGmailSend({root,fingerprint:p.fingerprint,
   response:{id:'a'.repeat(16),threadId:'b'.repeat(16)},now:new Date(+stamp+2000)});
  assert.equal(b.state,'SENT_WITH_GMAIL_RECEIPT');
  assert.equal(b.receipt_state,'GMAIL_API_SEND_CONFIRMED');
  await assert.rejects(markAttempt({root,fingerprint:p.fingerprint,now:stamp}),/REPLAY_OR_IDENTITY_HOLD/);
  assert.equal((await readOutcomeStatus({root})).progress_measure,'ONE_GMAIL_SEND_RECEIPT');
 }finally{await rm(root,{recursive:true,force:true})}
});
test('nonofficial and unrelated inbox messages never count as verified replies',async()=>{
 const root=await testRoot();
 try{
  const p=await prepareOutcome({root,now:stamp});
  const no=classifyInbox(p.record,[{id:'a'.repeat(16),from:'attacker@invalid.example',
   subject:'ELEKTRON Business License'}]);
  assert.equal(no.reply_candidates.length,0);
  const possible=classifyInbox(p.record,[{id:'a'.repeat(16),
   from:'Victorville Business License <businesslicense@victorvilleca.gov>',
   subject:'Re: ELEKTRON business license status'}]);
  assert.equal(possible.reply_candidates.length,1);
  assert.equal(possible.reply_state,'POSSIBLE_REPLY_REQUIRES_HUMAN_REVIEW');
  assert.equal(possible.reply_candidates[0].external_delivery_verified,false);
  assert.equal(possible.state,'DRAFT_AWAITING_REVIEW');
 }finally{await rm(root,{recursive:true,force:true})}
});
test('scheduled observe reads only mailbox headers and reports unavailability without claiming success',async()=>{
 const root=await testRoot();
 try{
  const first=await observeOutcome({root,now:stamp,readMailbox:async()=>{
   throw Error('NOT_CONNECTED')}});
  assert.equal(first.mailbox_state,'MAILBOX_UNAVAILABLE');
  assert.equal(first.inquiry.sent,false);
  const another=await observeOutcome({root,now:new Date(+stamp+1000),
   readMailbox:async()=>({account_verified:true,messages:[{
    id:'c'.repeat(16),from:'businesslicense@victorvilleca.gov',
    subject:'Response regarding ELEKTRON license file'}]})});
  assert.equal(another.reply_candidate_count,1);
  assert.equal(another.certified_license_status,false);
  assert.equal(another.external_form_submissions,0);
  assert.equal(another.progress_measure,'NO_CONFIRMED_EXTERNAL_OUTCOME');
 }finally{await rm(root,{recursive:true,force:true})}
});
test('account-specific send scope remains isolated from prior read-only Gmail authorization',()=>{
 assert.equal(SCOPE_SEND,'https://www.googleapis.com/auth/gmail.send');
 assert.equal(SCOPE_IDENTITY,'https://www.googleapis.com/auth/userinfo.email');
 const raw=rawMessage(inquiryForBusiness(business));
 const decoded=Buffer.from(raw,'base64url').toString('utf8');
 assert.match(decoded,/To: businesslicense@victorvilleca.gov/);
 assert.match(decoded,/Content-Transfer-Encoding: base64/);
 assert.doesNotMatch(decoded,/B-FIXTURE-42/);
 assert.throws(()=>rawMessage({...inquiryForBusiness(business),to:'test@example.net'}),/SEND_MESSAGE_INVALID/);
 assert.throws(()=>rawMessage({...inquiryForBusiness(business),subject:'Oops\nBcc: spy'}),/UNSAFE_EMAIL_HEADER/);
});
test('business profile or sending recipient changed after preparation creates safe hold',async()=>{
 const root=await testRoot();
 try{
  const one=await prepareOutcome({root,now:stamp});
  const profile=JSON.parse(await readFile(join(root,'business-identity-v5-5.json'),'utf8'));
  profile.company.business_address='Different address';
  await writeFile(join(root,'business-identity-v5-5.json'),JSON.stringify(profile));
  await assert.rejects(prepareOutcome({root,now:stamp}),/EXISTING_OUTCOME_CONFLICT_NO_OVERWRITE/);
  assert.equal((await readOutcomeStatus({root})).inquiry.sent,false);
 }finally{await rm(root,{recursive:true,force:true})}
});
