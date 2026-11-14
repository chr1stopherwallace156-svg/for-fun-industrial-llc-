#!/usr/bin/env python3
"""V12Q: explicit operator review of V12P, append-only hash-linked journal."""
import argparse,hashlib,json,os,sys
from pathlib import Path
def digest(b):return hashlib.sha256(b).hexdigest()
def canonical(x):return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
def load_queue(folder):
 p=folder/"layout-review-priority-v12p.json";raw=p.read_bytes();d=json.loads(raw)
 if d.get("schema")!="fun.layout.review_priority.v12p" or d.get("engineeringApproved") is not False or d.get("priorityIsConfidence") is not False:raise ValueError("QUEUE_SCHEMA_HOLD")
 if d.get("disambiguationSha256")!=digest((folder/"layout-disambiguation-v12o.json").read_bytes()):raise ValueError("QUEUE_PROVENANCE_HOLD")
 rows=d.get("reviewQueue")
 if not isinstance(rows,list) or d.get("queueLength")!=len(rows):raise ValueError("QUEUE_COUNT_HOLD")
 ids={}
 for r in rows:
  k=(r["sourceSha256"],r["page"],r["lineKey"])
  if k in ids:raise ValueError("DUPLICATE_REVIEW_KEY_HOLD")
  ids[k]=r
 return digest(raw),rows,ids
def read_log(path,queuehash,ids):
 entries=[];prev="GENESIS";decided={}
 if not path.exists():return entries,decided,prev
 with path.open("rb") as f:
  for number,raw in enumerate(f,1):
   if not raw.endswith(b"\n"):raise ValueError("INCOMPLETE_JOURNAL_HOLD")
   try:e=json.loads(raw)
   except Exception:raise ValueError("INVALID_JOURNAL_JSON_HOLD")
   if e.get("seq")!=number or e.get("prevHash")!=prev or e.get("queueSha256")!=queuehash:raise ValueError("JOURNAL_CHAIN_HOLD")
   expected=digest(canonical({k:v for k,v in e.items() if k!="entryHash"}))
   if e.get("entryHash")!=expected:raise ValueError("JOURNAL_HASH_HOLD")
   key=(e.get("sourceSha256"),e.get("page"),e.get("lineKey"))
   if key not in ids or e.get("decision") not in ("CONFIRM_RELATIONSHIP","REJECT_RELATIONSHIP","DEFER"):raise ValueError("JOURNAL_DECISION_HOLD")
   if key in decided:raise ValueError("DUPLICATE_DECISION_HOLD")
   if e.get("engineeringApproved") is not False:raise ValueError("AUTHORITY_HOLD")
   decided[key]=e;entries.append(e);prev=e["entryHash"]
 return entries,decided,prev
def run(a):
 folder=a.folder.resolve();queuehash,rows,ids=load_queue(folder)
 path=(folder/"V12Q-OperatorReview"/"review-journal-v12q.jsonl").resolve()
 if not path.is_relative_to(folder):raise ValueError("PATH_ESCAPE_HOLD")
 entries,decided,prev=read_log(path,queuehash,ids)
 if a.action=="verify":
  print(json.dumps({"state":"FUN_V12Q_JOURNAL_VERIFIED","entries":len(entries),"pending":len(rows)-len(decided),"chainTip":prev,"engineeringApproved":False},indent=2));return
 if a.action=="list":
  pending=[r for r in rows if (r["sourceSha256"],r["page"],r["lineKey"]) not in decided]
  print(json.dumps({"state":"FUN_V12Q_REVIEW_READY","total":len(rows),"reviewed":len(decided),"pending":len(pending),
   "next":[{"sourceSha256":r["sourceSha256"],"page":r["page"],"lineKey":r["lineKey"],
   "score":r["reviewPriorityScore"],"reasons":r["priorityReasons"],"text":r["exampleLineText"],
   "bbox":r["exampleLineBBox"]} for r in pending[:a.limit]],"engineeringApproved":False},indent=2));return
 if not a.operator or not a.operator.strip() or len(a.operator)>100:raise ValueError("OPERATOR_REQUIRED")
 if not a.reason or not a.reason.strip() or len(a.reason)>500:raise ValueError("REASON_REQUIRED")
 key=(a.source_sha256,a.page,a.line_key)
 if key not in ids:raise ValueError("UNKNOWN_REVIEW_KEY_HOLD")
 if key in decided:raise ValueError("ALREADY_REVIEWED_HOLD")
 path.parent.mkdir(parents=True,exist_ok=True)
 lock=path.with_suffix(".lock")
 fd=None
 try:
  fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  os.close(fd);fd=None
  # Check again under exclusive lock to prevent concurrent decision overwrite.
  entries,decided,prev=read_log(path,queuehash,ids)
  if key in decided:raise ValueError("ALREADY_REVIEWED_HOLD")
  e={"schema":"fun.layout.operator_review_entry.v12q","seq":len(entries)+1,"prevHash":prev,
   "queueSha256":queuehash,"sourceSha256":key[0],"page":key[1],"lineKey":key[2],
   "decision":a.decision,"operator":a.operator.strip(),"reason":a.reason.strip(),
   "relationshipReviewOnly":True,"engineeringApproved":False}
  e["entryHash"]=digest(canonical(e))
  with path.open("ab") as f:
   f.write(canonical(e)+b"\n");f.flush();os.fsync(f.fileno())
  print(json.dumps({"state":"FUN_V12Q_DECISION_RECORDED","seq":e["seq"],"decision":e["decision"],
   "entryHash":e["entryHash"],"engineeringApproved":False,"journal":str(path)},indent=2))
 finally:
  if fd is not None:os.close(fd)
  if lock.exists():lock.unlink()
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",required=True,type=Path)
 sub=p.add_subparsers(dest="action",required=True)
 q=sub.add_parser("list");q.add_argument("--limit",type=int,default=5)
 sub.add_parser("verify")
 d=sub.add_parser("decide");d.add_argument("--source-sha256",required=True);d.add_argument("--page",required=True,type=int)
 d.add_argument("--line-key",required=True);d.add_argument("--decision",required=True,choices=["CONFIRM_RELATIONSHIP","REJECT_RELATIONSHIP","DEFER"])
 d.add_argument("--operator",required=True);d.add_argument("--reason",required=True)
 a=p.parse_args()
 try:
  if a.action=="list" and not 1<=a.limit<=25:raise ValueError("LIMIT_HOLD")
  run(a)
 except Exception as e:print("FUN_V12Q_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
