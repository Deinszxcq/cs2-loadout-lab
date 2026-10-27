import {TTL,marketSelection,publicPriceURL,publicQuote,marketLink,retainPreviousQuote,cardSelections,batchQuoteRows} from './core.mjs';
const origins=new Set(['https://deinszxcq.github.io','http://localhost:4173','http://127.0.0.1:4173']);
const envObject=(name:string)=>{try{return JSON.parse(Deno.env.get(name)||'{}')}catch{return {}}};
const projectURL=Deno.env.get('SUPABASE_URL')!;
const adminKey=envObject('SUPABASE_SECRET_KEYS').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminHeaders:Record<string,string>={apikey:adminKey,'Content-Type':'application/json'};
if(!adminKey.startsWith('sb_secret_'))adminHeaders.Authorization='Bearer '+adminKey;
const publicKeys=new Set([...Object.values(envObject('SUPABASE_PUBLISHABLE_KEYS')),Deno.env.get('SUPABASE_ANON_KEY')].filter(Boolean));
let catalog:any=null,catalogAt=0,catalogLoading:Promise<any>|null=null;
async function items(){if(catalog&&Date.now()-catalogAt<6*60*60*1000)return catalog;if(!catalogLoading)catalogLoading=(async()=>{try{const r=await fetch('https://deinszxcq.github.io/cs2-loadout-lab/market-items.json',{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('catalog_unavailable');const value=await r.json();if(!value||typeof value!=='object'||Object.keys(value).length<100)throw Error('catalog_unavailable');catalog=value;catalogAt=Date.now();return value}finally{catalogLoading=null}})();return catalogLoading}
async function database(path:string,method:string,body?:unknown,prefer=''){const r=await fetch(projectURL+'/rest/v1/'+path,{method,headers:{...adminHeaders,...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('cache_unavailable');const text=await r.text();return text?JSON.parse(text):null}
async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function quoteKey(provider:string,selection:any){return provider+':'+await digest('openskin-v1|'+selection.hash+(provider==='csfloat'?'|'+selection.item.paint:''))}
async function cards(selections:any[]){
 const key='csfloat:'+await digest('cards-v1|'+JSON.stringify(selections.map(s=>[s.skin,s.wear,s.variant])));
 const lease=await database('rpc/claim_market_quote','POST',{p_key:key,p_provider:'csfloat'});
 if(!lease.fetch)return{...(lease.cached||{items:[]}),cached:!!lease.cached,retry_after:lease.retry_after};
 let result:any;let delay=TTL;const now=new Date().toISOString();
 try{
  const r=await fetch('https://api.openskin.dev/v1/prices/batch',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:[...new Set(selections.map(s=>s.hash))]}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('upstream_unavailable');const rows=batchQuoteRows(await r.json(),selections);result={items:rows};
  const warm=await Promise.all(rows.flatMap((row:any,index:number)=>row.providers.filter((p:any)=>['ok','no_listing','phase_unavailable'].includes(p.status)).map(async(p:any)=>({key:await quoteKey(p.provider,selections[index]),provider:p.provider,data:p,checked_at:now,expires_at:new Date(Date.now()+TTL).toISOString(),lease_until:now}))));
  if(warm.length)await database('market_quote_cache?on_conflict=key','POST',[...new Map(warm.map(row=>[row.key,row])).values()],'resolution=merge-duplicates');
 }catch{delay=2*60*1000;result=lease.cached?.items?.length?{items:lease.cached.items.map((row:any)=>({...row,providers:row.providers.map((p:any)=>({...p,warning:'unavailable',stale:true}))}))}:{items:[],error:'temporarily_unavailable'}}
 await database('market_quote_cache?key=eq.'+key,'PATCH',{data:result,checked_at:now,expires_at:new Date(Date.now()+delay).toISOString(),lease_until:now});
 return{...result,cached:false};
}
async function quote(provider:string,selection:any,loadPrices:()=>Promise<any>){
 const base={provider,currency:'USD',link:marketLink(provider,selection)};
 const key=await quoteKey(provider,selection);
 const lease=await database('rpc/claim_market_quote','POST',{p_key:key,p_provider:provider});
 if(!lease.fetch)return{...base,...(lease.cached||{status:'busy',price:null,observed_at:null}),cached:!!lease.cached,stale:!!lease.cached&&(!!lease.retry_after||!!lease.cached.warning),retry_after:lease.retry_after};
 let result:any;let delay=TTL;
 try{const value=await loadPrices();result={...publicQuote(value,provider,selection),observed_at:new Date().toISOString()};}
 catch(e){const rateLimited=e instanceof Error&&e.message==='rate_limited';result={status:rateLimited?'rate_limited':'unavailable',price:null,observed_at:null};delay=rateLimited?5*60*1000:2*60*1000;if(rateLimited)await database('market_provider_limits?provider=eq.'+provider,'PATCH',{next_at:new Date(Date.now()+delay).toISOString()});}
 result=retainPreviousQuote(result,lease.cached);
 await database('market_quote_cache?key=eq.'+key,'PATCH',{data:result,checked_at:new Date().toISOString(),expires_at:new Date(Date.now()+delay).toISOString(),lease_until:new Date().toISOString()});
 return{...base,...result,cached:false,stale:!!result.warning};
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),cors:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
 if(origin&&origins.has(origin))cors['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 if(origin&&!origins.has(origin))return reply({error:'origin_not_allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 // verify_jwt is disabled only because this function validates project API keys itself.
 // This public market-data endpoint never accepts profile IDs or reads user tables.
 if(!publicKeys.has(req.headers.get('apikey')||''))return reply({error:'invalid_api_key'},401);
 if(Number(req.headers.get('content-length')||0)>2048)return reply({error:'invalid_request'},400);
 try{const raw=await req.text();if(raw.length>2048)return reply({error:'invalid_request'},400);let input;try{input=JSON.parse(raw)}catch{return reply({error:'invalid_request'},400)}
  const catalog=await items();
  if(input.skins!==undefined){let selections;try{selections=cardSelections(catalog,input.skins,input.wear||'',input.variant||'normal')}catch{return reply({error:'invalid_selection'},400)}return reply(await cards(selections));}
  let selection;try{selection=marketSelection(catalog,input.skin,input.wear,input.variant)}catch{return reply({error:'invalid_selection'},400)}
  let priceFetch:Promise<any>|null=null;const loadPrices=()=>priceFetch??=(async()=>{const r=await fetch(publicPriceURL(selection),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(r.status===429?'rate_limited':'upstream_unavailable');return r.json()})();
  const providers=await Promise.all(['steam','csfloat'].map(async provider=>{try{return await quote(provider,selection,loadPrices)}catch{return{provider,currency:'USD',status:'unavailable',price:null,observed_at:null,link:marketLink(provider,selection)}}}));
  return reply({market_hash_name:selection.hash,phase:selection.item.phase,refresh_minutes:30,providers});
 }catch{return reply({error:'temporarily_unavailable'},503)}
});
