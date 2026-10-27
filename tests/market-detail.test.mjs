import test from 'node:test';import assert from 'node:assert/strict';
import {lowestQuote,wearRange} from '../dist/market-prices.mjs';
test('wear summaries use available quotes without inventing a zero for missing offers',()=>{
 assert.equal(lowestQuote([{price:null},{price:12000},{price:9100}]),9100);assert.equal(lowestQuote([{price:null}]),null);assert.equal(lowestQuote([{price:0},{price:2}]),0);assert.equal(lowestQuote([{price:-1},{price:Infinity}]),null);
});
test('wear ranges intersect the finish limits rather than implying unavailable floats',()=>{
 assert.equal(wearRange('Field-Tested',{min:.18,max:1}),'0.18 — 0.38');assert.equal(wearRange('Minimal Wear',{min:0,max:.08}),'0.07 — 0.08');assert.equal(wearRange(''),'Sin desgaste');
});
