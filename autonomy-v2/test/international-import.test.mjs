import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {csvRows,readIntake,importIntake} from "../Import-International.mjs";
test("CSV parser handles quoted comma, Unicode and newlines and rejects unknown columns",()=>{
 const csv='sourceId,externalId,title,url,priceLocal,city\nJP_KSI,abc,"Toyota, warehouse forklifts",https://kankocho.jp/a/1,10000,Yokohama\nVN_MOJ,v1,"Lô hàng,\n10 kiện",https://dgts.moj.gov.vn/items/1,,Hanoi\n';
 const rows=csvRows(csv);assert.equal(rows.length,2);assert.match(rows[0].title,/Toyota, warehouse/);assert.match(rows[1].title,/\n/);
 assert.throws(()=>csvRows('sourceId,externalId,title,url,password\n'),/HEADER_NOT_APPROVED/);
 assert.throws(()=>csvRows('sourceId,externalId,title,url\nJP_KSI,11,"badquote,https://kankocho.jp/foo'),/UNCLOSED_QUOTE/);
});
test("international import reads JSON/CSV and merges without persisting test artifacts",()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),"fi-intl-"));
 try{
  const a=path.join(d,"a.csv"),b=path.join(d,"b.json");
  fs.writeFileSync(a,'sourceId,externalId,title,url,priceLocal\nJP_KSI,J001,Used industrial lathe,https://kankocho.jp/lot/1,180000\n');
  const first=readIntake(a);assert.equal(first.count,1);
  fs.writeFileSync(b,JSON.stringify([{sourceId:"KR_ONBID_MOVABLE",externalId:"K001",title:"한국 기계",url:"https://www.onbid.co.kr/lot/2",priceLocal:90000}]));
  const combined=importIntake(b,{persist:false,existing:first});
  assert.equal(combined.total,2);assert.equal(combined.countries.JP,1);assert.equal(combined.countries.KR,1);assert.equal(combined.persisted,false);
  assert.throws(()=>readIntake("relative.csv"),/ABSOLUTE_IMPORT_PATH_REQUIRED/);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
});
