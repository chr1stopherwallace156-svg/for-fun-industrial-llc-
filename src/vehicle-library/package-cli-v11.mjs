import {buildEngineeringPackage} from './package-v11.mjs';
const args={};const words=process.argv.slice(2);for(let i=0;i<words.length;i+=2){if(!words[i]?.startsWith('--')||words[i+1]===undefined)throw Error('USAGE: --key value');args[words[i].slice(2)]=words[i+1];}
try{const result=buildEngineeringPackage({root:args.root,vehicle:args.vehicle||'F-450',year:Number(args.year||2026),id:args.id,output:args.output});console.log(JSON.stringify(result,null,2));console.log('FUN_V11=PACKAGE_CREATED_ENGINEERING_HOLD');}catch(e){console.error('FUN_V11_HOLD='+e.message);process.exitCode=1;}
