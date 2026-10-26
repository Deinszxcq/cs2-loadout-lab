import {selectedAgent,assignAgent} from './agent-selection.mjs';
import {ensureLayouts,allowedWeapons,assignSlot} from './loadout-layout.mjs';
const $=s=>document.querySelector(s);let data=[],weaponCatalog=[],agentCatalog=[],skinIndex=new Map(),skinGroups=new Map(),team='CT',weapon='USP-S',mode='desired',category='Todas',state={CT:{},T:{}},sets=[],viewMode='current',slotContext=null,agentContext=null;
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
  $('#teamTitle').textContent=team==='CT'?'CONTRATERRORISTAS':'TERRORISTAS';$('#agentTitle').textContent='Referencia '+team;$('#agentImg').src='assets/loadout-agent-'+team.toLowerCase()+'.png';$('#teamBadge').textContent=team;const explorerAgent=selectedAgent(state[team],team,mode,agentCatalog);if(explorerAgent){$('#agentTitle').textContent=explorerAgent.name;imageFor($('#agentImg'),explorerAgent.fullImage||explorerAgent.image)}
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
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));renderSkins();$('#count').textContent=sets.length;renderOverview();
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
function showSaved(){ $('#overview').hidden=true;$('#explore').classList.remove('active');$('.workspace').hidden=true;$('#savedPanel').hidden=false;$('#equip').classList.remove('active');$('#saved').classList.add('active');$('#sets').replaceChildren();if(!sets.length){const p=document.createElement('p');p.className='empty';p.textContent='Todavía no has guardado conjuntos. Arma tu primera combinación y pulsa «Guardar conjunto».';$('#sets').append(p)}sets.forEach(set=>{const row=document.createElement('article');row.className='set';const info=document.createElement('div'),title=document.createElement('h3'),small=document.createElement('small');title.textContent=set.name;small.textContent=`${set.team} · ${set.loadout.__layout?'18 casillas'+(set.loadout.__agent?' + agentes':'')+' · Actual y deseado':Object.keys(set.loadout).filter(k=>!k.startsWith('__')).length+' elementos'} · ${new Date(set.date).toLocaleDateString('es')}`;info.append(title,small);const load=document.createElement('button');load.textContent='Cargar conjunto';load.onclick=()=>{team=set.team;state[team]=JSON.parse(JSON.stringify(set.loadout));weapon=weapons()[0];category='Todas';$('#weaponSearch').value='';$('#search').value='';persist();showEquipment();toast('Conjunto cargado')};const remove=document.createElement('button');remove.textContent='Eliminar';remove.onclick=()=>deleteSet(set,remove);row.append(info,load,remove);$('#sets').append(row)})}
function showEquipment(){$('#overview').hidden=false;$('.workspace').hidden=true;$('#savedPanel').hidden=true;$('#equip').classList.add('active');$('#explore').classList.remove('active');$('#saved').classList.remove('active');renderOverview()}
function showExplorer(){$('#overview').hidden=true;$('.workspace').hidden=false;$('#savedPanel').hidden=true;$('#equip').classList.remove('active');$('#saved').classList.remove('active');$('#explore').classList.add('active');render()}
document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{team=b.dataset.team;weapon=weapons()[0];category='Todas';$('#weaponSearch').value='';$('#search').value='';render();persist()});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render()});$('#search').oninput=renderSkins;$('#weaponSearch').oninput=render;$('#saved').onclick=showSaved;$('#equip').onclick=showEquipment;$('#explore').onclick=showExplorer;
function openSave(teamKey=team){$('#setTeam').value=teamKey;$('#setName').value='';$('#saveDialog').showModal();$('#setName').focus()}
$('#save').onclick=()=>openSave();
$('#cancel').onclick=()=>$('#saveDialog').close();
$('#saveForm').onsubmit=async e=>{
  e.preventDefault();const name=$('#setName').value.trim();if(!name)return;
  const submit=$('#saveForm .primary');submit.disabled=true;
  const owner=user?.id,epoch=accountEpoch;
  try{
    if(!accountReady||!catalogReady)throw Error('Espera a que se cargue tu cuenta.');
    team=$('#setTeam').value;ensureLayouts(state[team],team,weaponCatalog);
    const oldWeapon=weapon;for(const w of weapons()){weapon=w;selection()}weapon=weapons().includes(oldWeapon)?oldWeapon:weapons()[0];
    const set={id:crypto.randomUUID(),name,team,date:Date.now(),loadout:JSON.parse(JSON.stringify(state[team]))};
    if(user){const {error}=await cloud.from('loadout_sets').insert({id:set.id,user_id:owner,name,team,equipment:set.loadout,created_at:new Date(set.date).toISOString()});if(error)throw error;if(epoch!==accountEpoch)return;}
    sets.unshift(set);const ok=persist();$('#saveDialog').close();
    if(ok)toast(user?'Conjunto guardado en tu cuenta':'Conjunto guardado en este navegador');
    if(!$('#savedPanel').hidden)showSaved();
  }catch{toast('No se pudo guardar el conjunto. Inténtalo de nuevo.')}finally{submit.disabled=false}
};
Promise.all(['skins.json','weapons.json','agents.json'].map(async file=>{const r=await fetch(file);if(!r.ok)throw Error();return r.json()})).then(([items,models,agents])=>{
  data=items;weaponCatalog=models;agentCatalog=agents;skinIndex=new Map(data.map(s=>[s.id,s]));
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

function lockEquipment(locked){$('#overview').inert=locked;$('.workspace').inert=locked;$('#savedPanel').inert=locked;$('#save').disabled=locked||!catalogReady}
async function loadAccount(nextUser,force=false){
  if(!force&&nextUser?.id===user?.id&&accountReady)return;
  const epoch=++accountEpoch;accountReady=false;user=nextUser||null;unsynced=false;
  state=emptyState();sets=[];team='CT';weapon='USP-S';category='Todas';$('#weaponSearch').value='';$('#search').value='';
  if($('#saveDialog').open)$('#saveDialog').close();if($('#slotDialog').open)$('#slotDialog').close();slotContext=null;if($('#agentDialog').open)$('#agentDialog').close();agentContext=null;
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

function equippedSkin(teamKey,weaponName,displayMode){
  const id=state[teamKey][weaponName]?.[displayMode];
  return skinIndex.get(id)?.weapon===weaponName?skinIndex.get(id):skinIndex.get(defaultPair(weaponName)[displayMode]);
}
function slotTile(teamKey,group,index,weaponName,rail=false){
  const skin=equippedSkin(teamKey,weaponName,viewMode),button=document.createElement('button');
  button.type='button';button.className=rail?'rail-slot':'loadout-slot';
  button.style.setProperty('--skin-color',skin.color);
  button.dataset.slotTeam=teamKey;button.dataset.slotGroup=group;button.dataset.slotIndex=index;
  button.setAttribute('aria-label',`${teamKey} · ${viewMode==='current'?'Actual':'Deseado'} · ${weaponName} · ${skin.name}`);
  button.title=weaponName+' · '+skin.name;
  const image=document.createElement('img');image.alt='';imageFor(image,skin.image,true);
  const name=document.createElement('strong'),finish=document.createElement('span');name.textContent=weaponName;finish.textContent=skin.name;
  button.append(image,name,finish);button.onclick=()=>openSlot(teamKey,group,index);
  return button;
}
function renderOverview(){
  if(!catalogReady)return;
  $('#overviewTitle').textContent=viewMode==='current'?'Mi equipamiento actual':'Mi próximo equipamiento';
  document.querySelectorAll('[data-view-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.viewMode===viewMode);b.setAttribute('aria-pressed',b.dataset.viewMode===viewMode)});
  $('#loadoutBoards').replaceChildren(...['CT','T'].map(teamKey=>{
    const layout=ensureLayouts(state[teamKey],teamKey,weaponCatalog)[viewMode];const chosenAgent=selectedAgent(state[teamKey],teamKey,viewMode,agentCatalog);
    const board=document.createElement('article');board.className='loadout-board board-'+teamKey.toLowerCase();board.setAttribute('aria-label','Equipamiento '+teamKey);
    const heading=document.createElement('div');heading.className='board-heading';
    const title=document.createElement('h3');title.textContent=teamKey==='CT'?'ANTITERRORISTAS':'TERRORISTAS';
    const badge=document.createElement('span');badge.className='board-team';badge.textContent=teamKey;
    const save=document.createElement('button');save.className='board-save';save.textContent='Guardar '+teamKey;save.onclick=()=>openSave(teamKey);heading.append(badge,title,save);
    const stage=document.createElement('div');stage.className='board-stage';
    const rail=document.createElement('div');rail.className='equipment-rail';
    const agentIcon=document.createElement('button');agentIcon.type='button';agentIcon.className='rail-agent'+(chosenAgent?'':' reference-agent');agentIcon.setAttribute('aria-label','Cambiar agente '+teamKey+' · '+(viewMode==='current'?'Actual':'Deseado'));agentIcon.dataset.agentId=chosenAgent?.id||'reference-'+teamKey;agentIcon.title=chosenAgent?chosenAgent.name+' · '+chosenAgent.squad:'Elegir agente';agentIcon.onclick=()=>openAgentPicker(teamKey);const portrait=document.createElement('img');imageFor(portrait,chosenAgent?.image||'assets/loadout-agent-'+teamKey.toLowerCase()+'.png');portrait.alt='';agentIcon.append(portrait);rail.append(agentIcon);
    for(const group of ['gloves','knife','zeus'])rail.append(slotTile(teamKey,group,0,layout[group][0],true));
    const figure=document.createElement('button');figure.type='button';figure.setAttribute('aria-label','Cambiar agente desde la imagen '+teamKey);figure.onclick=()=>openAgentPicker(teamKey);figure.className='board-figure'+(chosenAgent?' inventory-agent':'');figure.dataset.agentId=chosenAgent?.id||'reference-'+teamKey;const agent=document.createElement('img');imageFor(agent,chosenAgent?.fullImage||chosenAgent?.image||'assets/loadout-agent-'+teamKey.toLowerCase()+'.png');agent.alt=chosenAgent?chosenAgent.name+' | '+chosenAgent.squad:'Agente de referencia '+teamKey+' de cuerpo completo';figure.append(agent);const identity=document.createElement('div');identity.className='agent-identity';const agentName=document.createElement('strong'),squad=document.createElement('span');agentName.textContent=chosenAgent?.name||'Sin agente seleccionado';squad.textContent=chosenAgent?.squad||'Imagen de referencia';identity.append(agentName,squad);const changeAgent=document.createElement('button');changeAgent.type='button';changeAgent.className='change-agent';changeAgent.textContent='Cambiar agente ↗';changeAgent.setAttribute('aria-label','Cambiar agente '+teamKey);changeAgent.onclick=()=>openAgentPicker(teamKey);
    const teamMark=document.createElement('span');teamMark.className='stage-team-mark';teamMark.textContent=teamKey;
    stage.append(teamMark,rail,figure,identity,changeAgent);
    const arsenal=document.createElement('div');arsenal.className='board-arsenal';
    for(const [group,label] of [['pistols','Pistola inicial'],['mid','Nivel medio'],['rifles','Rifles']]){
      const column=document.createElement('section');column.className='weapon-column';column.setAttribute('aria-label',teamKey+' · '+label);
      const h=document.createElement('h4');h.textContent=label;column.append(h);
      layout[group].forEach((w,index)=>{const tile=slotTile(teamKey,group,index,w);if(group==='pistols'&&index===1){const sub=document.createElement('small');sub.className='other-pistols';sub.textContent='Otras pistolas';tile.append(sub)}column.append(tile)});arsenal.append(column);
    }
    const body=document.createElement('div');body.className='board-body';if(teamKey==='CT')body.append(stage,arsenal);else body.append(arsenal,stage);
    const note=document.createElement('p');note.className='board-caption';note.textContent=(viewMode==='current'?'LO QUE TENGO':'LO QUE ME GUSTARÍA')+' / '+teamKey;
    board.append(heading,body,note);return board;
  }));
}
function openSlot(teamKey,group,index){
  if(!accountReady||!catalogReady)return;
  const layout=ensureLayouts(state[teamKey],teamKey,weaponCatalog)[viewMode],name=layout[group][index];
  slotContext={team:teamKey,group,index,mode:viewMode,weapon:name,skin:equippedSkin(teamKey,name,viewMode).id,epoch:accountEpoch};
  $('#slotEyebrow').textContent=teamKey+' / '+(viewMode==='current'?'LO QUE TENGO':'LO QUE ME GUSTARÍA');
  $('#slotTitle').textContent=group==='pistols'&&index===0?'Pistola inicial':group==='mid'?'Nivel medio':group==='rifles'?'Rifles':group==='knife'?'Cuchillo':group==='gloves'?'Guantes':group==='zeus'?'Zeus x27':'Otras pistolas';
  $('#slotWeapon').replaceChildren(...allowedWeapons(weaponCatalog,teamKey,group,index).map(w=>{const option=document.createElement('option');option.value=w;option.textContent=w;return option}));
  $('#slotWeapon').value=name;$('#slotSearch').value='';renderSlotPicker();$('#slotDialog').showModal();
}
function renderSlotPicker(){
  const context=slotContext;if(!context)return;
  const selected=skinIndex.get(context.skin);imageFor($('#slotPreview'),selected.image);$('#slotSkinName').textContent=selected.name;$('#slotWeaponName').textContent=context.weapon;
  const list=skins(context.weapon).filter(s=>s.name.toLowerCase().includes($('#slotSearch').value.trim().toLowerCase()));
  $('#slotResults').textContent=list.length+' acabados disponibles';
  $('#slotSkins').replaceChildren(...list.map(s=>{
    const button=document.createElement('button');button.type='button';button.className='skin'+(s.id===context.skin?' picked':'');button.style.setProperty('--rarity',s.color);button.setAttribute('aria-label','Probar '+s.name);button.setAttribute('aria-pressed',s.id===context.skin);button.title=s.name;
    const img=document.createElement('img');img.alt='';imageFor(img,s.image,true);const name=document.createElement('span');name.textContent=s.name;button.append(img,name);
    button.onclick=()=>{context.skin=s.id;const scroll=$('#slotSkins').scrollTop;renderSlotPicker();$('#slotSkins').scrollTop=scroll};return button;
  }));
  if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='No hay acabados con ese nombre.';$('#slotSkins').append(p)}
}
document.querySelectorAll('[data-view-mode]').forEach(b=>b.onclick=()=>{viewMode=b.dataset.viewMode;mode=viewMode;renderOverview()});
$('#slotWeapon').onchange=()=>{if(!slotContext)return;slotContext.weapon=$('#slotWeapon').value;slotContext.skin=equippedSkin(slotContext.team,slotContext.weapon,slotContext.mode).id;$('#slotSearch').value='';renderSlotPicker();$('#slotSkins').scrollTop=0};
$('#slotSearch').oninput=renderSlotPicker;
const closeSlot=()=>{$('#slotDialog').close();slotContext=null};
$('#slotClose').onclick=closeSlot;$('#slotCancel').onclick=closeSlot;$('#slotDialog').addEventListener('cancel',()=>{slotContext=null});
$('#slotForm').onsubmit=e=>{
  e.preventDefault();const c=slotContext;if(!c||c.epoch!==accountEpoch||!accountReady)return;
  if(!allowedWeapons(weaponCatalog,c.team,c.group,c.index).includes(c.weapon)||skinIndex.get(c.skin)?.weapon!==c.weapon)return;
  const layout=ensureLayouts(state[c.team],c.team,weaponCatalog)[c.mode];assignSlot(layout,c.group,c.index,c.weapon);
  state[c.team][c.weapon]={...(state[c.team][c.weapon]||defaultPair(c.weapon)),[c.mode]:c.skin};
  team=c.team;weapon=c.weapon;mode=c.mode;category='Todas';$('#weaponSearch').value='';$('#search').value='';persist();closeSlot();render();toast('Equipamiento actualizado');
};

function openAgentPicker(teamKey){
  if(!accountReady||!catalogReady)return;
  const current=selectedAgent(state[teamKey],teamKey,viewMode,agentCatalog);
  const first=current||agentCatalog.find(agent=>agent.team===teamKey);
  agentContext={team:teamKey,mode:viewMode,id:first.id,epoch:accountEpoch};
  $('#agentEyebrow').textContent=teamKey+' / '+(viewMode==='current'?'LO QUE TENGO':'LO QUE ME GUSTARÍA');
  $('#agentSearch').value='';renderAgentPicker();$('#agentDialog').showModal();
}
function renderAgentPicker(){
  const context=agentContext;if(!context)return;
  const selected=agentCatalog.find(agent=>agent.id===context.id&&agent.team===context.team);
  imageFor($('#agentPreview'),selected.fullImage||selected.image);$('#agentPreview').alt=selected.name+' | '+selected.squad;
  $('#agentPreviewName').textContent=selected.name;$('#agentPreviewSquad').textContent=selected.squad;$('#agentPreviewCollection').textContent=selected.collection;
  const query=$('#agentSearch').value.trim().toLocaleLowerCase();
  const candidates=agentCatalog.filter(agent=>agent.team===context.team);
  const matches=candidates.filter(agent=>(agent.name+' '+agent.squad+' '+agent.collection).toLocaleLowerCase().includes(query));
  $('#agentResults').textContent=matches.length+' de '+candidates.length+' agentes · '+context.team;
  $('#agentChoices').replaceChildren(...matches.map(agent=>{
    const button=document.createElement('button');button.type='button';button.className='agent-choice'+(agent.id===context.id?' picked':'');button.style.setProperty('--rarity',agent.color);button.setAttribute('aria-label','Probar agente '+agent.name+' | '+agent.squad);button.setAttribute('aria-pressed',agent.id===context.id);
    const image=document.createElement('img');image.alt='';imageFor(image,agent.image,true);
    const name=document.createElement('strong');name.textContent=agent.name;const squad=document.createElement('span');squad.textContent=agent.squad;button.append(image,name,squad);
    button.onclick=()=>{context.id=agent.id;const scroll=$('#agentChoices').scrollTop;renderAgentPicker();$('#agentChoices').scrollTop=scroll};return button;
  }));
  if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent='No hay agentes con ese nombre.';$('#agentChoices').append(p)}
}
const closeAgentPicker=()=>{$('#agentDialog').close();agentContext=null};
$('#agentClose').onclick=closeAgentPicker;$('#agentCancel').onclick=closeAgentPicker;$('#agentDialog').addEventListener('cancel',()=>{agentContext=null});
$('#agentSearch').oninput=renderAgentPicker;
function applyAgent(id){
  const context=agentContext;if(!context||context.epoch!==accountEpoch||!accountReady)return;
  assignAgent(state[context.team],context.team,context.mode,id,agentCatalog);
  persist();closeAgentPicker();render();toast(id?'Agente equipado':'Selección de agente eliminada');
}
$('#agentForm').onsubmit=e=>{e.preventDefault();applyAgent(agentContext?.id)};
$('#agentClear').onclick=()=>applyAgent(null);
