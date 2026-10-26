import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assignAgent,selectedAgent} from '../dist/agent-selection.mjs';
import {ensureLayouts} from '../dist/loadout-layout.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/agents.json',import.meta.url),'utf8'));
const weapons=JSON.parse(fs.readFileSync(new URL('../dist/weapons.json',import.meta.url),'utf8'));
test('every agent has a unique ID, team and locally available PNG',()=>{
  assert(catalog.length>=63);assert.equal(new Set(catalog.map(a=>a.id)).size,catalog.length);
  for(const agent of catalog){assert(['CT','T'].includes(agent.team));assert(agent.name&&agent.squad);const file=fs.readFileSync(new URL('../dist/'+agent.image,import.meta.url));assert.equal(file.subarray(1,4).toString(),'PNG')}
  assert.equal(catalog.filter(a=>a.team==='CT').length,29);assert.equal(catalog.filter(a=>a.team==='T').length,34);
});
test('agent is separate for each view and survives saved-set serialization',()=>{
  const equipment={'USP-S':{current:'old-owned',desired:'old-wish'}};
  const [one,two]=catalog.filter(a=>a.team==='CT');
  assignAgent(equipment,'CT','current',one.id,catalog);assignAgent(equipment,'CT','desired',two.id,catalog);
  ensureLayouts(equipment,'CT',weapons);
  const restored=JSON.parse(JSON.stringify(equipment));
  assert.equal(selectedAgent(restored,'CT','current',catalog).id,one.id);
  assert.equal(selectedAgent(restored,'CT','desired',catalog).id,two.id);
  assert.deepEqual(equipment['USP-S'],{current:'old-owned',desired:'old-wish'});
});
test('cannot equip another team agent and invalid legacy IDs stay unselected',()=>{
  const equipment={},t=catalog.find(a=>a.team==='T');
  assert.throws(()=>assignAgent(equipment,'CT','current',t.id,catalog));
  assert.equal(selectedAgent({__agent:{current:t.id}},'CT','current',catalog),null);
  assert.equal(selectedAgent({__agent:{current:'missing-id'}},'CT','current',catalog),null);
  assert.equal(selectedAgent({},'CT','current',catalog),null);
});
test('clearing one agent preserves the other view and weapon slots',()=>{
  const equipment={__layout:{current:{rifles:['M4A4']}}},[one,two]=catalog.filter(a=>a.team==='CT');
  assignAgent(equipment,'CT','current',one.id,catalog);assignAgent(equipment,'CT','desired',two.id,catalog);assignAgent(equipment,'CT','current',null,catalog);
  assert.equal(selectedAgent(equipment,'CT','current',catalog),null);assert.equal(selectedAgent(equipment,'CT','desired',catalog).id,two.id);assert.deepEqual(equipment.__layout.current.rifles,['M4A4']);
});

test('all agents have a local full-body render independent of the inventory icon',()=>{for(const agent of catalog){assert(agent.fullImage);assert.notEqual(agent.fullImage,agent.image);const png=fs.readFileSync(new URL('../dist/'+agent.fullImage,import.meta.url));assert.equal(png.subarray(0,4).toString(),'RIFF');assert.equal(png.subarray(8,12).toString(),'WEBP')}});
