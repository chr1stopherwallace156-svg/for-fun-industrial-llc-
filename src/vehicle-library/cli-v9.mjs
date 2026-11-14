import {init,register,importSource,attachArtifact,graph,inspect} from './v9.mjs';
const [action,...argv]=process.argv.slice(2);
const options={};
for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)throw Error('USAGE: --key value');options[argv[i].slice(2)]=argv[i+1];}
const args={root:options.root,vehicle:options.vehicle,year:options.year?Number(options.year):2026,id:options.id,file:options.file,cab:options.cab,wheelbase:options.wheelbase,kind:options.kind,sourceUrl:options.url,sourceIds:options.sources?options.sources.split(','):[]};
try{
  const actions={init:()=>init(args),register:()=>register(args),import:()=>importSource(args),attach:()=>attachArtifact(args),graph:()=>graph(args),inspect:()=>inspect(args)};
  if(!actions[action])throw Error('ACTIONS: init | register | import | attach | graph | inspect');
  console.log(JSON.stringify(actions[action](),null,2));
}catch(error){console.error('FUN_V9_HOLD='+error.message);process.exitCode=1;}
