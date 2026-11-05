import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
export function createReaAdapter(config){
 let child=null,reader=null,buffer=[],pending=new Map(),nextId=1,tools=[],serverInfo=null,stderr="";
 function send(message){if(!child||child.exitCode!==null)throw new Error("REA MCP process is not running");child.stdin.write(JSON.stringify(message)+"\n");}
 function request(method,params={},timeoutMs=15000){
  const id=nextId++;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(new Error("REA MCP request timed out: "+method));},timeoutMs);
   pending.set(id,{resolve,reject,timer});
   try{send({jsonrpc:"2.0",id,method,params});}catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
  });
 }
 async function listTools(){const collected=[];let cursor;for(let page=0;page<16;page++){const params=cursor?{cursor}:{};const listing=await request("tools/list",params,30000);const pageTools=Array.isArray(listing.tools)?listing.tools:[];collected.push(...pageTools);if(collected.length>256)throw new Error("REA tool catalogue exceeds the 256-tool safety limit");cursor=listing.nextCursor;if(!cursor)return collected;}throw new Error("REA tools/list pagination exceeded 16 pages");}
 async function start(){
  if(!config.enabled)return {state:"disabled",detail:"REA integration disabled by configuration."};
  if(child&&child.exitCode===null&&tools.length)return {state:"ready",detail:"REA MCP initialized; "+tools.length+" tools discovered."};
  const args=config.args||["mcp"];
  try{
   child=spawn(config.command,args,{shell:false,windowsHide:true,stdio:["pipe","pipe","pipe"]});
   child.stdout.setEncoding("utf8");
   reader=createInterface({input:child.stdout,crlfDelay:Infinity});
   reader.on("line",line=>{
    if(line.length>8_000_000)return;
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.id!==undefined&&pending.has(message.id)){
     const item=pending.get(message.id);pending.delete(message.id);clearTimeout(item.timer);
     if(message.error)item.reject(new Error(message.error.message||"REA MCP error"));else item.resolve(message.result);
    }
   });
   child.stderr.setEncoding("utf8");child.stderr.on("data",chunk=>{stderr=(stderr+chunk).slice(-8000);});
   child.on("error",error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();});
   child.on("exit",()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error("REA MCP process exited"));}pending.clear();tools=[];});
   const initialized=await request("initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"fun-industrial",version:"0.3.0"}},30000);
   serverInfo=initialized.serverInfo||null;
   send({jsonrpc:"2.0",method:"notifications/initialized",params:{}});
   tools=await listTools();
   return {state:"ready",detail:"MCP initialize/initialized and tools/list completed.",server:serverInfo,tool_count:tools.length};
  }catch(error){await stop();return {state:"failed",detail:error.message,stderr:stderr.slice(-2000)};}
 }
 async function stop(){
  if(reader){reader.close();reader=null;}
  if(child&&child.exitCode===null){const current=child;if(process.platform==="win32"){const killer=spawn("taskkill.exe",["/PID",String(current.pid),"/T","/F"],{shell:false,windowsHide:true,stdio:"ignore"});await Promise.race([new Promise(resolve=>killer.once("exit",resolve)),wait(5000)]);}else{current.kill("SIGTERM");}await Promise.race([new Promise(resolve=>current.once("exit",resolve)),wait(5000)]);if(current.exitCode===null)current.kill("SIGKILL");}
  child=null;tools=[];pending.clear();return {state:"stopped",detail:"REA MCP process stopped."};
 }
 async function health(){
  if(!config.enabled)return {state:"disabled",detail:"REA integration disabled."};
  if(child&&child.exitCode===null&&tools.length)return {state:"ready",detail:"MCP handshake complete; "+tools.length+" tools available.",server:serverInfo};
  return {state:"stopped",detail:"REA MCP server is not initialized."};
 }
 async function callTool(name,args={}){
  if(!(child&&child.exitCode===null&&tools.length))throw new Error("REA MCP is not ready");
  const tool=tools.find(item=>item.name===name);
  if(!tool)throw new Error("Tool is not in the current REA tools/list result");
  if(!args||typeof args!=="object"||Array.isArray(args))throw new Error("Tool arguments must be a JSON object");
  const result=await request("tools/call",{name,arguments:args},120000);
  return {tool:name,result};
 }
 return {id:"rea",name:"REA MCP",start,stop,health,tools:()=>tools.map(({name,description,inputSchema})=>({name,description,inputSchema})),callTool};
}
