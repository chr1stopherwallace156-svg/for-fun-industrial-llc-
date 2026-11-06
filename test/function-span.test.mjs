import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCodeContext} from '../src/code-context.mjs';

async function fixture(fn){
  const dir=await mkdtemp(path.join(tmpdir(),'fi-function-span-'));
  try{
    await mkdir(path.join(dir,'src'));
    const source=[
      'export function selectCapabilities(query,tools=[]) {',
      ' const selected=[];',
      ' for(const tool of tools){',
      '  if(!tool.enabled)continue;',
      '  if(tool.score>5)selected.push(tool.name);',
      ' }',
      ' return {tools:selected,approval_required:true};',
      '}',
      'export function unrelated() { return false; }'
    ].join('\n')+'\n';
    await writeFile(path.join(dir,'src','unified-agent.mjs'),source);
    await writeFile(path.join(dir,'helper.mjs'),'export function other() { return true; }\n');
    return await fn(dir,source);
  }finally{await rm(dir,{recursive:true,force:true})}
}

test('complete named function is contiguous, has line evidence, and excludes unrelated files',()=>fixture(async dir=>{
 const result=await buildCodeContext(dir,'Explain the selectCapabilities function in src/unified-agent.mjs',{maxChars:2300});
 assert.deepEqual(result.files,['src/unified-agent.mjs']);
 assert.equal(result.focus_symbol,'selectCapabilities');
 assert.equal(result.source_span_complete,true);
 assert.match(result.context,/1: export function selectCapabilities/);
 assert.match(result.context,/7:  return \{tools:selected,approval_required:true\};/);
 assert.match(result.context,/8: \}/);
 assert.doesNotMatch(result.context,/unrelated\(\)/);
}));
test('budget cannot silently present a truncated function as complete',()=>fixture(async dir=>{
 const result=await buildCodeContext(dir,'Explain selectCapabilities function in src/unified-agent.mjs',{maxChars:180});
 assert.equal(result.focus_symbol,'selectCapabilities');
 assert.equal(result.source_span_complete,false);
 assert.match(result.context,/INCOMPLETE/);
 assert.ok(result.context.length<=180);
}));
test('nonexisting named function never reports a complete source span',()=>fixture(async dir=>{
 const result=await buildCodeContext(dir,'Explain the nonexistentCapability function in src/unified-agent.mjs',{maxChars:2300});
 assert.notEqual(result.source_span_complete,true);
 assert.equal(result.focus_symbol,undefined);
}));
test('regular source queries still work without an explicit function symbol',()=>fixture(async dir=>{
 const result=await buildCodeContext(dir,'Inspect source code in src/unified-agent.mjs',{maxChars:2300});
 assert.ok(result.files.includes('src/unified-agent.mjs'));
 assert.ok(result.context.length<=2300);
}));

test('real selectCapabilities implementation is fully captured within the live 2300-char budget',async()=>{
 const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const result=await buildCodeContext(repoRoot,'Explain the selectCapabilities function in src/unified-agent.mjs',{maxChars:2300,maxFiles:140});
 assert.equal(result.focus_symbol,'selectCapabilities');
 assert.equal(result.source_span_complete,true);
 assert.deepEqual(result.files,['src/unified-agent.mjs']);
 assert.match(result.context,/scoreTool\(query,def\)/);
 assert.match(result.context,/return \{tools:selected\.slice\(0,2\)/);
 assert.ok(result.context.length<=2300);
});
