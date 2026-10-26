import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyAgentPrototype,GLOVE_FINISHES,PROTOTYPE_AGENT} from '../dist/agent-prototype.mjs';
const json=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8'));
const catalogs={agents:json('agents.json'),weapons:json('weapons.json'),skins:json('skins.json')};
function model(name){const bytes=fs.readFileSync(new URL('../dist/assets/agent-3d/'+name,import.meta.url));assert.equal(bytes.subarray(0,4).toString(),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())}
test('real world gloves have matching agent joints and self-contained textures',()=>{
 const agent=model('number-k.glb'),gloves=model('sport-gloves.glb');const bones=new Set(agent.nodes.map(n=>n.name));
 for(const skin of gloves.skins)for(const index of skin.joints)assert(bones.has(gloves.nodes[index].name),'missing joint '+gloves.nodes[index].name);
 for(const file of [agent,gloves]){assert(!file.animations?.length);assert(file.images.every(image=>image.bufferView!==undefined&&!image.uri));assert(file.meshes.length>=1)}
 assert(gloves.nodes.some(n=>n.name.endsWith('.worldmodel')));assert(!gloves.nodes.some(n=>n.name.endsWith('.viewmodel')));
 for(const finish of GLOVE_FINISHES)assert(fs.statSync(new URL('../dist/assets/agent-3d/'+finish.texture,import.meta.url)).size>10000);
});
test('applying the prototype preserves the other view, weapons and saved-set data',()=>{
 const equipment={__agent:{desired:'agent-4726'},'AK-47':{current:'owned',desired:'wish'},'Sport Gloves':{current:'old',desired:'other'}};
 applyAgentPrototype(equipment,'current',GLOVE_FINISHES[1].id,catalogs);
 assert.equal(equipment.__agent.current,PROTOTYPE_AGENT);assert.equal(equipment.__agent.desired,'agent-4726');assert.equal(equipment['Sport Gloves'].desired,'other');assert.deepEqual(equipment['AK-47'],{current:'owned',desired:'wish'});assert.equal(equipment.__layout.current.gloves[0],'Sport Gloves');
 const saved=JSON.parse(JSON.stringify(equipment));applyAgentPrototype(equipment,'current',GLOVE_FINISHES[0].id,catalogs);assert.equal(saved['Sport Gloves'].current,GLOVE_FINISHES[1].id);
});
test('unsupported finish or mode leaves equipment untouched',()=>{
 for(const [mode,finish]of [['desired','bad'],['wrong',GLOVE_FINISHES[0].id]]){const equipment={};assert.throws(()=>applyAgentPrototype(equipment,mode,finish,catalogs));assert.deepEqual(equipment,{})}
});
