#!/usr/bin/env python3
"""V12R: evidence-preserving PDF text-integrity review eligibility gate."""
import argparse,collections,hashlib,json,re,sys,unicodedata
from pathlib import Path
CID=re.compile(r"\(cid:\s*\d+\s*\)",re.I)
REPLACEMENT="\ufffd"
CONTROL_CATEGORIES={"Cc","Cs"}
def sha(b):return hashlib.sha256(b).hexdigest()
def classify(text):
 if not isinstance(text,str):raise ValueError("INVALID_TEXT_HOLD")
 flags=[]
 cid=len(CID.findall(text))
 if cid:flags.append("CID_GLYPH_ARTIFACT")
 if REPLACEMENT in text:flags.append("REPLACEMENT_CHARACTER")
 bad=sum(unicodedata.category(c) in CONTROL_CATEGORIES and c not in "\t\n\r" for c in text)
 if bad:flags.append("CONTROL_OR_SURROGATE")
 stripped=text.strip()
 if not stripped:flags.append("EMPTY_TEXT")
 # Non-ASCII text is not inherently corrupt; no English-only assumption.
 if flags:return "TEXT_RECOVERY_REQUIRED",flags,{"cidTokens":cid,"controlCharacters":bad}
 if len(stripped)<3:return "LOW_INFORMATION_REVIEW",["SHORT_TEXT"],{"cidTokens":0,"controlCharacters":0}
 return "READABLE_REVIEW_CANDIDATE",[],{"cidTokens":0,"controlCharacters":0}
def run(a):
 folder=a.folder.resolve();qfile=folder/"layout-review-priority-v12p.json";raw=qfile.read_bytes();q=json.loads(raw)
 if q.get("schema")!="fun.layout.review_priority.v12p" or q.get("priorityIsConfidence") is not False or q.get("engineeringApproved") is not False:raise ValueError("QUEUE_SCHEMA_HOLD")
 if q.get("disambiguationSha256")!=sha((folder/"layout-disambiguation-v12o.json").read_bytes()):raise ValueError("QUEUE_PROVENANCE_HOLD")
 rows=q.get("reviewQueue")
 if not isinstance(rows,list) or q.get("queueLength")!=len(rows) or len(rows)>a.max_records:raise ValueError("RECORD_BUDGET_HOLD")
 output=[];counts=collections.Counter();flags=collections.Counter();seen=set()
 for row in rows:
  key=(row["sourceSha256"],row["page"],row["lineKey"])
  if key in seen:raise ValueError("DUPLICATE_REVIEW_KEY_HOLD")
  seen.add(key)
  state,issues,metrics=classify(row.get("exampleLineText"))
  counts[state]+=1;flags.update(issues)
  output.append({"sourceSha256":key[0],"page":key[1],"lineKey":key[2],
   "originalReviewPriorityScore":row["reviewPriorityScore"],"originalReviewState":row["state"],
   "textIntegrityState":state,"flags":issues,"metrics":metrics,
   "sourceText":row["exampleLineText"],"sourceBBox":row.get("exampleLineBBox"),
   "operatorReviewEligible":state=="READABLE_REVIEW_CANDIDATE",
   "textMeaningVerified":False,"relationshipVerified":False,"engineeringApproved":False})
 result={"schema":"fun.layout.text_integrity.v12r","reviewQueueSha256":sha(raw),
  "records":len(output),"states":dict(sorted(counts.items())),"issueCounts":dict(sorted(flags.items())),
  "textRecovered":False,"autoCorrected":False,"relationsVerified":False,"engineeringApproved":False,
  "items":output}
 path=folder/"layout-text-integrity-v12r.json";payload=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
 if path.exists():
  if path.read_text(encoding="utf-8")!=payload:raise ValueError("OUTPUT_CONFLICT_HOLD")
  state="EXISTS"
 else:
  with path.open("x",encoding="utf-8") as f:f.write(payload)
  state="CREATED"
 print(json.dumps({"state":"FUN_V12R_TEXT_INTEGRITY_"+state,"records":len(output),
  "states":result["states"],"issueCounts":result["issueCounts"],
  "recoveryRequired":counts["TEXT_RECOVERY_REQUIRED"],
  "operatorReviewEligible":counts["READABLE_REVIEW_CANDIDATE"],
  "engineeringApproved":False,"output":str(path)},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--folder",type=Path,required=True)
 p.add_argument("--max-records",type=int,default=10000);a=p.parse_args()
 try:
  if a.max_records<1:raise ValueError("INVALID_BUDGET")
  run(a)
 except Exception as e:print("FUN_V12R_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
