const object=(properties,required=[])=>({type:"object",properties,required,additionalProperties:false});
const array=(items)=>({type:"array",items});
const number={type:"number"};
const string={type:"string"};
const integer={type:"integer"};
export const platformTools=[
 {name:"fi_graph_analyze",description:"Analyze a graph's connected components, density and degree centrality.",parameters:object({nodes:array(string),edges:array(array(string))},["nodes","edges"]),path:"/graph/analyze"},
 {name:"fi_tensor_contract",description:"Contract two compatible matrices using Quimb tensor-network contraction.",parameters:object({left:array(array(number)),right:array(array(number))},["left","right"]),path:"/tensor/matmul"},
 {name:"fi_compute_train",description:"Train the local CPU neural network on supplied features and targets.",parameters:object({features:array(array(number)),targets:array(array(number)),hidden_size:integer,epochs:integer,learning_rate:number},["features","targets"]),path:"/nn/train"},
 {name:"fi_compute_predict",description:"Run predictions with the currently trained local compute neural network.",parameters:object({features:array(array(number))},["features"]),path:"/nn/predict"},
 {name:"fi_hopfield_store",description:"Store bipolar patterns in a named classic Hopfield associative memory.",parameters:object({memory_id:string,units:integer,patterns:array(array(integer))},["memory_id","units","patterns"]),path:"/ai/hopfield/store"},
 {name:"fi_hopfield_recall",description:"Recall a stored pattern from a cue using classic Hopfield dynamics.",parameters:object({memory_id:string,cue:array(number),max_sweeps:integer},["memory_id","cue"]),path:"/ai/hopfield/recall"},
 {name:"fi_modern_hopfield_retrieve",description:"Retrieve a pattern using continuous modern Hopfield attention.",parameters:object({query:array(number),patterns:array(array(number)),beta:number},["query","patterns"]),path:"/ai/hopfield/modern-retrieve"},
 {name:"fi_universe_create",description:"Create an isolated neural/vector universe with its own vector dimension and memory namespace.",parameters:object({universe_id:string,vector_dimension:integer,description:string},["universe_id","vector_dimension"]),path:"/ai/universes"},
 {name:"fi_universe_add_vector",description:"Add a vector to one named universe's isolated vector index.",parameters:object({universe_id:string,vector_id:string,vector:array(number)},["universe_id","vector_id","vector"]),pathTemplate:"/ai/universes/{universe_id}/vectors"},
 {name:"fi_universe_search",description:"Search only one universe's exact cosine vector index.",parameters:object({universe_id:string,query:array(number),k:integer},["universe_id","query"]),pathTemplate:"/ai/universes/{universe_id}/search"},
 {name:"fi_universe_topology",description:"Return the exact cosine k-nearest-neighbour graph for one universe.",parameters:object({universe_id:string,neighbours:integer},["universe_id"]),pathTemplate:"/ai/universes/{universe_id}/topology",method:"GET"},
 {name:"fi_universe_add_bridge",description:"Create a directed, explicit memory-transfer bridge from source universe to target universe.",parameters:object({source:string,target:string},["source","target"]),path:"/ai/universes/bridges"},
 {name:"fi_universe_transfer_memory",description:"Transfer a memory only across an explicitly authorized directed universe bridge.",parameters:object({source:string,target:string,memory:object({})},["source","target","memory"]),path:"/ai/universes/transfer"},
 {name:"fi_universe_neural_train",description:"Train one universe's independent CPU neural model without sharing weights with other universes.",parameters:object({universe_id:string,features:array(array(number)),targets:array(array(number)),hidden_size:integer,epochs:integer,learning_rate:number},["universe_id","features","targets"]),pathTemplate:"/ai/universes/{universe_id}/neural/train"},
 {name:"fi_universe_neural_predict",description:"Predict using only the neural model trained inside the named universe.",parameters:object({universe_id:string,features:array(array(number))},["universe_id","features"]),pathTemplate:"/ai/universes/{universe_id}/neural/predict"},
 {name:"fi_universe_neural_state_set",description:"Set numeric state inside one universe's isolated neural-state namespace.",parameters:object({universe_id:string,key:string,values:array(number)},["universe_id","key","values"]),path:"/ai/universes/neural-state",method:"PUT"}
];
export function openAiToolDefinitions(reaTools=[]){
 const local=platformTools.map(({name,description,parameters})=>({type:"function",function:{name,description,parameters}}));
 const rea=reaTools.map(t=>({type:"function",function:{name:"rea__"+t.name,description:(t.description||"REA MCP tool; operator approval required").slice(0,1000),parameters:t.inputSchema||{type:"object",properties:{}}}}));
 return [...local,...rea].slice(0,32);
}
export function getPlatformTool(name){return platformTools.find(tool=>tool.name===name)||null;}
