// One-process FIAL5.7 outcome CLI. Scheduled operations ONLY use --observe;
// sending must use --send-approved-stdin from a distinct human command.
import {open} from 'node:fs/promises';
import {join} from 'node:path';
import {prepareOutcome,observeOutcome,markAttempt,recordGmailSend,
 authorizationPhrase,contentFingerprint,ROOT} from '../src/outcomes/outcome-engine-v5-7.mjs';
import {readElektronInboxHeaders} from '../src/operator/elektron-gmail-v5-5.mjs';
import {connectSendPermission,accessForElektronSend,sendApprovedInquiry} from '../src/outcomes/elektron-send-v5-7.mjs';
let action=process.argv[2]||'';
async function stdinApproval(){
 const chunks=[];let bytes=0;
 for await(const b of process.stdin){
  bytes+=b.length;if(bytes>180)throw Error('FIAL57_APPROVAL_TOO_LONG');
  chunks.push(b)
 }
 return Buffer.concat(chunks).toString('utf8').trim();
}
try{
 if(process.argv.length!==3)throw Error('FIAL57_SINGLE_ACTION_ONLY');
 if(action==='--prepare'){
  const p=await prepareOutcome();
  console.log('FIAL57_DRAFT_STATE='+p.record.state);
  console.log('FIAL57_DRAFT_FILE='+p.draftFile);
  console.log('FIAL57_FINGERPRINT='+p.fingerprint);
  console.log('FIAL57_OFFICIAL_CONTACT='+p.draft.to);
  console.log('FIAL57_REVIEW_MESSAGE_START');
  console.log('FROM: '+p.draft.from);
  console.log('TO: '+p.draft.to);
  console.log('SUBJECT: '+p.draft.subject);
  console.log(p.draft.text);
  console.log('FIAL57_REVIEW_MESSAGE_END');
  console.log('FIAL57_APPROVAL_PHRASE='+authorizationPhrase(p.fingerprint));
  console.log('FIAL57_MAIL_SENT=0');
 }else if(action==='--observe'){
  const result=await observeOutcome({readMailbox:readElektronInboxHeaders});
  console.log('FIAL57_SCHEDULED_OUTCOME_OBSERVATION=PASS');
  console.log('FIAL57_OUTCOME_STATE='+result.state);
  console.log('FIAL57_MAILBOX='+result.mailbox_state);
  console.log('FIAL57_REPLY_CANDIDATES='+result.reply_candidate_count);
  console.log('FIAL57_PROGRESS='+result.progress_measure);
  console.log('FIAL57_EXTERNAL_SENDS_PERFORMED=0');
 }else if(action==='--status'){
  const p=await prepareOutcome();
  console.log(JSON.stringify({
   state:p.record.state,receipt:p.record.receipt_state,send_attempts:p.record.send_attempts,
   reply_candidates:p.record.reply_candidates?.length||0,
   next_action:p.record.state==='DRAFT_AWAITING_REVIEW'?'REVIEW_AND_APPROVE_ONE_OUTGOING_EMAIL':
    p.record.state==='SENT_WITH_GMAIL_RECEIPT'?'REVIEW_OFFICIAL_RESPONSE':'HOLD_RECONCILIATION',
   external_actions_this_invocation:0
  },null,2));
 }else if(action==='--connect-send'){
  console.log(JSON.stringify(await connectSendPermission()));
 }else if(action==='--send-approved-stdin'){
  // No arbitrary recipients, subjects, attachments, files, or instruction fields accepted.
  // Exact one-use authorization is read from stdin, not argv or a web POST.
  const p=await prepareOutcome();
  const supplied=await stdinApproval();
  if(supplied!==authorizationPhrase(p.fingerprint))
   throw Error('FIAL57_APPROVAL_PHRASE_MISMATCH');
  if(p.record.state!=='DRAFT_AWAITING_REVIEW'||p.record.send_attempts!==0)
   throw Error('FIAL57_ALREADY_ATTEMPTED_NO_RETRY');
  // Preflight account and Google send permission before any irreversible send checkpoint.
  await accessForElektronSend();
  // Persist a permanent lock against concurrent approval processes.
  const file=join(ROOT(),'OutcomeV57','send-attempt-locked');
  const handle=await open(file,'wx',0o600);
  try{
   await handle.writeFile('ONE_SEND_ATTEMPT_LOCK\\n');await handle.sync();
   await markAttempt({fingerprint:p.fingerprint});
   // If network outcome is ambiguous, keep state SEND_ATTEMPT_STARTED.
   // No automatic repeat; a human must reconcile Sent folder first.
   const response=await sendApprovedInquiry(p.draft);
   const updated=await recordGmailSend({fingerprint:p.fingerprint,response});
   console.log('FIAL57_ONE_EXPLICIT_SEND=GMAIL_API_ACCEPTED');
   console.log('FIAL57_GMAIL_MESSAGE_ID='+updated.send_id);
   console.log('FIAL57_OUTCOME_STATE='+updated.state);
   console.log('FIAL57_RECIPIENT='+p.draft.to);
   console.log('FIAL57_GOOGLE_RECEIPT_NOT_PROOF_OF_RECIPIENT_DELIVERY');
  }finally{await handle.close()}
 }else throw Error('FIAL57_ALLOWED=--prepare|--observe|--status|--connect-send|--send-approved-stdin');
}catch(e){
 console.error('FIAL57_HOLD='+String(e.message||e).slice(0,180));
 if(action==='--send-approved-stdin')
  console.error('FIAL57_DO_NOT_RETRY_UNTIL_SENT_FOLDER_AND_LEDGER_ARE_RECONCILED');
 process.exitCode=1;
}
