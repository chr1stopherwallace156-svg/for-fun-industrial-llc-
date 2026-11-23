// Offline standard-input JSON -> proposed cognition packet. No filesystem or network I/O.
import {createFisreEvidencePacket} from '../src/cognition/fisre-evidence-v3.mjs';
const MAX_INPUT_BYTES=65536;
async function main(){
 let chunks=[],total=0;
 for await (const chunk of process.stdin){
  total+=chunk.length;
  if(total>MAX_INPUT_BYTES)throw Error('FISRE_V3_HOLD_STDIN_TOO_LARGE');
  chunks.push(chunk);
 }
 if(total===0)throw Error('FISRE_V3_HOLD_EMPTY_INPUT');
 let report;
 try{report=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 catch{throw Error('FISRE_V3_HOLD_INVALID_JSON')}
 const packet=createFisreEvidencePacket(report);
 process.stdout.write(JSON.stringify(packet,null,2)+'\n');
}
main().catch(e=>{
 process.stderr.write(JSON.stringify({version:'fi-fisre-evidence-bridge-v3',state:'HOLD',reason:String(e.message).slice(0,180),actionsExecuted:0})+'\n');
 process.exitCode=2;
});
