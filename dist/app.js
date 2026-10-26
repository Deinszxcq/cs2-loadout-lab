const $=s=>document.querySelector(s);let data=[],weaponCatalog=[],skinIndex=new Map(),skinGroups=new Map(),team='CT',weapon='USP-S',mode='desired',category='Todas',state={CT:{},T:{}},sets=[];
const cloud=supabase.createClient(LOADOUT_CLOUD.url,LOADOUT_CLOUD.publishableKey,{auth:{flowType:'pkce'}});
let user=null,accountReady=false,accountEpoch=0,saveQueue=Promise.resolve(),unsynced=false,catalogReady=false,writeRevision=0;
const status=(message,error=false)=>{$('#syncStatus').textContent=message;$('#syncStatus').dataset.error=error};
const emptyState=()=>({CT:{},T:{}});
function readGuest(){try{const s=JSON.parse(localStorage.getItem('loadout-lab-v1')||'null');return {state:s?.state?.CT&&s?.state?.T?s.state:emptyState(),sets:Array.isArray(s?.sets)?s.sets:[]}}catch{return {state:emptyState(),sets:[]}}}
function persist(){
  $('#count').textContent=sets.length;
  if(!user){try{localStorage.setItem('loadout-lab-v1',JSON.stringify({state,sets}));return true}catch{toast('No se pudo guardar en este navegador.');return false}}
  if(!accountReady)return false;
  const owner=user.id,epoch=accountEpoch,revision=++writeRevision,equipment=JSON.parse(JSON.stringify(state));
  unsynced=true;status('Guardando en tu cuenta…');
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    if(epoch!==accountEpoch||user?.id!==owner)return;
    const {error}=await cloud.from('loadout_profiles').upsert({user_id:owner,equipment,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;
  }).then(()=>{if(epoch===accountEpoch&&revision===writeRevision){unsynced=false;status('Guardado en tu cuenta')}}).catch(()=>{if(epoch===accountEpoch&&revision===writeRevision){unsynced=true;status('Sin sincronizar · Reintenta',true);toast('No se pudo guardar en la nube. Conservamos los cambios en esta pestaña.')}});
  return true;
}
const toast=t=>{$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3200)};
const categoryOrder=['Todas','Pistolas','Rifles','Subfusiles','Pesadas','Cuchillos','Guantes','Equipo'];
const weapons=()=>weaponCatalog.filter(w=>w.teams.includes(team)).map(w=>w.name).sort((a,b)=>{
  const first=team==='CT'?'USP-S':'Glock-18';return a===first?-1:b===first?1:0;
});
const cat=w=>weaponCatalog.find(x=>x.name===w)?.category;
const skins=w=>skinGroups.get(w)||[];
const defaultPair=w=>{const list=skins(w),base=list.find(s=>s.vanilla)||list[0],finish=list.find(s=>!s.vanilla)||base;return {current:base.id,desired:finish.id}};
const selection=()=>{
  const defaults=defaultPair(weapon),pair=state[team][weapon]||{};
  for(const mode of ['current','desired'])if(skinIndex.get(pair[mode])?.weapon!==weapon)pair[mode]=defaults[mode];
  state[team][weapon]=pair;return pair;
};
function imageFor(img,src,lazy=false){img.loading=lazy?'lazy':'eager';img.decoding='async';img.onerror=()=>{img.onerror=null;img.src='assets/image-unavailable.svg'};img.src=src}
function render(){
  if(!catalogReady)return;
  document.querySelectorAll('[data-team]').forEach(b=>b.classList.toggle('selected',b.dataset.team===team));
  $('#teamTitle').textContent=team==='CT'?'CONTRATERRORISTAS':'TERRORISTAS';$('#agentTitle').textContent=team==='CT'?'NSWC SEAL':'THE PROFESSIONALS';$('#agentImg').src='assets/agent-'+team.toLowerCase()+'.png';$('#teamBadge').textContent=team;
  const query=$('#weaponSearch').value.trim().toLowerCase();
  const visible=weapons().filter(w=>(category==='Todas'||cat(w)===category)&&w.toLowerCase().includes(query));
  $('#weaponCount').textContent=visible.length+' / '+weapons().length;
  $('#categories').replaceChildren(...categoryOrder.map(c=>{const b=document.createElement('button');b.textContent=c;b.classList.toggle('selected',category===c);b.onclick=()=>{category=c;$('#weaponSearch').value='';const available=weapons().filter(w=>c==='Todas'||cat(w)===c);if(!available.includes(weapon)&&available.length){weapon=available[0];$('#search').value=''}render()};return b}));
  $('#weapons').replaceChildren(...visible.map(w=>{
    const b=document.createElement('button');b.className='weapon'+(w===weapon?' active':'');
    const pair=state[team][w],s=skinIndex.get(pair?.desired)||skinIndex.get(defaultPair(w).desired);
    const img=document.createElement('img');img.alt='';imageFor(img,s.image,true);
    const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=w;small.textContent=s.name;text.append(strong,small);b.append(img,text);
    b.onclick=()=>{weapon=w;$('#search').value='';render();$('#skins').scrollTop=0};return b;
  }));
  if(!visible.length){const p=document.createElement('p');p.className='empty';p.textContent='No se encontraron armas.';$('#weapons').append(p)}
  const pair=selection();$('#compareTitle').textContent=weapon;
  for(const m of ['current','desired']){const skin=skinIndex.get(pair[m]);imageFor($('#'+m+'Img'),skin.image);$('#'+m+'Name').textContent=skin.name}
  const metadata=weaponCatalog.find(w=>w.name===weapon);$('#pricempireLink').href=metadata.pricempire;$('#pricempireLink').textContent='Ver '+weapon+' en Pricempire ↗';
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));renderSkins();$('#count').textContent=sets.length;
}
function renderSkins(){
  if(!catalogReady)return;
  const pair=selection(),list=skins(weapon).filter(s=>s.name.toLowerCase().includes($('#search').value.trim().toLowerCase()));$('#skinCount').textContent=list.length;
  $('#skins').replaceChildren(...list.map(s=>{
    const b=document.createElement('button');b.className='skin'+(pair[mode]===s.id?' picked':'');b.style.setProperty('--rarity',s.color);b.setAttribute('aria-label','Elegir '+s.name);b.setAttribute('aria-pressed',pair[mode]===s.id);b.title=s.name;
    const img=document.createElement('img');img.alt=s.name;imageFor(img,s.image,true);const label=document.createElement('span');label.textContent=s.name;b.append(img,label);
    if(pair[mode]===s.id){const small=document.createElement('small');small.textContent='✓ ELEGIDA';b.append(small)}
    b.onclick=()=>{const position=$('#skins').scrollTop;pair[mode]=s.id;persist();render();$('#skins').scrollTop=position};return b;
  }));
  if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='No hay skins con ese nombre.';$('#skins').append(p)}
}
function showSaved(){ $('.workspace').hidden=true;$('#savedPanel').hidden=false;$('#equip').classList.remove('active');$('#saved').classList.add('active');$('#sets').replaceChildren();if(!sets.length){const p=document.createElement('p');p.className='empty';p.textContent='Todavía no has guardado conjuntos. Arma tu primera combinación y pulsa «Guardar conjunto».';$('#sets').append(p)}sets.forEach(set=>{const row=document.createElement('article');row.className='set';const info=document.createElement('div'),title=document.createElement('h3'),small=document.createElement('small');title.textContent=set.name;small.textContent=`${set.team} · ${Object.keys(set.loadout).length} elementos · ${new Date(set.date).toLocaleDateString('es')}`;info.append(title,small);const load=document.createElement('button');load.textContent='Cargar conjunto';load.onclick=()=>{team=set.team;state[team]=JSON.parse(JSON.stringify(set.loadout));weapon=weapons()[0];category='Todas';$('#weaponSearch').value='';$('#search').value='';persist();showEquipment();toast('Conjunto cargado')};const remove=document.createElement('button');remove.textContent='Eliminar';remove.onclick=()=>deleteSet(set,remove);row.append(info,load,remove);$('#sets').append(row)})}
function showEquipment(){$('.workspace').hidden=false;$('#savedPanel').hidden=true;$('#equip').classList.add('active');$('#saved').classList.remove('active');render()}
document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{team=b.dataset.team;weapon=weapons()[0];category='Todas';$('#weaponSearch').value='';$('#search').value='';render();persist()});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render()});$('#search').oninput=renderSkins;$('#weaponSearch').oninput=render;$('#saved').onclick=showSaved;$('#equip').onclick=showEquipment;
$('#save').onclick=()=>{$('#setName').value='';$('#saveDialog').showModal();$('#setName').focus()};
$('#cancel').onclick=()=>$('#saveDialog').close();
$('#saveForm').onsubmit=async e=>{
  e.preventDefault();const name=$('#setName').value.trim();if(!name)return;
  const submit=$('#saveForm .primary');submit.disabled=true;
  const owner=user?.id,epoch=accountEpoch;
  try{
    if(user&&!accountReady)throw Error('Espera a que se cargue tu cuenta.');
    const oldWeapon=weapon;for(const w of weapons()){weapon=w;selection()}weapon=oldWeapon;
    const set={id:crypto.randomUUID(),name,team,date:Date.now(),loadout:JSON.parse(JSON.stringify(state[team]))};
    if(user){const {error}=await cloud.from('loadout_sets').insert({id:set.id,user_id:owner,name,team,equipment:set.loadout,created_at:new Date(set.date).toISOString()});if(error)throw error;if(epoch!==accountEpoch)return;}
    sets.unshift(set);const ok=persist();$('#saveDialog').close();
    if(ok)toast(user?'Conjunto guardado en tu cuenta':'Conjunto guardado en este navegador');
    if(!$('#savedPanel').hidden)showSaved();
  }catch{toast('No se pudo guardar el conjunto. Inténtalo de nuevo.')}finally{submit.disabled=false}
};
Promise.all(['skins.json','weapons.json'].map(async file=>{const r=await fetch(file);if(!r.ok)throw Error();return r.json()})).then(([items,models])=>{
  data=items;weaponCatalog=models;skinIndex=new Map(data.map(s=>[s.id,s]));
  for(const skin of data){if(!skinGroups.has(skin.weapon))skinGroups.set(skin.weapon,[]);skinGroups.get(skin.weapon).push(skin)}
  for(const list of skinGroups.values())list.sort((a,b)=>Number(!!b.vanilla)-Number(!!a.vanilla)||a.name.localeCompare(b.name));
  catalogReady=true;render();lockEquipment(!accountReady);
}).catch(()=>{toast('No se pudo cargar el catálogo. Recarga la página.');$('#save').disabled=true});


