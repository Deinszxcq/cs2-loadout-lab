export const TTL=30*60*1000;
export function cardSelections(items,ids,wear='',variant='normal',allWears=false){
 if(!Array.isArray(ids)||ids.length<1||ids.length>36||ids.some(id=>typeof id!=='string'))throw Error('invalid_batch');
 return [...new Set(ids)].sort().flatMap(id=>{const item=items[id];if(!item)throw Error('invalid_selection');if(allWears)return (item.wears.length?item.wears:['']).map(w=>({skin:id,...marketSelection(items,id,w,variant)}));const selectedWear=wear||(item.wears.includes('Field-Tested')?'Field-Tested':item.wears[0]||'');return[{skin:id,...marketSelection(items,id,selectedWear,variant)}]});
}
export function batchQuoteRows(value,selections,now=Date.now()){
 if(!value?.data||Array.isArray(value.data)||typeof value.data!=='object')throw Error('invalid_batch_response');
 return selections.map(s=>({skin:s.skin,wear:s.wear,variant:s.variant,providers:['steam','csfloat'].map(provider=>{const base={provider,currency:'USD',link:marketLink(provider,s),observed_at:new Date(now).toISOString()};try{return{...base,...publicQuote({item:s.hash,prices:value.data[s.hash]||{}},provider,s,now)}}catch{return{...base,status:'unavailable',price:null,source_updated_at:null}}})}));
}
export function marketSelection(items,id,wear,variant='normal'){
 const item=items[id];if(!item||!['normal','stattrak','souvenir'].includes(variant)||variant!=='normal'&&!item[variant])throw Error('invalid_selection');
 if(item.wears.length?!item.wears.includes(wear):wear!=='')throw Error('invalid_wear');
 const prefix=variant==='stattrak'?'StatTrak™ ':variant==='souvenir'?'Souvenir ':'';
 const base=item.name.startsWith('★ ')?'★ '+prefix+item.name.slice(2):prefix+item.name;
 return{item,hash:base+(wear?' ('+wear+')':''),variant,wear};
}
export function marketLink(provider,selection){if(provider==='steam')return'https://steamcommunity.com/market/listings/730/'+encodeURIComponent(selection.hash);if(selection.item.agent)return'https://csfloat.com/search?market_hash_name='+encodeURIComponent(selection.hash);const bounds={'Factory New':[0,.07],'Minimal Wear':[.07,.15],'Field-Tested':[.15,.38],'Well-Worn':[.38,.45],'Battle-Scarred':[.45,1]}[selection.wear]||[0,1];const u=new URL('https://csfloat.com/search');u.search=new URLSearchParams({category:selection.variant==='normal'?'1':selection.variant==='stattrak'?'2':'3',sort_by:'lowest_price',min_float:String(bounds[0]),max_float:String(bounds[1]),def_index:String(selection.item.weapon),paint_index:String(selection.item.paint)}).toString();return u.href}
export function retainPreviousQuote(next,previous){return next.price===null&&!['ok','no_listing'].includes(next.status)&&previous?.status==='ok'?{...previous,warning:next.status}:next}
export function publicPriceURL(selection){const u=new URL('https://api.openskin.dev/v1/prices');u.searchParams.set('item',selection.hash);return u}
export function publicQuote(value,provider,selection,now=Date.now()){
 if(value?.item!==selection.hash)throw Error('mismatched_item');const source=value.prices?.[provider];if(!source)return{status:'no_listing',price:null,source_updated_at:null};if(source.currency!=='USD')throw Error('invalid_currency');let data=source;
 if(provider==='csfloat'&&selection.item.phase){data=source.patterns?.find(p=>p.pattern===selection.item.phase);if(!data)return{status:'phase_unavailable',price:null,source_updated_at:null};}
 const stamp=Date.parse(data.updated_at);if(!Number.isFinite(stamp)||stamp>now+5*60*1000)throw Error('invalid_source_date');
 const fields={source:'OpenSkin',source_url:'https://openskin.dev/',source_updated_at:new Date(stamp).toISOString()};if(data.ask===null||data.ask===undefined)return{...fields,status:'no_listing',price:null};if(typeof data.ask!=='number'||!Number.isFinite(data.ask)||data.ask<0)throw Error('invalid_price');const price=Math.round(data.ask*100);if(!Number.isSafeInteger(price))throw Error('invalid_price');
 return{...fields,status:'ok',price,...(now-stamp>(provider==='steam'?12:3)*60*60*1000?{warning:'source_stale'}:{})};
}
