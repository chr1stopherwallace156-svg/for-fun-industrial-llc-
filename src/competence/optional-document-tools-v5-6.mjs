// Optional on-demand document and language tool adapters. No download or install.
// Use Docling only with explicit local file and operator invocation; Vale only
// with existing executable. No background model, URL download or code writes.
import {stat,lstat,readFile} from 'node:fs/promises';
import {resolve,isAbsolute,extname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const MAX_FILE=16*1024*1024;
export const ADAPTER_VERSION='fial5.6-optional-adapters-v1';
function safeFile(file,extensions){
 if(typeof file!=='string'||!isAbsolute(file)||file.includes('\0')||
  !extensions.includes(extname(file).toLowerCase()))throw Error('FIAL56_FILE_PATH_OR_EXTENSION_REFUSED');
 return resolve(file);
}
async function check(file,extensions){
 const name=safeFile(file,extensions);
 const link=await lstat(name);
 if(link.isSymbolicLink()||!link.isFile())throw Error('FIAL56_FILE_SYMLINK_OR_TYPE_REFUSED');
 const meta=await stat(name);
 if(meta.size===0||meta.size>MAX_FILE)throw Error('FIAL56_FILE_SIZE_INVALID');
 return name;
}
export async function inspectBusinessDocument(file,{python='python.exe'}={}){
 const name=await check(file,['.pdf','.docx','.pptx','.xlsx','.md']);
 if(name.toLowerCase().endsWith('.md')){
  const text=await readFile(name,'utf8');
  if(text.length>30000)throw Error('FIAL56_TEXT_EXTRACTION_BUDGET');
  return {version:ADAPTER_VERSION,state:'LOCAL_MARKDOWN_READ',text,
   source_name:name,source_is_untrusted:true,external_actions:0};
 }
 if(typeof python!=='string'||!/^(?:[a-z]:\\[^"*?|<>]+|python(?:\.exe)?)$/i.test(python))
  throw Error('FIAL56_PYTHON_EXECUTABLE_INVALID');
 const source=[
  'import sys',
  'try:',
  ' from docling.document_converter import DocumentConverter',
  'except ImportError:',
  ' print("DOCLING_NOT_INSTALLED",file=sys.stderr);sys.exit(42)',
  'doc=DocumentConverter().convert(sys.argv[1]).document',
  'text=doc.export_to_markdown()',
  'if len(text)>30000:',
  ' print("DOCLING_TEXT_TOO_LONG",file=sys.stderr);sys.exit(43)',
  'sys.stdout.write(text)'
 ].join('\n');
 try{
  const {stdout}=await run(python,['-c',source,name],{
   windowsHide:true,timeout:90000,maxBuffer:100000,env:{...process.env,PYTHONNOUSERSITE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});
  if(!stdout.trim())throw Error('FIAL56_DOCUMENT_EMPTY');
  return {version:ADAPTER_VERSION,state:'DOCLING_EXTRACTED_LOCAL_DOCUMENT',text:stdout.slice(0,30000),
   source_name:name,source_is_untrusted:true,external_actions:0};
 }catch(e){
  if(e.code===42||e.code==='ENOENT'||String(e.stderr||'').includes('DOCLING_NOT_INSTALLED'))
   return {version:ADAPTER_VERSION,state:'HOLD_DOCLING_NOT_INSTALLED',
    text:null,source_name:name,source_is_untrusted:true,external_actions:0};
  return {version:ADAPTER_VERSION,state:'HOLD_DOCUMENT_EXTRACTION',reason:String(e.message||e).slice(0,150),
   text:null,source_name:name,source_is_untrusted:true,external_actions:0};
 }
}
export async function runValeCheck(file,{executable='vale'}={}){
 const name=await check(file,['.md','.txt']);
 if(typeof executable!=='string'||!/^(?:[a-z]:\\[^"*?|<>]+|vale(?:\.exe)?)$/i.test(executable))
  throw Error('FIAL56_VALE_EXECUTABLE_INVALID');
 try{
  const {stdout}=await run(executable,['--output=JSON','--no-exit',name],
   {windowsHide:true,timeout:12000,maxBuffer:90000});
  const parsed=JSON.parse(stdout||'{}');
  const entries=Array.isArray(parsed[name])?parsed[name]:[];
  return {version:ADAPTER_VERSION,state:'VALE_LOCAL_REVIEW_COMPLETE',
   source_name:name,alerts:entries.slice(0,40).map(x=>({
    severity:String(x.Severity||'').slice(0,30),
    message:String(x.Message||'').slice(0,220),line:Number(x.Line||0)})),
   file_modified:false,external_actions:0};
 }catch(e){
  const missing=e.code==='ENOENT';
  return {version:ADAPTER_VERSION,state:missing?'HOLD_VALE_NOT_INSTALLED':'HOLD_VALE_NOT_CONFIGURED_OR_FAILED',
   source_name:name,reason:String(e.message||e).slice(0,130),file_modified:false,external_actions:0};
 }
}
