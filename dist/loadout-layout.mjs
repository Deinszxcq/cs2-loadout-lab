export const GROUPS = ['pistols', 'mid', 'rifles', 'knife', 'gloves', 'zeus'];
export const DEFAULT_LOADOUTS = {
  CT: {pistols:['USP-S','Dual Berettas','Five-SeveN','R8 Revolver','Desert Eagle'],mid:['Nova','XM1014','MP5-SD','P90','MP9'],rifles:['FAMAS','M4A1-S','AUG','M4A4','AWP'],knife:['Bayonet'],gloves:['Sport Gloves'],zeus:['Zeus x27']},
  T: {pistols:['Glock-18','Dual Berettas','Tec-9','R8 Revolver','Desert Eagle'],mid:['Nova','XM1014','P90','MAC-10','MP7'],rifles:['Galil AR','AK-47','SG 553','SSG 08','AWP'],knife:['Karambit'],gloves:['Specialist Gloves'],zeus:['Zeus x27']}
};
export function allowedWeapons(catalog,team,group,index=0){
  const starters=['USP-S','P2000','Glock-18'];
  return catalog.filter(w=>w.teams.includes(team)&&(
    group==='pistols'?w.category==='Pistolas'&&(index===0?starters.includes(w.name):!starters.includes(w.name)):
    group==='mid'?['Subfusiles','Pesadas'].includes(w.category):
    group==='rifles'?w.category==='Rifles':
    group==='knife'?w.category==='Cuchillos':
    group==='gloves'?w.category==='Guantes':w.name==='Zeus x27'
  )).map(w=>w.name);
}
export function ensureLayouts(equipment,team,catalog,skinIndex){
  const saved=equipment.__layout||{};
  const result={};
  for(const mode of ['current','desired']){
    result[mode]={};
    for(const group of GROUPS){
      const used=new Set();
      result[mode][group]=DEFAULT_LOADOUTS[team][group].map((fallback,index)=>{
        const allowed=allowedWeapons(catalog,team,group,index);
        const previous=saved[mode]?.[group]?.[index];
        // Older catalog saves could store the knife skin without updating its slot.
        if (group === 'knife' && skinIndex && !equipment[previous ?? fallback]?.[mode]) {
          const equippedKnives = allowed.filter(weapon => {
            const skin = skinIndex.get(equipment[weapon]?.[mode]);
            return skin?.weapon === weapon && !skin.vanilla;
          });
          if (equippedKnives.length === 1) return equippedKnives[0];
        }
        const value=allowed.includes(previous)&&!used.has(previous)?previous:
          allowed.includes(fallback)&&!used.has(fallback)?fallback:allowed.find(w=>!used.has(w));
        used.add(value);return value;
      });
    }
  }
  equipment.__layout=result;return result;
}
export function assignSlot(layout,group,index,weapon){
  const slots=layout[group],previous=slots[index],other=slots.indexOf(weapon);
  if(other!==-1&&other!==index)slots[other]=previous;
  slots[index]=weapon;
}


export function equipCatalogSkin(equipment, team, mode, skin, catalog, skinIndex) {
  const model = catalog.find(entry => entry.name === skin.weapon);
  if (!model?.teams.includes(team) || !['current', 'desired'].includes(mode)) return false;

  const group = {Cuchillos: 'knife', Guantes: 'gloves'}[model.category];
  if (group) {
    const layout = ensureLayouts(equipment, team, catalog, skinIndex)[mode];
    assignSlot(layout, group, 0, skin.weapon);
  }
  equipment[skin.weapon] = {...equipment[skin.weapon], [mode]: skin.id};
  return true;
}
