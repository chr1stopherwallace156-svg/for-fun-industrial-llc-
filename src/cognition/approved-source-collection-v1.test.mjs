import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {retrieveApprovedPage} from "./approved-single-page-retrieval-v1.mjs";
import {collectApprovedSource} from "./approved-collection-bridge-v1.mjs";

test("unapproved collection cannot reach DNS or HTTP",async()=>{
 await assert.rejects(retrieveApprovedPage({url:"https://example.org/",operatorApproved:false}),/OPERATOR_APPROVAL_REQUIRED/);
 await assert.rejects(collectApprovedSource({url:"https://example.org/",operatorApproved:false}),/OPERATOR_APPROVAL_REQUIRED/);
});
test("invalid schemes, IP literals and local hosts are rejected before network",async()=>{
 for(const url of ["file:///etc/passwd","ftp://example.org/file","http://127.0.0.1:8789/","http://localhost/","https://[::1]/","http://10.0.0.1/","http://example.org:18798/"]){
  await assert.rejects(retrieveApprovedPage({url,operatorApproved:true}),/(URL_NOT_ALLOWED|IP_OR_LOCALHOST_NOT_ALLOWED)/,url);
 }
});
test("credentials and fragments do not enter the source collector",async()=>{
 for(const url of ["https://user:pass@example.org/","https://example.org/#fragment"]){
  await assert.rejects(retrieveApprovedPage({url,operatorApproved:true}),/URL_NOT_ALLOWED/);
 }
});
test("dashboard enforces deliberate approval and reuses the grounded route",()=>{
 const server=readFileSync(new URL("../server.mjs",import.meta.url),"utf8");
 const page=readFileSync(new URL("../../public/index.html",import.meta.url),"utf8");
 for(const text of ['/api/research/collect-source','x-fi-source-approval','localRequest(req,res)','requireVpnGate(res)','/api/research/grounded-answer'])assert.ok(server.includes(text),text);
 for(const text of ['fiApproveCollectSource','fiSelectedSourceUrl','fiGroundedClaim','operator-approved-single-page'])assert.ok(page.includes(text),text);
});
