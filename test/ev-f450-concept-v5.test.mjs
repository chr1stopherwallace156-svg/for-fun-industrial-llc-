import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const macro=fs.readFileSync(new URL('../src/ev-conversion/F450-Concept-V5.FCMacro',import.meta.url),'utf8');
const runner=fs.readFileSync(new URL('../src/ev-conversion/Start-F450-Concept-V5.ps1',import.meta.url),'utf8');
test('native model has chassis, cab, battery, drive and STEP output',()=>{for(const s of ['Frame_Left','Frame_Right','Cab_Envelope','Battery_Left_Envelope','Drive_Unit_Envelope','Import.export(objects,step)','doc.saveAs(fc)'])assert.ok(macro.includes(s))});
test('concept labels and approval holds preserved',()=>{for(const s of ['ALL_PLACEHOLDER_MM','oemGeometryVerified','collisionClearanceVerified','engineeringReleased'])assert.ok(macro.includes(s))});
test('launcher does not overwrite prior outputs or restart unrelated services',()=>{assert.match(runner,/V5_OUTPUT_NOT_EMPTY_HOLD/);assert.match(runner,/V5_OUTPUT_ALREADY_EXISTS_HOLD/);assert.doesNotMatch(runner,/Stop-Process|Restart-Service|ollama/i)});