async function deleteSet(set,button){
  const epoch=accountEpoch;button.disabled=true;
  try{
    if(user){if(!accountReady)throw Error();const {error}=await cloud.from('loadout_sets').delete().eq('id',set.id).eq('user_id',user.id);if(error)throw error;if(epoch!==accountEpoch)return}
    sets=sets.filter(s=>s.id!==set.id);persist();showSaved();toast('Conjunto eliminado');
  }catch{toast('No se pudo eliminar el conjunto. Inténtalo de nuevo.');button.disabled=false}
}

function lockEquipment(locked){$('.workspace').inert=locked;$('#savedPanel').inert=locked;$('#save').disabled=locked||!catalogReady}
async function loadAccount(nextUser,force=false){
  if(!force&&nextUser?.id===user?.id&&accountReady)return;
  const epoch=++accountEpoch;accountReady=false;user=nextUser||null;unsynced=false;
  state=emptyState();sets=[];team='CT';weapon='USP-S';category='Todas';$('#weaponSearch').value='';$('#search').value='';
  if($('#saveDialog').open)$('#saveDialog').close();
  $('#accountButton').textContent=user?'Mi cuenta':'Iniciar sesión';
  $('#accountEmail').textContent=user?.email||'';$('#accountMessage').textContent='';
  if(!user){const guest=readGuest();state=guest.state;sets=guest.sets;accountReady=true;status('Guardado local · Sin cuenta');lockEquipment(false);if(catalogReady)showEquipment();return}
  lockEquipment(true);status('Cargando tu cuenta…');if(catalogReady)showEquipment();
  try{
    const owner=user.id;
    const [profile,collection]=await Promise.all([
      cloud.from('loadout_profiles').select('equipment').eq('user_id',owner).maybeSingle(),
      cloud.from('loadout_sets').select('id,name,team,equipment,created_at').eq('user_id',owner).order('created_at',{ascending:false})
    ]);
    if(profile.error||collection.error)throw Error();if(epoch!==accountEpoch)return;
    const equipment=profile.data?.equipment;state=equipment?.CT&&equipment?.T?equipment:emptyState();
    sets=collection.data.map(s=>({id:s.id,name:s.name,team:s.team,loadout:s.equipment,date:Date.parse(s.created_at)}));
    accountReady=true;lockEquipment(false);status('Guardado en tu cuenta');if(catalogReady)showEquipment();
  }catch{if(epoch===accountEpoch){status('No se pudo cargar · Reintenta',true);$('#accountMessage').textContent='No pudimos cargar tus datos. Usa «Volver a cargar desde la nube».';toast('No se pudo cargar tu cuenta. Reintenta desde «Mi cuenta».')}}
}

