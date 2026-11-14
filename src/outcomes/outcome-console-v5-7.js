// Read-only executive outcome display; intentionally no send button.
// Sending requires separately authorized Google OAuth and exact terminal approval.
(()=>{'use strict';
 const region=document.getElementById('fi-outcome-status');
 if(!region)return;
 const show=(label,value)=>{
  const row=document.createElement('p'),strong=document.createElement('strong');
  strong.textContent=label+': ';
  row.append(strong,document.createTextNode(String(value??'unknown')));
  region.append(row);
 };
 (async()=>{
  region.textContent='Checking exact business outcome receipt…';
  try{
   const r=await fetch('/api/operator/outcomes/status',{method:'GET',
    credentials:'same-origin',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   if(data.version!=='fial5.7-verified-outcomes-v1')throw Error('UNVERIFIED_OUTCOME_VERSION');
   region.replaceChildren();
   show('Outcome',data.progress_measure||'Not activated');
   show('City inquiry',data.inquiry?.receipt_state||'not prepared');
   show('Official recipient','City of Victorville Business License Division');
   show('Gmail API message receipt',data.inquiry?.gmail_receipt_id||'None');
   show('Mail connection',data.mailbox_state||'not connected');
   show('Possible replies awaiting review',data.reply_candidate_count||0);
   show('Official license status','NOT VERIFIED');
   show('Next specific action',data.next_gate||'Review evidence');
   const p=document.createElement('p');p.textContent='Automated cycles cannot send messages. A Gmail send receipt is not proof of recipient delivery or a license decision.';
   region.append(p);
  }catch(e){region.textContent='Outcome HOLD: '+String(e.message||e).slice(0,170)}
 })();
})();
