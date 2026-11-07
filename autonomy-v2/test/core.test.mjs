import {test} from "node:test";
import assert from "node:assert/strict";
import {checkGithubUrl,classifyRea,detectResearchChange,statusAssessment} from "../src/core.mjs";
test("allowlist requires exact GitHub release API endpoint",()=>{
 assert.equal(checkGithubUrl("https://api.github.com/repos/adafruit/circuitpython/releases/latest"),"https://api.github.com/repos/adafruit/circuitpython/releases/latest");
 for(const u of ["http://api.github.com/repos/a/b/releases/latest","https://api.github.com.evil.test/repos/a/b/releases/latest","https://api.github.com/repos/a/b/issues","https://127.0.0.1/secret","https://api.github.com/repos/a/b/releases/latest?foo=1"])assert.throws(()=>checkGithubUrl(u));
});
test("REA risky actions are flagged but no operation is authorized",()=>{
 assert.equal(classifyRea({name:"set_comment"}).requiresReview,true);
 assert.equal(classifyRea({name:"execute_rizin_command"}).requiresReview,true);
 assert.equal(classifyRea({name:"inspect_analysis_settings"}).requiresReview,false);
});
test("health requires a complete consistent registry",()=>{
 assert.equal(statusAssessment({tools:229,enabled:229,unified:"ready"}).ready,true);
 assert.equal(statusAssessment({tools:229,enabled:227,unified:"ready"}).ready,false);
});
test("research comparison detects changes",()=>{
 const a={tag:"v1",publishedAt:"2026-01-01"};
 assert.equal(detectResearchChange(a,a),false);
 assert.equal(detectResearchChange(a,{...a,tag:"v2"}),true);
});
