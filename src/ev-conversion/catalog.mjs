// FUN_EV_ENGINEERING_V1: reference catalog only. Not an installation or execution allowlist.
// External source is untrusted until independently reviewed and version-pinned.
export const tools=Object.freeze([
  {id:"freecad",area:"cad",name:"FreeCAD",repo:"https://github.com/FreeCAD/FreeCAD",format:"FCStd",binary:"FreeCAD.exe"},
  {id:"freecad-cables",area:"cad",name:"Cables Workbench",repo:"https://github.com/sargo-devel/Cables",format:"FreeCAD workbench",binary:null},
  {id:"qelectrotech",area:"wiring",name:"QElectroTech",repo:"https://github.com/qelectrotech/qelectrotech-source-mirror",format:"QET drawings",binary:"QElectroTech.exe"},
  {id:"wireviz",area:"wiring",name:"WireViz",repo:"https://github.com/wireviz/WireViz",format:"YAML/Graphviz",binary:"wireviz.exe"},
  {id:"kicad",area:"wiring",name:"KiCad",repo:"https://github.com/KiCad/kicad-source-mirror",format:"KiCad schematic/PCB",binary:"kicad.exe"},
  {id:"fastsim",area:"simulation",name:"FASTSim",repo:"https://github.com/NatLabRockies/fastsim",format:"vehicle models",binary:null},
  {id:"fastsim-vehicles",area:"vehicle-data",name:"FASTSim Vehicles",repo:"https://github.com/NatLabRockies/fastsim-vehicles",format:"reference vehicle records",binary:null},
  {id:"cantools",area:"vehicle-data",name:"cantools",repo:"https://github.com/cantools/cantools",format:"CAN database",binary:null},
  {id:"python-can",area:"vehicle-data",name:"python-can",repo:"https://github.com/hardbyte/python-can",format:"CAN interface",binary:null},
  {id:"pybamm",area:"simulation",name:"PyBaMM",repo:"https://github.com/pybamm-team/PyBaMM",format:"battery model",binary:null},
  {id:"openmodelica",area:"simulation",name:"OpenModelica",repo:"https://github.com/OpenModelica/OpenModelica",format:"Modelica models",binary:"OMEdit.exe"},
  {id:"t3co",area:"simulation",name:"T3CO",repo:"https://github.com/NatLabRockies/T3CO",format:"fleet cost/performance",binary:null},
  {id:"openmdao",area:"simulation",name:"OpenMDAO",repo:"https://github.com/OpenMDAO/OpenMDAO",format:"engineering optimization",binary:null},
  {id:"inventree",area:"procurement",name:"InvenTree",repo:"https://github.com/inventree/InvenTree",format:"parts/BOM/stock API",binary:null},
  {id:"erpnext",area:"manufacturing",name:"ERPNext",repo:"https://github.com/frappe/erpnext",format:"work orders/ERP",binary:null},
  {id:"capella",area:"safety",name:"Eclipse Capella",repo:"https://github.com/eclipse-capella/capella",format:"systems architecture",binary:null},
  {id:"scram",area:"safety",name:"SCRAM",repo:"https://github.com/rakhimov/scram",format:"fault-tree analysis",binary:null},
  {id:"calculix",area:"safety",name:"CalculiX",repo:"https://github.com/calculix/CalculiX-Windows",format:"finite element analysis",binary:null}
]);
export const schema="fun.ev.engineering.catalog.v1";
