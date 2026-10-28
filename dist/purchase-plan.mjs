import {summaryItems} from './loadout-total.mjs';
import {savedCondition} from './equipment-options.mjs';
import {selectedAgent} from './agent-selection.mjs';
// Unselected preview defaults are not purchase intentions. Disabled current items
// still belong to the owner and can satisfy an exact desired item.
export function purchaseItems(options){
 const {equipment,team,agents,details,skinFor}=options;
 return summaryItems({...options,mode:'desired',skinFor:w=>skinFor(w,'desired')})
 .filter(item=>item.weapon==='Agente'?equipment.__agent?.desired===item.skin.id:equipment[item.weapon]?.desired===item.skin.id)
 .map(item=>{const skin=item.weapon==='Agente'?selectedAgent(equipment,team,'current',agents):skinFor(item.weapon,'current');
 const current=skin&&!skin.vanilla?{skin,...(item.weapon==='Agente'?{wear:'',variant:'normal'}:savedCondition(equipment,skin.weapon||item.weapon,'current',details[skin.id]))}:null;
 return {...item,current,owned:!!current&&current.skin.id===item.skin.id&&current.wear===item.wear&&current.variant===item.variant};});
}
