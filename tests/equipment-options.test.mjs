import test from 'node:test';import assert from 'node:assert/strict';
import {validCondition,savedCondition,setCondition,weaponEnabled,setWeaponEnabled} from '../dist/equipment-options.mjs';
const detail={wears:['Factory New','Field-Tested','Battle-Scarred'],stattrak:true,souvenir:false};
test('wear and variant are independent for owned and desired weapons and survive saved sets',()=>{
 const equipment={'USP-S':{current:'owned-skin',desired:'wish-skin'}};setCondition(equipment,'USP-S','current',detail,'Field-Tested','normal');setCondition(equipment,'USP-S','desired',detail,'Factory New','stattrak');const restored=JSON.parse(JSON.stringify(equipment));assert.deepEqual(savedCondition(restored,'USP-S','current',detail),{wear:'Field-Tested',variant:'normal'});assert.deepEqual(savedCondition(restored,'USP-S','desired',detail),{wear:'Factory New',variant:'stattrak'});assert.equal(restored['USP-S'].current,'owned-skin');
});
test('invalid or legacy conditions fall back to a real available wear and supported variant',()=>{
 assert.deepEqual(validCondition(detail,'Well-Worn','souvenir'),{wear:'Field-Tested',variant:'normal'});assert.deepEqual(validCondition({wears:['Factory New']},'Field-Tested','invalid'),{wear:'Factory New',variant:'normal'});assert.deepEqual(validCondition({},'Field-Tested','stattrak'),{wear:'',variant:'normal'});
});
test('disabling is reversible, separate by view, and never deletes selected skins',()=>{
 const equipment={'P250':{current:'skin',desired:'other'}};assert(weaponEnabled(equipment,'P250','current'));setWeaponEnabled(equipment,'P250','current',false);assert(!weaponEnabled(equipment,'P250','current'));assert(weaponEnabled(equipment,'P250','desired'));setWeaponEnabled(equipment,'P250','current',false);assert.equal(equipment.__disabled.current.length,1);const restored=JSON.parse(JSON.stringify(equipment));setWeaponEnabled(restored,'P250','current',true);assert(weaponEnabled(restored,'P250','current'));assert.equal(restored.P250.current,'skin');assert.throws(()=>setWeaponEnabled(restored,'P250','other',false));
});
