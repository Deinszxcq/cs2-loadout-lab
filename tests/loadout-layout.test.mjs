import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureLayouts,assignSlot,equipCatalogSkin,allowedWeapons,DEFAULT_LOADOUTS} from '../dist/loadout-layout.mjs';
import {summaryItems,summarizeQuotes} from '../dist/loadout-total.mjs';
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

const finishes=JSON.parse(fs.readFileSync(new URL('../dist/skins.json',import.meta.url),'utf8'));
const skinIndex=new Map(finishes.map(skin=>[skin.id,skin]));
const knife=finishes.find(skin=>skin.weapon==='Butterfly Knife'&&!skin.vanilla);
const details=JSON.parse(fs.readFileSync(new URL('../dist/skin-details.json',import.meta.url),'utf8'));

test('marking a catalog knife as owned equips its slot and includes it in the total',()=>{
  const equipment={};
  assert.equal(equipCatalogSkin(equipment,'CT','current',knife,catalog,skinIndex),true);
  const layouts=ensureLayouts(JSON.parse(JSON.stringify(equipment)),'CT',catalog,skinIndex);
  assert.equal(layouts.current.knife[0],knife.weapon);
  assert.equal(layouts.desired.knife[0],DEFAULT_LOADOUTS.CT.knife[0]);
  const items=summaryItems({
    equipment,team:'CT',mode:'current',catalog,layout:layouts.current,agents:[],details,
    skinFor:weapon=>skinIndex.get(equipment[weapon]?.current),
  });
  assert.deepEqual(items.map(item=>item.skin.id),[knife.id]);
  const quotes=items.map(()=>({market:'steam',loaded:true,price:45000}));
  assert.equal(summarizeQuotes(quotes,'steam').cents,45000);
});

test('a previously saved knife outside the default slot is recovered when unambiguous',()=>{
  const equipment={[knife.weapon]:{current:knife.id},__layout:{current:{knife:['Bayonet']}}};
  assert.equal(ensureLayouts(equipment,'CT',catalog,skinIndex).current.knife[0],knife.weapon);
  const bayonet=finishes.find(skin=>skin.weapon==='Bayonet'&&!skin.vanilla);
  equipment.Bayonet={current:bayonet.id};
  equipment.__layout.current.knife=['Bayonet'];
  assert.equal(ensureLayouts(equipment,'CT',catalog,skinIndex).current.knife[0],'Bayonet');
});
