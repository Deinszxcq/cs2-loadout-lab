import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {filterCatalog} from '../dist/catalog-data.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../dist/'+name,import.meta.url),'utf8'));
const items=read('skins.json'),models=read('weapons.json'),details=read('skin-details.json');
const filter=options=>filterCatalog(items,models,details,options);
test('explorer covers every finish without inventing base-weapon wear',()=>{assert.equal(filter({}).length,2106);assert.equal(filter({weapon:'AWP'}).length,52);for(const s of items.filter(s=>!s.vanilla)){const d=details[s.id];assert(d,s.id);assert(d.rarity);if(d.min!==null)assert(d.min>=0&&d.min<=d.max&&d.max<=1)}});
test('global search supports weapon names and collections independently of team',()=>{assert(filter({query:'ak-47 inheritance'}).some(s=>s.weapon==='AK-47'&&s.name==='Inheritance'));assert(filter({query:'The Norse Collection'}).length);assert.equal(filter({query:'no-existe-esta-skin'}).length,0)});
test('rarity, variants, wear and float filters compose',()=>{const result=filter({category:'Rifles',rarities:['Covert'],variant:'stattrak',wear:'Factory New',min:0,max:.07});assert(result.length);for(const s of result){const d=details[s.id];assert.equal(models.find(m=>m.name===s.weapon).category,'Rifles');assert.equal(d.rarity,'Covert');assert(d.stattrak);assert(d.wears.includes('Factory New'));assert(d.min<=.07)}assert.equal(filter({min:.8,max:.2}).length,0)});
test('ordering and source coverage remain deterministic',()=>{const asc=filter({weapon:'AWP'}),desc=filter({weapon:'AWP',sort:'name-desc'});assert.deepEqual(desc.map(s=>s.id),asc.map(s=>s.id).reverse());assert.equal(filter({weapon:'USP-S'}).length,models.find(m=>m.name==='USP-S').count)});
