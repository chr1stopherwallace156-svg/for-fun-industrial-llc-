// Run: node src/cognition/demo.mjs
import { CognitiveKernel } from "./kernel.mjs";
const brain=new CognitiveKernel();
const facts=[
  ["sparrow","is_a","bird","what"],
  ["bird","is_a","animal","what"],
  ["motor","requires","electricity","how"],
  ["motor","located_in","vehicle","where"],
  ["engineer","inspects","motor","who"],
  ["inspection","before","repair","when"],
  ["overheating","may_cause","damage","why"]
];
for(const [subject,predicate,object,question] of facts){
  const f=brain.propose({subject,predicate,object,question,source:"synthetic-demo"});
  brain.check({claimId:f.id,observed:object,evidenceRef:"demo-observation-"+f.id,method:"test_result"});
}
const inference=brain.infer({subject:"sparrow",predicate:"is_a",object:"animal"});
const prediction=brain.predict({subject:"motor",predicate:"operates_with_power",expected:"yes"});
brain.resolvePrediction({predictionId:prediction.id,observed:"no",evidenceRef:"synthetic-power-off-test"});
console.log(JSON.stringify({inference,assessment:brain.assess()},null,2));
