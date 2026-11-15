"""Blender V6: import operator-provided licensed F-450 body geometry; no generated OEM claims."""
import bpy,sys,os,json,hashlib
from pathlib import Path
def digest(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
 return h.hexdigest()
def run():
 args=sys.argv[sys.argv.index("--")+1:]
 if len(args)!=3:raise ValueError("EXPECTED_SOURCE_OUTPUT_LICENSE")
 source,out,license_path=map(Path,args)
 source=source.resolve(strict=True);license_path=license_path.resolve(strict=True);out=out.absolute()
 if source.suffix.lower() not in (".glb",".gltf",".obj",".fbx"):raise ValueError("UNSUPPORTED_MESH_FORMAT")
 if source.stat().st_size>500_000_000 or license_path.stat().st_size>100_000:raise ValueError("INPUT_SIZE_HOLD")
 if not license_path.read_text(encoding="utf-8").strip():raise ValueError("LICENSE_EVIDENCE_REQUIRED")
 if out.exists() and any(out.iterdir()):raise ValueError("OUTPUT_NOT_EMPTY_HOLD")
 out.mkdir(parents=True,exist_ok=True)
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
 if source.suffix.lower() in (".glb",".gltf"):bpy.ops.import_scene.gltf(filepath=str(source))
 elif source.suffix.lower()==".obj":bpy.ops.wm.obj_import(filepath=str(source))
 else:bpy.ops.import_scene.fbx(filepath=str(source))
 meshes=[o for o in bpy.data.objects if o.type=="MESH"]
 if not meshes:raise ValueError("NO_MESH_OBJECTS_HOLD")
 for o in meshes:
  o["source_sha256"]=digest(source)
  o["vehicle_accuracy"]="UNVERIFIED"
  o["engineering_use"]="VISUAL_REFERENCE_ONLY"
  o["units_and_scale"]="UNVERIFIED"
 bpy.ops.wm.save_as_mainfile(filepath=str(out/"F450-Visual-Reference-V6.blend"))
 report={"schema":"fun.ev.f450_visual_reference.v6","sourceSha256":digest(source),
 "licenseEvidenceSha256":digest(license_path),"sourceName":source.name,
 "meshObjects":len(meshes),"blendSha256":digest(out/"F450-Visual-Reference-V6.blend"),
 "sourceVehicleIdentityVerified":False,"sourceScaleVerified":False,
 "oemGeometryVerified":False,"engineeringReleased":False,"manufacturingAuthorized":False}
 with (out/"F450-Visual-Reference-V6-receipt.json").open("x",encoding="utf-8") as f:json.dump(report,f,indent=2)
 print("FUN_F450_VISUAL_V6=CREATED",json.dumps(report))
run()
