import test from 'node:test';
import assert from 'node:assert/strict';
import {cardSelections,batchQuoteRows} from '../supabase/functions/market-prices/core.mjs';
import {cardPriceLabel,priceCacheKey} from '../dist/card-prices.mjs';
const items={a:{name:'AWP | Example',wears:['Factory New','Field-Tested'],stattrak:true,weapon:9,paint:1},b:{name:'★ Bayonet | Doppler',wears:['Factory New'],phase:'Ruby',weapon:500,paint:415}};
test('card quotes deduplicate IDs, use available wear and reject arbitrary batches',()=>{
 const rows=cardSelections(items,['b','a','a']);assert.deepEqual(rows.map(r=>[r.skin,r.wear]),[['a','Field-Tested'],['b','Factory New']]);
 for(const ids of [[],Array(37).fill('a'),['unknown'],[null]])assert.throws(()=>cardSelections(items,ids));
 assert.throws(()=>cardSelections(items,['b'],'Field-Tested'));assert.throws(()=>cardSelections(items,['b'],'','souvenir'));
 assert.notEqual(priceCacheKey('a','','normal'),priceCacheKey('a','','stattrak'));
});
test('batch prices preserve exact phases and isolate a malformed marketplace quote',()=>{
 const now=Date.parse('2026-10-27T06:00:00Z'),stamp='2026-10-27T05:00:00Z',selections=cardSelections(items,['a','b']);
 const rows=batchQuoteRows({data:{[selections[0].hash]:{steam:{ask:10,currency:'USD',updated_at:stamp},csfloat:{ask:-1,currency:'USD',updated_at:stamp}},[selections[1].hash]:{csfloat:{ask:300,currency:'USD',updated_at:stamp,patterns:[{pattern:'Ruby',ask:1400,updated_at:stamp}]}}}},selections,now);
 assert.equal(rows[0].providers[0].price,1000);assert.equal(rows[0].providers[1].status,'unavailable');assert.equal(rows[1].providers[1].price,140000);assert.equal(rows[1].providers[0].status,'no_listing');assert.throws(()=>batchQuoteRows({},selections));
});
test('card currency formatting never turns missing data into a zero price',()=>{
 assert.match(cardPriceLabel({price:12345}),/123[,.]45/);assert.match(cardPriceLabel({price:0}),/0[,.]00/);assert.equal(cardPriceLabel({price:null}),'—');assert.equal(cardPriceLabel({status:'no_listing'}),'Sin ofertas');
});
test('all-wear batches request only real conditions and preserve the chosen variant',()=>{
 const rows=cardSelections(items,['a'],'','stattrak',true);assert.deepEqual(rows.map(r=>r.wear),items.a.wears);assert(rows.every(r=>r.hash.startsWith('StatTrak™ AWP')));assert.equal(rows.length,2);
 const agent={name:'Agent | Squad',wears:[],agent:true};const selection=cardSelections({agent},['agent'],'','normal',true);assert.equal(selection.length,1);assert.equal(selection[0].hash,'Agent | Squad');assert.equal(selection[0].wear,'');
});
