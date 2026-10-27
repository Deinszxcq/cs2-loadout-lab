import {overviewWeapons} from './overview-catalog.mjs';
import {savedCondition,weaponEnabled} from './equipment-options.mjs';
import {selectedAgent} from './agent-selection.mjs';
export function summaryItems({equipment,team,mode,catalog,layout,agents,details,skinFor}){
 const names=[...Object.values(overviewWeapons(catalog,team,layout)).flat(),...['knife','gloves','zeus'].flatMap(g=>layout[g]||[])],items=[];
 for(const weapon of new Set(names)){if(!weaponEnabled(equipment,weapon,mode))continue;const skin=skinFor(weapon);if(!skin||skin.vanilla)continue;items.push({team,weapon,skin,...savedCondition(equipment,weapon,mode,details[skin.id])})}
 const agent=selectedAgent(equipment,team,mode,agents);if(agent)items.push({team,weapon:'Agente',skin:agent,wear:'',variant:'normal'});return items;
}
export function summarizeQuotes(rows,market){const result={cents:0,priced:0,missing:0,pending:0,stale:0,items:rows.length};for(const row of rows){if(row.market!==market||!row.loaded){result.pending++;continue}if(!Number.isSafeInteger(row.price)||row.price<0||!Number.isSafeInteger(result.cents+row.price)){result.missing++;continue}result.cents+=row.price;result.priced++;if(row.stale)result.stale++}return{...result,partial:result.pending>0||result.missing>0}}
