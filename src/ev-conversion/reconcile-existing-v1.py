#!/usr/bin/env python3
"""Read-only scoped audit: existing Fun Industrial EV integration artifacts."""
import argparse,hashlib,json,os,sys
from pathlib import Path
def hash_file(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
 return h.hexdigest()
def run(root,max_files):
 root=root.resolve(strict=True)
 if root.name.lower()!="funindustrial":raise ValueError("FUN_INDUSTRIAL_ROOT_REQUIRED")
 if root.is_symlink():raise ValueError("ROOT_LINK_HOLD")
 allowed={".fcstd": "native_freecad_model",".step":"step_exchange",".stp":"step_exchange",".fcmacro":"freecad_macro",".svg":"rendered_diagram",".yml":"harness_source",".yaml":"harness_source",".tsv":"bom_or_pinout",".csv":"bom_or_pinout",".json":"possible_receipt"}
 matches=[];visited=0;skipped=0
 for base,dirs,files in os.walk(root,followlinks=False):
  basep=Path(base)
  dirs[:]=sorted(d for d in dirs if not (basep/d).is_symlink() and d.lower() not in {"node_modules",".git","venv",".venv","site-packages","wheels","__pycache__"})
  for name in sorted(files):
   visited+=1
   if visited>max_files:raise ValueError("FILE_SCAN_BUDGET_HOLD")
   p=basep/name
   if p.suffix.lower() not in allowed or p.is_symlink():continue
   st=p.stat()
   if st.st_size>20*1024*1024:skipped+=1;continue
   rel=str(p.relative_to(root))
   if p.suffix.lower()==".json" and not any(x in name.lower() for x in ("receipt","manifest","cad","wire","ev-","native")):continue
   matches.append({"path":rel,"type":allowed[p.suffix.lower()],"bytes":st.st_size,"sha256":hash_file(p)})
 # File existence/hash is not execution proof, and cannot establish design approval.
 print(json.dumps({"state":"FUN_EV_RECONCILIATION_OBSERVED","root":str(root),"scannedFiles":visited,"matchedFiles":len(matches),"oversizedSkipped":skipped,
 "cadInstalled":"NOT_DETERMINED","wiringInstalled":"NOT_DETERMINED","nativeExecutionVerified":"NOT_DETERMINED",
 "vehicleDesignQualified":False,"engineeringApproved":False,"observedArtifacts":matches},indent=2))
def main():
 p=argparse.ArgumentParser();p.add_argument("--root",required=True,type=Path);p.add_argument("--max-files",type=int,default=20000);a=p.parse_args()
 try:
  if a.max_files<1:raise ValueError("INVALID_BUDGET")
  run(a.root,a.max_files)
 except Exception as e:print("FUN_EV_RECONCILIATION_HOLD="+str(e),file=sys.stderr);sys.exit(1)
if __name__=="__main__":main()
