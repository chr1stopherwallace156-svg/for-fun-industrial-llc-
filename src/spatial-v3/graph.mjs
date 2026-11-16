// Read-only topology: known capabilities, not inferred process activity or authority.
export const SPATIAL_VERSION='fun-industrial-spatial-system-v3-preview-1';
export const NODES=Object.freeze([
 ['core','FUN INDUSTRIAL','core','The operator-controlled local system overview',null],
 ['ai','AI & MEMORY','branch','Local inference and bounded contextual recall',null],
 ['qwen','Qwen','ai','Local Qwen model via the existing grounded chat', '#chat'],
 ['memory','Cognee memory','ai','Contextual, read-only memory availability', '#chat'],
 ['tools','TOOLS & REA','branch','Discovery and review; execution requires operator authorization',null],
 ['rea','REA catalog','tools','Independent REA tool discovery, not tool execution','#tools'],
 ['review','Approval boundary','tools','Every external action requires separate operator approval','#tools'],
 ['compute','COMPUTE & ML','branch','Local compute and explicitly authorized analysis',null],
 ['compute-engine','Compute runtime','compute','Python graph, tensor and neural service',null],
 ['ml','Machine learning','compute','Read-only ML readiness; training needs approval','#ml'],
 ['business','BUSINESS','branch','Source-linked research, not confirmed orders or sales',null],
 ['buyers','Fleet buyers','business','Public buyer evidence without assumed orders','#buyers'],
 ['procurement','Procurement','business','Research-only public procurement evidence','#procurement'],
 ['regulatory','Regulatory','business','Dated regulation and economic intelligence','#regulatory'],
 ['commerce','Commerce','business','Research snapshots, not verified profit','#commerce'],
 ['voice','VOICE','branch','Authorized voice capture and analysis',null],
 ['mobile-voice','iPhone voice','voice','Existing authenticated mobile voice upload capability',null],
 ['security','SECURITY','branch','Network boundaries, truthful states and explicit approvals',null],
 ['localhost','Loopback services','security','Local-only application listeners; no public exposure',null],
 ['gateway','Private gateway','security','Separate private HTTPS gateway on the NetBird interface',null],
 ['authority','No autonomous actions','security','Observation cannot add permission or execute REA',null]
].map(([id,name,group,description,view])=>Object.freeze({id,name,group,description,view})));
export const LINKS=Object.freeze(NODES.filter(n=>n.id!=='core').map(n=>Object.freeze({
 source:n.group==='branch'?'core':n.group,target:n.id
})));
const VALID=new Set(['available','hold','unverified']);
export function buildGraph(evidence={}){
 const evidenceObject=evidence&&typeof evidence==='object'&&!Array.isArray(evidence)?evidence:{};
 return {version:SPATIAL_VERSION,read_only:true,external_actions:0,
  nodes:NODES.map(n=>({...n,state:VALID.has(evidenceObject[n.id])?evidenceObject[n.id]:'unverified'})),
  links:LINKS.map(l=>({...l}))};
}
