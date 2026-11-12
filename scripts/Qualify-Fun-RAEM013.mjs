// RAEM-013: synthetic offline end-to-end approved local source check.
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {LocalAilSourceRegistry} from '../src/integrations/ail-source-registry.mjs';
const dir=await mkdtemp(join(tmpdir(),'raem013-')),file=join(dir,'synthetic.jsonl');
const rows=[{id:'submitted/2026/11/12/one.gz',date:'20261112',tags:['infoleak:sample']},
{id:'submitted/2026/11/12/two.gz',date:'20261112',tags:['tlp:green']},
{id:'submitted/2026/11/12/one.gz',date:'20261112',tags:['infoleak:sample']}];
try{
 const body=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
 await writeFile(file,body,{flag:'wx'});
 const registry=new LocalAilSourceRegistry();
 registry.register({id:'synthetic_ail',path:file,expectedSha256:createHash('sha256').update(body).digest('hex')});
 const denied=await registry.inspect('synthetic_ail');
 const allowed=await registry.inspect('synthetic_ail',{operatorApproved:true,maxProcessRssMiB:512});
 const ok=denied.reason==='OPERATOR_APPROVAL_REQUIRED'&&allowed.state==='PASS'&&allowed.records===3&&allowed.unique===2&&allowed.duplicates===1&&allowed.tagNamespaceCounts.infoleak===1&&allowed.tagNamespaceCounts.tlp===1;
 console.log('RAEM_013_DENIED='+JSON.stringify(denied));
 console.log('RAEM_013_SYNTHETIC='+JSON.stringify(allowed));
 console.log('RAEM_013_QUALIFICATION='+(ok?'PASS':'FAIL'));
 if(!ok)process.exitCode=1;
}finally{
 await rm(dir,{recursive:true,force:true});
 console.log('RAEM_013_END=TEMP_CLEANUP_NO_LIVE_AIL_NO_NETWORK_NO_BACKGROUND_WORK_NO_SERVICE_CHANGES');
}
