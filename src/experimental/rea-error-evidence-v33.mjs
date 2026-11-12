// FI_REA_ERROR_EVIDENCE_V33 — bounded, non-verbatim observation of an MCP isError.
// Never expose the provider's arbitrary raw text through HTTP or to a model.
// Untrusted error text could contain file paths, secrets, or prompt injection.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const classes=Object.freeze([
 ['access_denied',/permission denied|access denied|eacces|eperm/i],
 ['provider_unavailable',/provider.*(?:not installed|not available|missing|unavailable)|backend.*unavailable|backend.*not installed|missing (?:binary|provider|backend|plugin)/i],
 ['input_validation',/invalid (?:argument|parameter)|schema (?:error|validation)|required (?:field|property|argument)|unknown argument|unexpected (?:field|argument)/i],
 ['file_unavailable',/enoent|file not found|no such file|cannot open|failed to open|path does not exist|unable to read/i],
 ['format_not_supported',/unsupported (?:binary|format|file)|unrecognized (?:binary|format|image)|invalid (?:pe|elf|mach-o)/i],
 ['analysis_timeout',/timed out|timeout exceeded|analysis timeout/i]
]);
export function boundedMcpErrorEvidence(result){
 if(!result||result.isError!==true)throw Error('REA_ERROR_EVIDENCE_NOT_ISERROR');
 let raw;
 try{raw=JSON.stringify(result)}catch{throw Error('REA_ERROR_EVIDENCE_UNSERIALIZABLE')}
 if(typeof raw!=='string')throw Error('REA_ERROR_EVIDENCE_INVALID');
 // Full digest only for <=128KiB; otherwise declare a bounded prefix commitment.
 const max=131072,limited=raw.length>max,scoped=raw.slice(0,max);
 const texts=Array.isArray(result.content)?result.content
  .filter(x=>x&&x.type==='text'&&typeof x.text==='string')
  .slice(0,8).map(x=>x.text.slice(0,2000)):[];
 const joined=texts.join(' ').slice(0,6000);
 const match=classes.find(([_,re])=>re.test(joined));
 return Object.freeze({
  version:'fi-rea-mcp-error-evidence-v1',
  errorClass:match?.[0]??'unclassified_mcp_error',
  errorClassHeuristic:true,
  diagnosticTextExposed:false,
  errorTextPresent:texts.length>0,
  evidenceDigestSha256:sha(scoped),
  digestScope:limited?'first_131072_utf16_code_units':'complete_json_utf8',
  encodedJsonChars:raw.length,
  resultIsError:true,
  analysisSucceeded:false
 });
}
