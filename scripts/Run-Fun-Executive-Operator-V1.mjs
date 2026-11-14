// One bounded non-resident FIAL5.4 executive-operator cycle.
// Windows Task Scheduler owns cadence. No model server or port started.
import {runExecutiveCycle,ROOT,VERSION} from '../src/operator/executive-ops-v1.mjs';
import {readExecutiveMailHeaders} from '../src/operator/executive-mail-v1.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
if(process.argv.length!==3||process.argv[2]!=='--once'){
 console.log('FIAL54_EXECUTIVE_OPERATOR=IDLE --once REQUIRED');process.exitCode=2;
}else{
 const start=Date.now(),dir=ROOT();
 try{
  const result=await runExecutiveCycle({readMailbox:readExecutiveMailHeaders});
  if(result.version!==VERSION||result.outbound_permissions.email_sent!==0||
    result.outbound_permissions.government_filings!==0||
    result.outbound_permissions.spent_usd!==0||
    result.outbound_permissions.rea_runs!==0)throw Error('FIAL54_AUTHORITY_MISMATCH');
  console.log('FIAL54_EXECUTIVE_CYCLE=PASS');
  console.log('FIAL54_WORKSTREAMS='+result.domains.join(','));
  console.log('FIAL54_ACTIVE_ITEMS='+result.active_items);
  console.log('FIAL54_NEW_OR_CHANGED='+result.new_or_changed);
  console.log('FIAL54_LOCAL_PACKETS='+result.local_packets_written.length);
  console.log('FIAL54_GMAIL='+result.mail_state);
  console.log('FIAL54_GRANTS='+result.grants.state);
  console.log('FIAL54_NEXT_ACTION='+JSON.stringify(result.next_action));
  console.log('FIAL54_STATE_PATH='+join(dir,'state-v1.json'));
  console.log('FIAL54_EXTERNAL_ACTIONS=ZERO NO_EMAIL_SEND_NO_FILINGS_NO_SPENDING_NO_REA');
  console.log('FIAL54_DURATION_MS='+(Date.now()-start));
 }catch(e){
  await mkdir(dir,{recursive:true});
  const msg=String(e?.message||e).slice(0,190);
  await writeFile(join(dir,'last-error.txt'),new Date().toISOString()+' '+msg+'\n',{flag:'w'});
  console.error('FIAL54_EXECUTIVE_HOLD='+msg);process.exitCode=1;
 }
}
