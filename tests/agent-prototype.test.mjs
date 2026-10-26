import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyAgentEquipment} from '../dist/agent-prototype.mjs';
const json=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8'));
const catalogs={agents:json('agents.json'),weapons:json('weapons.json'),skins:json('skins.json'),assets:json('agent-3d-catalog.json')};
function model(file){const bytes=fs.readFileSync(new URL('../dist/'+file,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())}
test('all 63 agents support the eight authored world glove skeletons',()=>{
 const assets=catalogs.assets;assert.equal(Object.keys(assets.agents).length,63);assert.equal(Object.keys(assets.families).length,8);
 const families=Object.values(assets.families).map(f=>model(f.model));
 for(const agent of catalogs.agents){assert.equal(assets.agents[agent.id].team,agent.team);const source=model(assets.agents[agent.id].model),bones=new Set(source.nodes.map(n=>n.name));
  assert(source.meshes.length);assert(source.images.every(i=>i.bufferView!==undefined&&!i.uri));
  for(const gloves of families){assert(gloves.nodes.some(n=>n.name.endsWith('.worldmodel')));assert(!gloves.nodes.some(n=>n.name.endsWith('.viewmodel')));for(const skin of gloves.skins)for(const index of skin.joints){const name=gloves.nodes[index].name;assert(bones.has(name)||(/^attachHand_[LR]$/.test(name)&&bones.has('hand_'+name.slice(-1))),agent.id+' missing '+name)}}
 }
});
test('every glove catalog finish has its own material assets and correct family',()=>{
 const gloveNames=catalogs.weapons.filter(w=>w.category==='Guantes').map(w=>w.name);const finishes=catalogs.skins.filter(s=>gloveNames.includes(s.weapon));assert.equal(finishes.filter(f=>!f.vanilla).length,94);assert.equal(Object.keys(catalogs.assets.finishes).length,finishes.length);
 for(const finish of finishes){const spec=catalogs.assets.finishes[finish.id];assert(spec,finish.id);assert.equal(spec.family,finish.weapon);if(!finish.vanilla)for(const key of ['color','orm']){assert(spec[key]);assert(fs.statSync(new URL('../dist/'+spec[key],import.meta.url)).size>100)}}
});
test('all glove families apply on either team and preserve the opposite layer and weapons',()=>{
 for(const team of ['CT','T'])for(const family of Object.keys(catalogs.assets.families)){
  const agent=catalogs.agents.find(a=>a.team===team),finish=Object.keys(catalogs.assets.finishes).find(id=>catalogs.assets.finishes[id].family===family&&!catalogs.assets.finishes[id].vanilla),equipment={__agent:{desired:'other'},'AK-47':{current:'owned',desired:'wish'},[family]:{current:'old',desired:'keep'}};
  applyAgentEquipment(equipment,team,'current',agent.id,finish,catalogs);assert.equal(equipment.__agent.current,agent.id);assert.equal(equipment.__agent.desired,'other');assert.equal(equipment[family].desired,'keep');assert.deepEqual(equipment['AK-47'],{current:'owned',desired:'wish'});assert.equal(equipment.__layout.current.gloves[0],family);assert.equal(JSON.parse(JSON.stringify(equipment))[family].current,finish);
 }
});
test('wrong team, invalid finish and invalid mode cannot mutate equipment',()=>{
 const agent=catalogs.agents.find(a=>a.team==='T'),finish=Object.keys(catalogs.assets.finishes)[0];for(const [team,mode,id]of [['CT','current',finish],['T','invalid',finish],['T','desired','missing']]){const equipment={};assert.throws(()=>applyAgentEquipment(equipment,team,mode,agent.id,id,catalogs));assert.deepEqual(equipment,{})}
});

test('creating a glove pair preserves the implicit desired default',()=>{const team='T',agent=catalogs.agents.find(a=>a.team===team),family='Broken Fang Gloves',finish=Object.keys(catalogs.assets.finishes).find(id=>catalogs.assets.finishes[id].family===family&&!catalogs.assets.finishes[id].vanilla),equipment={};const expected=catalogs.skins.filter(s=>s.weapon===family&&!s.vanilla).sort((a,b)=>a.name.localeCompare(b.name))[0];applyAgentEquipment(equipment,team,'current',agent.id,finish,catalogs);assert.equal(equipment[family].desired,expected.id)});
