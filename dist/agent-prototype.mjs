import {assignAgent} from './agent-selection.mjs';
import {ensureLayouts,assignSlot} from './loadout-layout.mjs';
export const PROTOTYPE_AGENT='agent-4732';
export const GLOVE_FINISHES=[{id:'skin-b05ee2bf4f0d',name:'Hedge Maze',texture:'sporty_green.webp'},{id:'skin-c1ae7186f829',name:'Vice',texture:'sporty_blue_pink.webp'}];
export function applyAgentPrototype(equipment,mode,finish,{agents,weapons,skins}){
 if(!['current','desired'].includes(mode)||!GLOVE_FINISHES.some(f=>f.id===finish)||!skins.some(s=>s.id===finish&&s.weapon==='Sport Gloves')||!agents.some(a=>a.id===PROTOTYPE_AGENT&&a.team==='T'))throw Error('Combinación 3D no disponible');
 const base=skins.find(s=>s.weapon==='Sport Gloves'&&s.vanilla);if(!base)throw Error('Faltan guantes predeterminados');
 assignAgent(equipment,'T',mode,PROTOTYPE_AGENT,agents);const layout=ensureLayouts(equipment,'T',weapons)[mode];assignSlot(layout,'gloves',0,'Sport Gloves');equipment['Sport Gloves']={current:base.id,desired:base.id,...equipment['Sport Gloves'],[mode]:finish};
}
