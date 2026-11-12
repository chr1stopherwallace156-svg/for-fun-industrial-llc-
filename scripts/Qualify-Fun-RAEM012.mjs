// RAEM-012: one-shot synthetic AIL-format metadata export test; no live AIL or provider call.
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildAilMetadataRequest} from '../src/integrations/ail-metadata.mjs';
import {analyzeAilMetadataFile} from '../src/integrations/ail-ndjson.mjs';
const dir=await mkdtemp(join(tmpdir(),'raem012-'));
const file=join(dir,'metadata.jsonl');
const item=(name,date,tags)=>({id:'submitted/2026/11/12/'+name+'.gz',date,tags});
const rows=[
 item('synthetic-one','20261112',['infoleak:automatic-detection="sample"','misp-galaxy:threat="sample"']),
 item('synthetic-two','20261112',['infoleak:submission="manual"']),
 item('synthetic-one','20261112',['infoleak:automatic-detection="sample"']),
 item('synthetic-three','20261111',[])
];
try{
 await writeFile(file,rows.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
 const request=buildAilMetadataRequest(rows[0].id);
 const report=await analyzeAilMetadataFile(file,{maxProcessRssMiB:512,minimumHostFreeMiB:0});
 const passed=request.method==='POST'&&request.body.content===false&&request.path==='/api/v1/get/item'&&
  report.state==='PASS'&&report.records===4&&report.unique===3&&report.duplicates===1&&
  report.tagNamespaceCounts.infoleak===2&&report.tagNamespaceCounts['misp-galaxy']===1&&
  report.monthCounts['202611']===3&&!JSON.stringify(report).includes('synthetic-one');
 console.log('RAEM_012_REQUEST_SHAPE='+JSON.stringify(request));
 console.log('RAEM_012_SYNTHETIC_SUMMARY='+JSON.stringify(report));
 console.log('RAEM_012_QUALIFICATION='+(passed?'PASS':'FAIL'));
 if(!passed)process.exitCode=1;
}finally{
 await rm(dir,{recursive:true,force:true});
 console.log('RAEM_012_END=TEMP_CLEANUP_NO_LIVE_AIL_NO_HTTP_NO_BACKGROUND_WORK_NO_SERVICE_CHANGES');
}
