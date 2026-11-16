// Independent loopback-only preview. Inert on import. No existing services modified.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {buildGraph,SPATIAL_VERSION} from './graph.mjs';
import {observeSpatialV3} from './observer.mjs';
const ROOT=fileURLToPath(new URL('./',import.meta.url));
const FILES=Object.freeze({
 '/':'index.html',
 '/assets/spatial-v3.css':'spatial-v3.css',
 '/assets/spatial-v3.js':'spatial-v3.js'
});
export const HOST='127.0.0.1',PORT=8808;
const ALLOWED_HOSTS=new Set(['127.0.0.1:8808','localhost:8808','127.0.0.1:18808','localhost:18808']);
function reply(req,res,status,body,type='text/plain; charset=utf-8',headers={}){
 const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));
 res.writeHead(status,{
  'content-type':type,'content-length':bytes.byteLength,'cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'x-fi-spatial-v3':SPATIAL_VERSION,
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  ...headers
 });
 if(req.method==='HEAD')res.end();else res.end(bytes)
}
export function createSpatialPreview({observer=observeSpatialV3,files=readFile}={}){
 return http.createServer(async(req,res)=>{
  try{
   if(!ALLOWED_HOSTS.has(String(req.headers.host||'').toLowerCase()))
    return reply(req,res,403,{error:'SPATIAL_HOST_DENIED'},'application/json');
   if(!['GET','HEAD'].includes(req.method))
    return reply(req,res,405,{error:'SPATIAL_READ_ONLY_GET_ONLY'},'application/json',{'allow':'GET, HEAD'});
   const target=String(req.url||'');
   if(!target.startsWith('/')||target.startsWith('//')||target.includes('\\')||
      target.includes('%')||target.includes('?')||target.includes('#')||target.includes('..')||target.length>120)
    return reply(req,res,400,{error:'SPATIAL_PATH_REJECTED'},'application/json');
   if(target==='/api/spatial-v3/status'){
    if(req.method==='HEAD')return reply(req,res,200,'','application/json');
    const report=await observer();
    if(report.version!==SPATIAL_VERSION||report.read_only!==true||report.external_actions!==0||
       report.tools_called!==0||report.model_calls!==0||!Array.isArray(report.nodes)||!Array.isArray(report.links))
      throw Error('SPATIAL_OBSERVATION_SCHEMA_INVALID');
    return reply(req,res,200,report,'application/json; charset=utf-8')
   }
   if(target==='/api/spatial-v3/topology'){
    return reply(req,res,200,buildGraph(),'application/json; charset=utf-8')
   }
   let filename=null,type=null;
   if(Object.hasOwn(FILES,target)){
    filename=join(ROOT,FILES[target]);
    type=target.endsWith('.css')?'text/css; charset=utf-8':target.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8';
   }else return reply(req,res,404,{error:'SPATIAL_ROUTE_NOT_FOUND'},'application/json');
   const meta=await stat(filename);
   if(!meta.isFile()||meta.size>8*1024*1024)throw Error('SPATIAL_ASSET_INVALID_SIZE');
   const data=await files(filename);
   if(data.byteLength>8*1024*1024)throw Error('SPATIAL_ASSET_TOO_LARGE');
   return reply(req,res,200,data.toString(),type)
  }catch(error){return reply(req,res,503,{error:'SPATIAL_PREVIEW_HOLD'},'application/json')}
 })
}
if(process.argv.includes('--serve')){
 const s=createSpatialPreview();
 s.listen(PORT,HOST,()=>console.log('FUN_SPATIAL_V31_IMMERSIVE=LISTENING http://'+HOST+':'+PORT+'/ READ_ONLY=true'));
 const stop=()=>s.close(()=>process.exit(0));
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
}
