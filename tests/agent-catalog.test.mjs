import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {filterAgents} from '../dist/agent-catalog.mjs';
const agents=JSON.parse(fs.readFileSync(new URL('../dist/agents.json',import.meta.url),'utf8'));
test('agent catalog separates all agents by their actual team and composes search',()=>{
 const ct=filterAgents(agents,'CT'),tt=filterAgents(agents,'T');assert.equal(ct.length+tt.length,agents.length);assert(ct.length>0&&tt.length>0);assert(ct.every(a=>a.team==='CT'));assert(tt.every(a=>a.team==='T'));assert(filterAgents(agents,'CT','1st Lieutenant Farlow').length===1);assert.equal(filterAgents(agents,'T','farlow').length,0);assert.equal(filterAgents(agents,'','nonexistent agent').length,0);
});
