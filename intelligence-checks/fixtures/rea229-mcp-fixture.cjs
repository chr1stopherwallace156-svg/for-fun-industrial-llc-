// Independent synthetic MCP fixture, no external network/OS tool calls.
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
const tools=Array.from({length:229},(_,i)=>({
 name:'rea_fixture_'+String(i).padStart(3,'0'),
 description:'Synthetic MCP tool '+i,
 inputSchema:{type:'object',properties:{message:{type:'string'}},required:[]}
}));
function respond(message){
 if(message.id===undefined)return;
 let result;
 if(message.method==='initialize'){
  result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'rea-fixture-229',version:'1.0'}};
 }else if(message.method==='tools/list'){
  result={tools};
 }else if(message.method==='tools/call'){
  const name=message.params?.name;
  if(!tools.find(x=>x.name===name)){
   process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32602,message:'Unknown tool'}})+'\n');
   return;
  }
  result={content:[{type:'text',text:'SIMULATED '+name+' '+JSON.stringify(message.params.arguments||{})}],isError:false};
 }else{
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unknown MCP method'}})+'\n');
  return;
 }
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\n');
}
rl.on('line',line=>{try{respond(JSON.parse(line))}catch{}});
