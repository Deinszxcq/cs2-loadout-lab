const cache=new Map(),lifetime=30*60*1000;
const wears={'Factory New':'Recién fabricado','Minimal Wear':'Casi nuevo','Field-Tested':'Algo desgastado','Well-Worn':'Bastante desgastado','Battle-Scarred':'Deplorable'};
export function priceCacheKey(id,wear='',variant='normal'){return JSON.stringify([id,wear,variant])}
export function cardPriceLabel(quote){if(Number.isSafeInteger(quote?.price)&&quote.price>=0)return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(quote.price/100);return quote?.status==='phase_unavailable'?'Sin fase':quote?.status==='no_listing'?'Sin ofertas':'—'}
export function createCardPrices(root){
 let observer,queue=new Set(),visible=new Set(),flushTimer=null,running=false,generation=0;
 const keyFor=e=>priceCacheKey(e.dataset.priceSkin,e.dataset.priceWear,e.dataset.priceVariant);
 function fill(e,row){if(!e.isConnected)return;const label=(row.variant==='stattrak'?'StatTrak™':row.variant==='souvenir'?'Souvenir':'Normal')+' · '+(wears[row.wear]||'Sin desgaste');e.querySelector('.card-price-condition').textContent=label;
  for(const provider of ['steam','csfloat']){const quote=row.providers.find(p=>p.provider===provider),value=e.querySelector('[data-price-provider="'+provider+'"]');value.textContent=cardPriceLabel(quote);value.classList.toggle('price-missing',quote?.price==null);value.classList.toggle('price-stale',!!quote?.warning||!!quote?.stale);const stamp=quote?.source_updated_at&&new Date(quote.source_updated_at);value.title=stamp&&Number.isFinite(stamp.getTime())?'Origen: '+stamp.toLocaleString('es-EC')+(quote.warning?' · Dato anterior':''):'Sin cotización disponible';}
  e.dataset.priceLoaded='true';e.setAttribute('aria-label','Precios de mercado. '+label);
 }
 function schedule(e){const entry=cache.get(keyFor(e));if(entry){fill(e,entry.row);if(Date.now()<entry.expires)return}queue.add(e);clearTimeout(flushTimer);flushTimer=setTimeout(flush,180)}
 async function flush(){if(running||document.hidden||root.hidden)return;const entries=[...queue].filter(e=>e.isConnected&&visible.has(e));queue.clear();if(!entries.length)return;const first=entries[0],wear=first.dataset.priceWear,variant=first.dataset.priceVariant,group=entries.filter(e=>e.dataset.priceWear===wear&&e.dataset.priceVariant===variant).slice(0,36);for(const e of entries)if(!group.includes(e))queue.add(e);running=true;const version=generation;
  try{const response=await fetch(LOADOUT_CLOUD.url+'/functions/v1/market-prices',{method:'POST',headers:{'Content-Type':'application/json',apikey:LOADOUT_CLOUD.publishableKey},body:JSON.stringify({skins:[...new Set(group.map(e=>e.dataset.priceSkin))],wear,variant})});if(!response.ok)throw Error();const value=await response.json();if(!Array.isArray(value.items))throw Error();
   for(const e of group){const row=value.items.find(r=>r.skin===e.dataset.priceSkin);if(row){cache.set(keyFor(e),{row,expires:Date.now()+lifetime});fill(e,row)}else if(!value.retry_after){const old=cache.get(keyFor(e));fill(e,old?{...old.row,providers:old.row.providers.map(p=>({...p,warning:'unavailable'}))}:{wear:wear||'Field-Tested',variant,providers:[]})}}
   if(value.retry_after&&version===generation)setTimeout(()=>{for(const e of group)if(e.isConnected&&visible.has(e))schedule(e)},Math.min(30,Number(value.retry_after)+1)*1000);
  }catch{for(const e of group){const old=cache.get(keyFor(e));if(old)fill(e,{...old.row,providers:old.row.providers.map(p=>({...p,warning:'unavailable'}))});else if(e.isConnected){e.querySelectorAll('[data-price-provider]').forEach(n=>n.textContent='—');e.querySelector('.card-price-condition').textContent='Precio no disponible';}}}
  finally{running=false;if(queue.size)flushTimer=setTimeout(flush,250)}
 }
 const interval=setInterval(()=>{if(!document.hidden&&!root.hidden)for(const e of visible)schedule(e)},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!root.hidden)for(const e of visible)schedule(e)});
 return{observe(){generation++;observer?.disconnect();queue.clear();visible.clear();observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){visible.add(entry.target);schedule(entry.target)}else visible.delete(entry.target)}},{rootMargin:'120px'});root.querySelectorAll('.card-market-prices').forEach(e=>observer.observe(e))},dispose(){observer?.disconnect();clearInterval(interval);clearTimeout(flushTimer);queue.clear();visible.clear()}};
}
