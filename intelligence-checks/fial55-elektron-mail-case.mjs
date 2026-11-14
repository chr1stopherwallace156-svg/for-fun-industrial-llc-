import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {oauthClient,GMAIL_SCOPE} from '../src/operator/elektron-gmail-v5-5.mjs';
import {buildWork} from '../src/operator/executive-ops-v1.mjs';
test('Elektron Gmail has independent strict read-only OAuth scope',()=>{
 assert.equal(GMAIL_SCOPE,'https://www.googleapis.com/auth/gmail.readonly');
 assert.deepEqual(oauthClient({installed:{client_id:'fake.apps.googleusercontent.com',client_secret:'synthetic'}}),
  {id:'fake.apps.googleusercontent.com',secret:'synthetic'});
 assert.throws(()=>oauthClient({installed:{client_id:'wrong-client',client_secret:'synthetic'}}),/CLIENT_INVALID/);
 assert.throws(()=>oauthClient({installed:{client_id:'fake.apps.googleusercontent.com',client_secret:'synthetic',token_uri:'https://evil.example/'}}),/CLIENT_INVALID/);
});
test('email triage is assigned to ELEKTRON and never implies send permission',()=>{
 const tasks=buildWork({mailState:'connected_read_only',today:new Date('2026-11-14T20:00:00Z'),inbox:[
  {id:'a'.repeat(15),subject:'Grant filing receipt',from:'agency@example.org'}
 ]});
 const t=tasks.find(x=>x.source==='authorized_readonly_gmail_header');
 assert.ok(t);assert.equal(t.company,'elektron');assert.equal(t.external_action_authorized,false);
 assert.equal(t.executed_externally,false);
});
test('read-only Gmail adapter never sends or modifies and no raw email is committed to state',async()=>{
 const adapter=await readFile(new URL('../src/operator/elektron-gmail-v5-5.mjs',import.meta.url),'utf8');
 assert.match(adapter,/GMAIL_SCOPE='https:\/\/www.googleapis.com\/auth\/gmail.readonly'/);
 assert.match(adapter,/join\(ROOT\(\),'ElektronGmail','gmail-token.dpapi'\)/);
 assert.match(adapter,/profile\.emailAddress|p\.emailAddress/);
 assert.doesNotMatch(adapter,/gmail\.send|gmail\.modify|method:'DELETE'|messages\/send|messages\/trash/);
 assert.match(adapter,/format=metadata&metadataHeaders=From/);
 assert.match(adapter,/ELEKTRON_OAUTH_WRONG_GOOGLE_ACCOUNT/);
});
