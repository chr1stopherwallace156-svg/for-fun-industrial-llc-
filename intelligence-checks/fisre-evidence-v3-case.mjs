import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createFisreEvidencePacket,validateFisreReport} from '../src/cognition/fisre-evidence-v3.mjs';

const scope='restricted_exact_rational_arithmetic_not_Python_runtime_or_floating_point';
function sample(status='PROVED'){
 const base={version:'fi-semantic-proof-v2',status,
  reason:status==='PROVED'?'ALL_SYNTACTIC_DIVISORS_NONZERO_IN_RATIONAL_DOMAIN':status==='UNKNOWN'?'NOT_SINGLE_RETURN':'ZERO_DIVISOR_IN_DOMAIN',
  source_sha256:'a'.repeat(64),function:'calculate_price',
  proof_scope:scope,source_executed:false,external_actions:0,tool_authority_granted:false,
  domain:{cost:{min:'0',max:'100'},margin:{min:'0',max:status==='PROVED'?'0.5':'1'}},
  division_checks:status==='UNKNOWN'?[]:[{line:2,expression:'1 - margin',minimum:status==='PROVED'?'1/2':'0',maximum:'1',status:status==='PROVED'?'PROVED_NONZERO':'ZERO_WITNESS_FOUND',...(status==='COUNTEREXAMPLE_FOUND'?{witness:{cost:'0',margin:'1'}}:{})}]
 };
 return base;
}
const clone=x=>JSON.parse(JSON.stringify(x));

test('reported safe proof creates proposed claim but not supported fact',()=>{
 const packet=createFisreEvidencePacket(sample());
 assert.equal(packet.state,'EVIDENCE_PROPOSED_NOT_VERIFIED');
 assert.equal(packet.proposedClaim.status,'proposed');
 assert.equal(packet.cognitiveSnapshot.claims[0].status,'proposed');
 assert.equal(packet.evidence.reportVerified,false);
 assert.equal(packet.evidence.independentProofVerified,false);
 assert.equal(packet.authorityGranted,false);
 assert.equal(packet.actionsExecuted,0);
});

test('counterexample is recorded as reported witness, not execution',()=>{
 const packet=createFisreEvidencePacket(sample('COUNTEREXAMPLE_FOUND'));
 assert.match(packet.proposedClaim.object,/witness/);
 assert.equal(packet.evidence.witnesses,1);
 assert.equal(packet.reportExecuted,false);
});

test('unknown remains proposed, never promoted',()=>{
 const packet=createFisreEvidencePacket(sample('UNKNOWN'));
 assert.match(packet.proposedClaim.object,/cannot_establish/);
 assert.equal(packet.cognitiveSnapshot.claims[0].status,'proposed');
});

test('report content is not mutated',()=>{
 const original=sample();const prior=clone(original);
 createFisreEvidencePacket(original);
 assert.deepEqual(original,prior);
});

test('canonical digest is stable for same source',()=>{
 const a=validateFisreReport(sample()).reportDigest;
 const b=validateFisreReport(clone(sample())).reportDigest;
 assert.equal(a,b);
 assert.equal(a.length,64);
});

test('distinct proof statuses yield different digests',()=>{
 assert.notEqual(validateFisreReport(sample()).reportDigest,
  validateFisreReport(sample('COUNTEREXAMPLE_FOUND')).reportDigest);
});

test('reject false source-execution boundaries',()=>{
 const a=sample();a.source_executed=true;
 assert.throws(()=>validateFisreReport(a),/IDENTITY_OR_BOUNDARY_INVALID/);
});

test('reject tool authority grants',()=>{
 const a=sample();a.tool_authority_granted=true;
 assert.throws(()=>validateFisreReport(a),/IDENTITY_OR_BOUNDARY_INVALID/);
});

test('reject forged external tool executions',()=>{
 const a=sample();a.external_actions=1;
 assert.throws(()=>validateFisreReport(a),/IDENTITY_OR_BOUNDARY_INVALID/);
});

test('reject inconsistent PROVED status with witness',()=>{
 const a=sample('COUNTEREXAMPLE_FOUND');a.status='PROVED';
 assert.throws(()=>validateFisreReport(a),/INCONSISTENT_PROVED/);
});

test('reject missing witness in counterexample',()=>{
 const a=sample('COUNTEREXAMPLE_FOUND');delete a.division_checks[0].witness;
 assert.throws(()=>validateFisreReport(a),/REPORT_WITNESS_INVALID/);
});

test('reject wrong source digest',()=>{
 const a=sample();a.source_sha256='short';
 assert.throws(()=>validateFisreReport(a),/IDENTITY_OR_BOUNDARY_INVALID/);
});

test('reject oversized data',()=>{
 const a=sample();a.extra='z'.repeat(65536);
 assert.throws(()=>validateFisreReport(a),/REPORT_TOO_LARGE/);
});

test('reject bad domain bounds',()=>{
 const a=sample();a.domain.margin.min='cat';
 assert.throws(()=>validateFisreReport(a),/REPORT_DOMAIN_INVALID/);
});

test('no kernel mutation if validation fails',()=>{
 let calls=0;const kernel={propose(){calls++;throw Error('SHOULD_NOT_RUN')},assess(){},exportSnapshot(){}};
 assert.throws(()=>createFisreEvidencePacket({...sample(),version:'forged'},{kernel}),/IDENTITY_OR_BOUNDARY_INVALID/);
 assert.equal(calls,0);
});

test('custom kernel with non-proposed status is rejected',()=>{
 const kernel={propose(){return {status:'supported'}},assess(){return {authority:'none',externalActions:0}},exportSnapshot(){return {}}};
 assert.throws(()=>createFisreEvidencePacket(sample(),{kernel}),/UNEXPECTED_PROMOTION/);
});

test('CLI stdin produces only proposal JSON',()=>{
 const runner=fileURLToPath(new URL('../scripts/Run-Fun-FISRE-Evidence-V3.mjs',import.meta.url));
 const proc=spawnSync(process.execPath,[runner],{input:JSON.stringify(sample()),encoding:'utf8',timeout:7000});
 assert.equal(proc.status,0,proc.stderr);
 const packet=JSON.parse(proc.stdout);
 assert.equal(packet.proposedClaim.status,'proposed');
 assert.equal(packet.reportExecuted,false);
 assert.equal(packet.authorityGranted,false);
});

test('CLI rejects malformed report safely',()=>{
 const runner=fileURLToPath(new URL('../scripts/Run-Fun-FISRE-Evidence-V3.mjs',import.meta.url));
 const proc=spawnSync(process.execPath,[runner],{input:'{"oops":',encoding:'utf8',timeout:7000});
 assert.equal(proc.status,2);
 assert.equal(JSON.parse(proc.stderr).state,'HOLD');
});
