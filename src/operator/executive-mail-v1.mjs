// Read-only Gmail triage for Fun Industrial Executive Operator.
// Uses the separately authorized Google OAuth identity already in local-gmail.
// No email body is persisted, no send/draft/modify API calls, no Cognee writes.
import {gmailProfile,gmailList,gmailRead,EXPECTED_GMAIL_ACCOUNT} from '../gmail/local-gmail.mjs';
export async function readExecutiveMailHeaders(){
 const profile=await gmailProfile();
 if(profile?.state!=='connected'||profile.emailAddress?.toLowerCase()!==EXPECTED_GMAIL_ACCOUNT)
  throw Error('EXEC_MAIL_VERIFIED_ACCOUNT_REQUIRED');
 const list=await gmailList({maxResults:8,query:'newer_than:14d'});
 if(!Array.isArray(list.messages)||list.messages.length>8)throw Error('EXEC_MAIL_LIST_INVALID');
 const messages=[];
 for(const item of list.messages){
  if(!item||!/^([0-9a-f]{8,32})$/i.test(item.id||''))continue;
  try{
   const m=await gmailRead(item.id);
   if(m.id===item.id)messages.push({id:item.id,subject:m.subject||'(no subject)',from:m.from||'',date:m.date||''});
  }catch{ /* An unreadable individual message does not prevent other items. */ }
 }
 return {account_verified:true,messages};
}
