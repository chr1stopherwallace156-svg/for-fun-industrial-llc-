// FI_QWEN_REA_DIRECT_PILOT_CLI_V1
// One explicit --run on live 8797, with Qwen3 thinking disabled and real MCP.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {runDirectReaPilot} from '../src/experimental/rea-qwen-direct-pilot.mjs';
const argv=process.argv.slice(2);
const index=argv.indexOf('--prompt');
const requested=argv.includes('--run');
if(!requested){
 console.log('QWEN_REA_DIAGNOSTIC=INACTIVE. Use --run --prompt "..." for one operator-started read-only pilot.');
}else if(index<0||!argv[index+1]||argv.filter(x=>x==='--run').length!==1){
 console.error('QWEN_REA_DIAGNOSTIC=HOLD MISSING_EXPLICIT_PROMPT');
 process.exitCode=1;
}else{
 try{
  const result=await runDirectReaPilot({prompt:argv[index+1],log:message=>console.log(message)});
  console.log('QWEN_REA_PILOT_STATE='+result.state);
  console.log('QWEN_REA_PILOT_EXECUTED='+result.actions.length);
  for(const action of result.actions){
   console.log('REAL_REA_TOOL='+action.tool);
   console.log('REAL_REA_RESULT='+JSON.stringify(action.result).slice(0,8000));
  }
  console.log('QWEN_REA_ANSWER='+String(result.reply||'').slice(0,2400));
  if(!result.actions.length)process.exitCode=2;
 }catch(error){
  console.error('QWEN_REA_PILOT_HOLD='+String(error.message||error));
  process.exitCode=1;
 }
}
