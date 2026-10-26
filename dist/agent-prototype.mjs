import {assignAgent} from './agent-selection.mjs';
import {ensureLayouts,assignSlot} from './loadout-layout.mjs';
export function applyAgentEquipment(equipment,team,mode,agentId,finish,{agents,weapons,skins,assets}){
 const agent=agents.find(a=>a.id===agentId&&a.team===team),paint=assets.finishes[finish],skin=skins.find(s=>s.id===finish&&s.weapon===paint?.family);
 if(!['CT','T'].includes(team)||!['current','desired'].includes(mode)||!agent||assets.agents[agentId]?.team!==team||!paint||!skin||!assets.families[paint.family])throw Error('Combinación 3D no disponible');
 const base=skins.find(s=>s.weapon===paint.family&&s.vanilla);if(!base)throw Error('Faltan guantes predeterminados');
 const wish=skins.filter(s=>s.weapon===paint.family&&!s.vanilla).sort((a,b)=>a.name.localeCompare(b.name))[0]||base;
 assignAgent(equipment,team,mode,agentId,agents);const layout=ensureLayouts(equipment,team,weapons)[mode];assignSlot(layout,'gloves',0,paint.family);equipment[paint.family]={current:base.id,desired:wish.id,...equipment[paint.family],[mode]:finish};
}
