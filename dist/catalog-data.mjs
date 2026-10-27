export const rarityNames={Contraband:'Contrabando',Covert:'Encubierto',Classified:'Clasificado',Restricted:'Restringido','Mil-Spec Grade':'Grado militar','Industrial Grade':'Grado industrial','Consumer Grade':'Grado de consumidor',Extraordinary:'Extraordinario'};
export const wearNames={'Factory New':'Recién fabricado','Minimal Wear':'Casi nuevo','Field-Tested':'Algo desgastado','Well-Worn':'Bastante desgastado','Battle-Scarred':'Deplorable'};
export function catalogDetails(source){return Object.fromEntries(source.map(s=>[s.id,{rarity:s.rarity?.name||'',min:s.min_float??null,max:s.max_float??null,stattrak:!!s.stattrak,souvenir:!!s.souvenir,wears:(s.wears||[]).map(w=>w.name),collections:(s.collections||[]).map(c=>({name:c.name,image:c.image})),crates:(s.crates||[]).length}]))}
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterCatalog(items,models,details,{weapon='',category='',query='',rarities=[],wear='',variant='',min=0,max=1,sort='name'}={}){
 if(Number(min)>Number(max))return [];
 const categories=new Map(models.map(m=>[m.name,m.category])),q=normalize(query.trim());
 const result=items.filter(s=>{const d=details[s.id]||{};return !s.vanilla&&(!weapon||s.weapon===weapon)&&(!category||categories.get(s.weapon)===category)&&(!q||normalize([s.weapon,s.name,...(d.collections||[]).map(c=>c.name)].join(' ')).includes(q))&&(!rarities.length||rarities.includes(d.rarity))&&(!wear||(d.wears||[]).includes(wear))&&(!variant||d[variant])&&(d.min==null||d.max>=min&&d.min<=max)});
 return result.sort((a,b)=>sort==='rarity'?['Contraband','Covert','Classified','Restricted','Mil-Spec Grade','Industrial Grade','Consumer Grade'].indexOf(details[a.id]?.rarity)-['Contraband','Covert','Classified','Restricted','Mil-Spec Grade','Industrial Grade','Consumer Grade'].indexOf(details[b.id]?.rarity)||a.name.localeCompare(b.name):sort==='name-desc'?b.name.localeCompare(a.name):a.name.localeCompare(b.name));
}
