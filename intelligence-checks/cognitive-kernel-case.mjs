import test from "node:test";
import assert from "node:assert/strict";
import { CognitiveKernel, cognitiveQuestions } from "../src/cognition/kernel.mjs";

const add = (k,subject,predicate,object,question="what") => {
  const f = k.propose({subject,predicate,object,question,source:"synthetic-fixture"});
  k.check({claimId:f.id,observed:object,evidenceRef:"fixture-"+f.id,method:"test_result"});
  return f.id;
};

test("six questions are supported by structured knowledge (no model required)",()=>{
  const k=new CognitiveKernel();
  for(const q of cognitiveQuestions) add(k,"motor","answers_"+q,q+"_answer",q);
  assert.deepEqual(new Set(k.assess().questionsCovered), new Set(["who","what","why","how","where","when"]));
  assert.equal(k.query({question:"why"}).length,1);
});

test("unverified claims stay out of default queries; observed contradictions are retained",()=>{
  const k=new CognitiveKernel();
  const f=k.propose({subject:"motor",predicate:"requires",object:"electricity",source:"teacher"});
  assert.equal(k.query({subject:"motor"}).length,0);
  const first=k.check({claimId:f.id,observed:"electricity",evidenceRef:"measurement-01",method:"measurement"});
  assert.equal(first.claim.status,"supported");
  const second=k.check({claimId:f.id,observed:"steam",evidenceRef:"measurement-02",method:"measurement"});
  assert.equal(second.conflictingEvidence,true);
  assert.equal(second.claim.status,"proposed");
  assert.equal(k.query({subject:"motor"}).length,0);
  assert.deepEqual(k.assess().conflictingClaims,[f.id]);
});

test("refuted facts stay visible as refuted when requested",()=>{
  const k=new CognitiveKernel();
  const f=k.propose({subject:"gate",predicate:"state",object:"closed",source:"model"});
  const r=k.check({claimId:f.id,observed:"open",evidenceRef:"sensor-1",method:"measurement"});
  assert.equal(r.claim.status,"refuted");
  assert.equal(k.query({subject:"gate"}).length,0);
  assert.equal(k.query({subject:"gate",includeUnverified:true})[0].status,"refuted");
});

test("only supported explicitly transitive relationships infer; causal claims do not",()=>{
  const k=new CognitiveKernel();
  add(k,"sparrow","is_a","bird");add(k,"bird","is_a","animal");
  assert.equal(k.infer({subject:"sparrow",predicate:"is_a",object:"animal"}).supported,true);
  assert.equal(k.infer({subject:"sparrow",predicate:"is_a",object:"vehicle"}).supported,false);
  add(k,"rain","causes","wet_ground");add(k,"wet_ground","causes","plants_grow");
  assert.equal(k.infer({subject:"rain",predicate:"causes",object:"plants_grow"}).reason,"NOT_TRANSITIVE");
});

test("prediction failure is measured, survives in evidence and cannot be overwritten",()=>{
  const k=new CognitiveKernel();
  const id=add(k,"gate","must_be","closed","how");
  const p=k.predict({subject:"machine",predicate:"activates",expected:"yes",basedOn:[id],confidence:0.7});
  assert.equal(k.assess().predictions.accuracy,null);
  const result=k.resolvePrediction({predictionId:p.id,observed:"no",evidenceRef:"test-run-001"});
  assert.equal(result.correct,false);
  assert.equal(k.assess().predictions.accuracy,0);
  assert.equal(k.assess().predictions.failures[0].evidenceRef,"test-run-001");
  assert.throws(()=>k.resolvePrediction({predictionId:p.id,observed:"yes",evidenceRef:"test-run-002"}),/ALREADY_RESOLVED/);
});

test("failed experiences can form bounded correction proposals but not instant truth",()=>{
  const k=new CognitiveKernel();
  const p=k.predict({subject:"gate",predicate:"state",expected:"closed"});
  assert.throws(()=>k.proposeCorrection({predictionId:p.id}),/NO_FAILED_OUTCOME/);
  k.resolvePrediction({predictionId:p.id,observed:"open",evidenceRef:"sensor-2"});
  const c=k.proposeCorrection({predictionId:p.id});
  assert.equal(c.proposal.object,"open");
  assert.equal(c.proposal.status,"proposed");
  assert.equal(c.verified,false);
  assert.equal(k.query({subject:"gate"}).length,0);
  assert.throws(()=>k.proposeCorrection({predictionId:p.id}),/ALREADY_PROPOSED/);
});

test("invalid, oversized, arbitrary data and unsupported evidence are rejected",()=>{
  const k=new CognitiveKernel({maxClaims:1,maxPredictions:1});
  assert.throws(()=>k.propose({subject:"a",predicate:"b",object:"c",source:"x",question:"execute"}),/CLAIM_INVALID/);
  assert.throws(()=>k.propose({subject:"a",predicate:"b",object:"\u0000",source:"x"}),/CLAIM_INVALID/);
  const f=k.propose({subject:"a",predicate:"b",object:"c",source:"x"});
  assert.throws(()=>k.propose({subject:"a",predicate:"b",object:"c",source:"x"}),/CLAIM_LIMIT/);
  assert.throws(()=>k.check({claimId:f.id,observed:"c",evidenceRef:"x",method:"LLM_says_so"}),/CHECK_INVALID/);
  assert.throws(()=>k.predict({subject:"a",predicate:"b",expected:"c",basedOn:[f.id]}),/PREDICTION_INVALID/);
  assert.equal(k.assess().externalActions,0);
});

test("copy-isolated snapshots cannot mutate internal cognition",()=>{
  const k=new CognitiveKernel();
  add(k,"engine","part_of","vehicle");
  const snapshot=k.exportSnapshot();
  snapshot.claims[0].status="refuted";
  assert.equal(k.query({subject:"engine"})[0].status,"supported");
});
