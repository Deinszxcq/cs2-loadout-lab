import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const skins=read('../dist/skins.json'),weapons=read('../dist/weapons.json');
test('catalog includes all firearm families and cosmetics',()=>{
  for(const name of ['USP-S','Glock-18','P2000','P250','CZ75-Auto','Dual Berettas','Five-SeveN','Tec-9','R8 Revolver','Desert Eagle','AK-47','M4A4','M4A1-S','AUG','FAMAS','Galil AR','SG 553','SSG 08','AWP','SCAR-20','G3SG1','MP9','MAC-10','MP5-SD','MP7','P90','PP-Bizon','UMP-45','Nova','XM1014','MAG-7','Sawed-Off','M249','Negev','Zeus x27','Karambit','Sport Gloves'])assert(weapons.some(w=>w.name===name),name);
  assert(skins.filter(s=>s.weapon==='AWP'&&!s.vanilla).length>=52);
  assert(skins.some(s=>s.weapon==='AWP'&&s.name==='Dragon Lore'));
  assert(skins.some(s=>s.weapon==='AWP'&&s.name==='Gungnir'));
});
test('all original selections remain valid for their original weapon',()=>{
  for(const old of read('./fixtures/legacy-skins.json'))assert(skins.some(s=>s.id===old.id&&s.weapon===old.weapon),old.id);
});
test('equipment respects team restrictions',()=>{
  for(const name of ['AK-47','Glock-18','Tec-9','MAC-10'])assert.deepEqual(weapons.find(w=>w.name===name).teams,['T']);
  for(const name of ['M4A4','M4A1-S','USP-S','P2000','Five-SeveN','MP9'])assert.deepEqual(weapons.find(w=>w.name===name).teams,['CT']);
  assert.deepEqual(weapons.find(w=>w.name==='AWP').teams,['CT','T']);
});
test('IDs, images, defaults and phase labels are usable',()=>{
  assert.equal(new Set(skins.map(s=>s.id)).size,skins.length);
  for(const weapon of weapons){const list=skins.filter(s=>s.weapon===weapon.name);assert(list.length,weapon.name);assert.equal(list.filter(s=>s.vanilla).length,1,weapon.name);assert.equal(list.filter(s=>!s.vanilla).length,weapon.count)}
  for(const s of skins){assert(s.name&&s.color&&s.image,s.id);assert(s.image.startsWith('https://')||s.image.startsWith('assets/'),s.id)}
  assert(skins.find(s=>s.id==='skin-a841a452bb30').name.includes('Emerald'));
});
