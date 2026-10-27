import test from 'node:test';import assert from 'node:assert/strict';
import {summaryItems,summarizeQuotes} from '../dist/loadout-total.mjs';
const catalog=[{name:'USP-S',category:'Pistolas',teams:['CT']},{name:'P250',category:'Pistolas',teams:['CT','T']}],layout={pistols:['USP-S','P250'],mid:[],rifles:[],knife:['Bayonet'],gloves:['Sport Gloves'],zeus:['Zeus x27']};
const skins={'USP-S':{id:'usp',name:'Skin'},P250:{id:'base',vanilla:true},Bayonet:{id:'knife',name:'Knife'},'Sport Gloves':{id:'gloves',name:'Gloves'},'Zeus x27':{id:'zeus-base',vanilla:true}},agent={id:'agent',team:'CT',name:'Agent'};
test('summary includes only active finishes and selected agent with the saved wear and variant',()=>{
 const equipment={'USP-S':{currentWear:'Factory New',currentVariant:'stattrak'},__agent:{current:'agent'},__disabled:{current:['Sport Gloves'],desired:[]}},details={usp:{wears:['Factory New','Field-Tested'],stattrak:true},knife:{wears:['Factory New']}};
 const rows=summaryItems({equipment,team:'CT',mode:'current',catalog,layout,agents:[agent],details,skinFor:w=>skins[w]});assert.deepEqual(rows.map(r=>r.skin.id),['usp','knife','agent']);assert.equal(rows[0].wear,'Factory New');assert.equal(rows[0].variant,'stattrak');assert.equal(rows[2].wear,'');
 const desired=summaryItems({equipment,team:'CT',mode:'desired',catalog,layout,agents:[agent],details,skinFor:w=>skins[w]});assert(desired.some(r=>r.skin.id==='gloves'));assert(!desired.some(r=>r.skin.id==='agent'));
});
test('totals use integer cents, count missing and pending separately, and never treat unknown prices as zero',()=>{
 const rows=[{market:'steam',loaded:true,price:101},{market:'steam',loaded:true,price:209,stale:true},{market:'steam',loaded:true,price:null},{market:'steam',loaded:false},{market:'csfloat',loaded:true,price:999}];const total=summarizeQuotes(rows,'steam');assert.equal(total.cents,310);assert.equal(total.priced,2);assert.equal(total.missing,1);assert.equal(total.pending,2);assert.equal(total.stale,1);assert(total.partial);assert.equal(summarizeQuotes([],'steam').partial,false);assert.equal(summarizeQuotes([],'steam').cents,0);
});
test('shared items count once per team and combined sums both loadouts',()=>{
 const rows=[{team:'CT',market:'csfloat',loaded:true,price:1050},{team:'T',market:'csfloat',loaded:true,price:1050}];assert.equal(summarizeQuotes(rows.filter(r=>r.team==='CT'),'csfloat').cents,1050);assert.equal(summarizeQuotes(rows,'csfloat').cents,2100);assert(!summarizeQuotes(rows,'csfloat').partial);
});
