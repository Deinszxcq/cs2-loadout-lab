import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {overviewWeapons,overviewAgent} from '../dist/overview-catalog.mjs';
import {DEFAULT_LOADOUTS} from '../dist/loadout-layout.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/weapons.json',import.meta.url),'utf8'));
test('overview includes every team firearm once, including weapons outside the five saved slots',()=>{
 for(const team of ['CT','T']){const groups=overviewWeapons(catalog,team,DEFAULT_LOADOUTS[team]),actual=Object.values(groups).flat(),expected=catalog.filter(w=>w.teams.includes(team)&&['Pistolas','Subfusiles','Pesadas','Rifles'].includes(w.category)).map(w=>w.name);assert.deepEqual([...actual].sort(),expected.sort());assert.equal(new Set(actual).size,actual.length);assert(actual.includes('M249'));assert(actual.includes('Negev'));assert(actual.includes('SSG 08'));assert(actual.includes('P250'));assert(groups.mid.length>5)}
 assert(overviewWeapons(catalog,'CT',DEFAULT_LOADOUTS.CT).pistols.includes('P2000'));assert(!Object.values(overviewWeapons(catalog,'CT',DEFAULT_LOADOUTS.CT)).flat().includes('AK-47'));
});
test('default presentation never writes a paid agent into the user selection',()=>{
 assert.equal(overviewAgent(null,'CT').name,'SAS');assert.equal(overviewAgent(null,'T').name,'Phoenix Connexion');const chosen={id:'selected',name:'Custom'};assert.equal(overviewAgent(chosen,'T'),chosen);
 const assets=JSON.parse(fs.readFileSync(new URL('../dist/agent-3d-catalog.json',import.meta.url),'utf8'));for(const team of ['CT','T']){const spec=assets.defaults[team];assert.equal(spec.team,team);assert(assets.poses[spec.pose]);assert(fs.statSync(new URL('../dist/'+spec.model,import.meta.url)).size>100000)}
});
