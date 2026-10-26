import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureLayouts,assignSlot,allowedWeapons,DEFAULT_LOADOUTS} from '../dist/loadout-layout.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/weapons.json',import.meta.url),'utf8'));
test('legacy skin selections survive layout initialization',()=>{
  const equipment={'USP-S':{current:'owned-id',desired:'wish-id'}};
  const layouts=ensureLayouts(equipment,'CT',catalog);
  assert.deepEqual(equipment['USP-S'],{current:'owned-id',desired:'wish-id'});
  assert.deepEqual(layouts.current.pistols,DEFAULT_LOADOUTS.CT.pistols);
  assert.deepEqual(layouts.desired.rifles,['FAMAS','M4A1-S','AUG','M4A4','AWP']);
});
test('actual and desired slots are independent and persist through JSON snapshots',()=>{
  const equipment={};const layout=ensureLayouts(equipment,'T',catalog);
  assignSlot(layout.desired.rifles?layout.desired:null,'rifles',0,'G3SG1');
  assert.equal(layout.current.rifles[0],'Galil AR');
  const restored=ensureLayouts(JSON.parse(JSON.stringify(equipment)),'T',catalog);
  assert.equal(restored.desired.rifles[0],'G3SG1');
});
test('equipping a duplicate swaps its old slot instead of duplicating it',()=>{
  const layout=structuredClone(DEFAULT_LOADOUTS.CT);
  assignSlot(layout,'rifles',0,'AWP');
  assert.equal(layout.rifles[0],'AWP');assert.equal(layout.rifles[4],'FAMAS');assert.equal(new Set(layout.rifles).size,5);
});
test('invalid or wrong-team slots fall back to valid equipment',()=>{
  const equipment={__layout:{current:{pistols:['Glock-18'],rifles:['AK-47','AWP','AWP']}}};
  const result=ensureLayouts(equipment,'CT',catalog);
  assert.equal(result.current.pistols[0],'USP-S');
  assert(!result.current.rifles.includes('AK-47'));assert.equal(new Set(result.current.rifles).size,5);
});
test('starter pistols, other pistols and mid-tier weapons obey slot rules',()=>{
  assert.deepEqual(allowedWeapons(catalog,'CT','pistols',0).sort(),['P2000','USP-S']);
  assert.deepEqual(allowedWeapons(catalog,'T','pistols',0),['Glock-18']);
  assert(!allowedWeapons(catalog,'T','pistols',1).includes('Glock-18'));
  assert(allowedWeapons(catalog,'CT','mid').includes('MP9'));
  assert(!allowedWeapons(catalog,'CT','mid').includes('MAC-10'));
});
