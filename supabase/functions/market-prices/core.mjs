export const TTL=30*60*1000;
export function marketSelection(items,id,wear,variant='normal'){
 const item=items[id];if(!item||!['normal','stattrak','souvenir'].includes(variant)||variant!=='normal'&&!item[variant])throw Error('invalid_selection');
 if(item.wears.length?!item.wears.includes(wear):wear!=='')throw Error('invalid_wear');
 const prefix=variant==='stattrak'?'StatTrak™ ':variant==='souvenir'?'Souvenir ':'';
 const base=item.name.startsWith('★ ')?'★ '+prefix+item.name.slice(2):prefix+item.name;
 return{item,hash:base+(wear?' ('+wear+')':''),variant};
}
export function parseSteamPrice(text){if(typeof text!=='string')return null;const value=text.replace(/\s*USD\s*$/,'').replace(/^\$/,'').trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?$/.test(value))return null;const cents=Math.round(Number(value.replaceAll(',',''))*100);return Number.isSafeInteger(cents)&&cents>=0?cents:null}
export function steamQuote(value){const price=value?.success===true?parseSteamPrice(value.lowest_price):null;return price===null?{status:'no_listing',price:null}:{status:'ok',price,volume24h:typeof value.volume==='string'?value.volume:null}}
export function csfloatQuote(value,selection){const list=Array.isArray(value)?value:value?.data;if(!Array.isArray(list))throw Error('invalid_response');if(!list.length)return{status:'no_listing',price:null};const listing=list[0];if(listing.item?.market_hash_name!==selection.hash||Number(listing.item?.paint_index)!==selection.item.paint||!Number.isSafeInteger(listing.price)||listing.price<0)throw Error('mismatched_listing');return{status:'ok',price:listing.price}}
export function providerURL(provider,selection){if(provider==='steam'){const url=new URL('https://steamcommunity.com/market/priceoverview/');url.search=new URLSearchParams({appid:'730',currency:'1',country:'US',l:'english',market_hash_name:selection.hash}).toString();return url}const url=new URL('https://csfloat.com/api/v1/listings');url.search=new URLSearchParams({limit:'1',sort_by:'lowest_price',type:'buy_now',market_hash_name:selection.hash,paint_index:String(selection.item.paint),def_index:String(selection.item.weapon),category:selection.variant==='normal'?'1':selection.variant==='stattrak'?'2':'3'}).toString();return url}
export const marketLink=(provider,hash)=>provider==='steam'?'https://steamcommunity.com/market/listings/730/'+encodeURIComponent(hash):'https://csfloat.com/';
export function retainPreviousQuote(next,previous){return next.price===null&&!['ok','no_listing'].includes(next.status)&&previous?.status==='ok'?{...previous,warning:next.status}:next}
