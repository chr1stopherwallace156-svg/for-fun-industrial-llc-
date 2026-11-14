#!/usr/bin/env python3
"""V12K: deterministic candidate evidence graph from V12J; no semantic authority."""
import argparse,hashlib,json,re,sys
from pathlib import Path
from collections import Counter

def digest(data):return hashlib.sha256(data).hexdigest()
def clean(s):return re.sub(r"\s+"," ",str(s or "")).strip()
def stable(prefix,*parts):return prefix+":"+digest(json.dumps(parts,ensure_ascii=False,separators=(",",":")).encode())[:20]
def build(doc,max_nodes,max_edges):
 nodes={};edges={};stats=Counter()
 def node(kind,identity,**attrs):
  key=stable(kind,*identity)
  if key not in nodes:nodes[key]={"id":key,"kind":kind,**attrs}
  return key
 def edge(src,dst,relation,reason):
  key=stable("edge",src,dst,relation,reason)
  edges[key]={"id":key,"from":src,"to":dst,"relation":relation,
              "basis":reason,"verified":False,"reviewRequired":True}
 for i,item in enumerate(doc["items"]):
  sid=item["sourceSha256"];page=item["page"]
  if not isinstance(sid,str) or not re.fullmatch("[0-9a-f]{64}",sid) or type(page)!=int or page<1:raise ValueError("SOURCE_ID_HOLD")
  pageid=node("page",(sid,page),sourceSha256=sid,page=page)
  tid=node("dispute",(sid,page,item.get("primaryTableId"),item.get("secondaryTableIndex"),item["classification"]),
   classification=item["classification"],action=item["action"],contextVerified=False)
  edge(pageid,tid,"contains_dispute","v12j_source_page")
  evidence=item.get("sourceContext",[])
  if len(evidence)>128:raise ValueError("CONTEXT_BUDGET_HOLD")
  evidence_ids={}
  for e in evidence:
   line=e.get("line");value=clean(e.get("text",""))
   if type(line)!=int or line<1 or not value:raise ValueError("INVALID_LINE_EVIDENCE")
   lid=node("source_line",(sid,page,line,value),sourceSha256=sid,page=page,line=line,text=value)
   evidence_ids[(line,value)]=lid
   edge(tid,lid,"nearby_text_candidate","v12j_bounded_anchor_window")
  for label,kind,relation in (("captionCandidates","caption_candidate","possible_caption"),
                              ("footnoteCandidates","footnote_candidate","possible_footnote")):
   for e in item.get(label,[]):
    line=e.get("line");value=clean(e.get("text",""))
    lid=evidence_ids.get((line,value))
    if lid is None:raise ValueError("CONTEXT_REFERENCE_HOLD")
    cid=node(kind,(sid,page,line,value),sourceSha256=sid,page=page,line=line,text=value)
    edge(tid,cid,relation,"lexical_heuristic_not_scope_proof")
    edge(cid,lid,"derived_from_line","exact_v12j_line_reference")
  for unit in item.get("unitMentions",[]):
   if not isinstance(unit,str) or not re.fullmatch(r"[\w°%.]{1,20}",unit):raise ValueError("UNIT_TOKEN_HOLD")
   uid=node("unit_token",(sid,page,unit),token=unit)
   edge(tid,uid,"possible_unit","regex_in_nearby_text_not_cell_binding")
  if not item.get("pageTextAnchorHits"):stats["noAnchor"]+=1
  stats[item["classification"]]+=1
  if len(nodes)>max_nodes or len(edges)>max_edges:raise ValueError("GRAPH_BUDGET_HOLD")
 return {"nodes":list(nodes.values()),"edges":list(edges.values()),"classifications":dict(stats)}
def run(a):
 folder=a.folder.resolve();source=folder/"layout-context-v12j.json";raw=source.read_bytes();doc=json.loads(raw)
 if doc.get("schema")!="fun.layout.context.v12j" or doc.get("autoCorrected") is not False or doc.get("meaningVerified") is not False:raise ValueError("CONTEXT_SCHEMA_HOLD")
 if doc.get("reconciliationSha256")!=digest((folder/"layout-reconciliation-v12i.json").read_bytes()):raise ValueError("RECONCILIATION_HASH_HOLD")
 if doc.get("records")!=len(doc.get("items",[])) or doc["records"]>a.max_records:raise ValueError("RECORD_COUNT_HOLD")
 graph=build(doc,a.max_nodes,a.max_edges)
 result={"schema":"fun.layout.evidence_graph.v12k","contextSha256":digest(raw),"nodes":graph["nodes"],"edges":graph["edges"],
  "nodeCount":len(graph["nodes"]),"edgeCount":len(graph["edges"]),"classifications":graph["classifications"],
  "relationsVerified":False,"autoCorrected":False,"meaningVerified":False,"engineeringApproved":False}
 dest=folder/"layout-evidence-graph-v12k.json";payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
 if dest.exists():
  if dest.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with dest.open("x",encoding="utf-8") as f:f.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12K_GRAPH_"+state,"disputes":doc["records"],"nodes":result["nodeCount"],
  "edges":result["edgeCount"],"classifications":graph["classifications"],"relationsVerified":False,
  "autoCorrected":False,"output":str(dest)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 p.add_argument("--max-records",type=int,default=5000);p.add_argument("--max-nodes",type=int,default=100000);p.add_argument("--max-edges",type=int,default=200000)
 a=p.parse_args()
 try:
  if min(a.max_records,a.max_nodes,a.max_edges)<1:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12K_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