function openAuth(){$('#authSubmit').disabled=false;$('#authMessage').textContent='';$('#authDialog').showModal()}
$('#accountButton').onclick=()=>{if(user)$('#accountDialog').showModal();else openAuth()};
$('#authCancel').onclick=()=>$('#authDialog').close();
$('#authForm').onsubmit=async e=>{
  e.preventDefault();const button=$('#authSubmit');button.disabled=true;$('#authMessage').textContent='Abriendo GitHub…';
  try{
    const {error}=await cloud.auth.signInWithOAuth({provider:'github',options:{redirectTo:new URL('./',location.href).href}});
    if(error)throw error;
  }catch{$('#authMessage').textContent='No se pudo iniciar el acceso con GitHub. Inténtalo de nuevo.';button.disabled=false}
};
$('#accountClose').onclick=()=>$('#accountDialog').close();
$('#retryCloud').onclick=async()=>{if(!user)return;if(unsynced){persist();await saveQueue;if(unsynced){$('#accountMessage').textContent='No pudimos sincronizar. Revisa tu conexión y reintenta.';return}}await loadAccount(user,true)};
$('#logout').onclick=async()=>{
  const button=$('#logout');button.disabled=true;
  try{await saveQueue;if(unsynced){$('#accountMessage').textContent='Hay cambios pendientes. Reintenta la sincronización antes de cerrar sesión.';return}
    const {error}=await cloud.auth.signOut();if(error)throw error;$('#accountDialog').close();toast('Sesión cerrada');
  }catch{$('#accountMessage').textContent='No se pudo cerrar sesión. Inténtalo de nuevo.'}finally{button.disabled=false}
};
$('#importGuest').onclick=async()=>{
  const button=$('#importGuest');if(!user||!accountReady)return;button.disabled=true;
  const owner=user.id,epoch=accountEpoch,guest=readGuest();
  try{
    if(!guest.sets.length){$('#accountMessage').textContent='No hay conjuntos locales para importar.';return}
    const existing=new Set(sets.map(s=>s.id));
    const candidates=await Promise.all(guest.sets.map(async s=>{
      const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+':'+s.id)));
      bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
      const hex=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
      return {...s,id:`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`};
    }));
    const pending=candidates.filter(s=>!existing.has(s.id));
    if(!pending.length){$('#accountMessage').textContent='Estos conjuntos ya están en tu cuenta.';return}
    const {error}=await cloud.from('loadout_sets').insert(pending.map(s=>({id:s.id,user_id:owner,name:s.name,team:s.team,equipment:s.loadout,created_at:new Date(s.date).toISOString()})));
    if(error)throw error;if(epoch!==accountEpoch)return;
    sets=[...sets,...pending].sort((a,b)=>b.date-a.date);$('#count').textContent=sets.length;$('#accountMessage').textContent='Conjuntos importados. Las copias locales se conservaron.';if(!$('#savedPanel').hidden)showSaved();
  }catch{$('#accountMessage').textContent='No se pudieron importar los conjuntos. Inténtalo de nuevo.'}finally{button.disabled=false}
};
window.addEventListener('beforeunload',e=>{if(user&&unsynced){e.preventDefault();e.returnValue=''}});
cloud.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED')return;setTimeout(()=>loadAccount(session?.user),0)});
