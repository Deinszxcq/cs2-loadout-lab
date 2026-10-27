export const wearLabels={'Factory New':'Recién fabricado','Minimal Wear':'Casi nuevo','Field-Tested':'Algo desgastado','Well-Worn':'Bastante desgastado','Battle-Scarred':'Deplorable'};
export function validCondition(detail={},wear,variant='normal'){
 const wears=detail.wears||[],selected=wears.includes(wear)?wear:wears.includes('Field-Tested')?'Field-Tested':wears[0]||'';
 return{wear:selected,variant:['normal','stattrak','souvenir'].includes(variant)&&(variant==='normal'||detail[variant])?variant:'normal'};
}
export function savedCondition(equipment,weapon,mode,detail){const pair=equipment[weapon]||{};return validCondition(detail,pair[mode+'Wear'],pair[mode+'Variant'])}
export function setCondition(equipment,weapon,mode,detail,wear,variant){if(!['current','desired'].includes(mode))throw Error('Invalid mode');const value=validCondition(detail,wear,variant);equipment[weapon]={...(equipment[weapon]||{}),[mode+'Wear']:value.wear,[mode+'Variant']:value.variant};return value}
export function weaponEnabled(equipment,weapon,mode){return !(equipment.__disabled?.[mode]||[]).includes(weapon)}
export function setWeaponEnabled(equipment,weapon,mode,enabled){if(!['current','desired'].includes(mode))throw Error('Invalid mode');const hidden=new Set(equipment.__disabled?.[mode]||[]);if(enabled)hidden.delete(weapon);else hidden.add(weapon);equipment.__disabled={...equipment.__disabled,[mode]:[...hidden]}}
