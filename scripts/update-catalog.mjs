import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/';
const read = async name => {
  const response = await fetch(source + name + '.json');
  if (!response.ok) throw new Error(`Catalog ${name}: HTTP ${response.status}`);
  return response.json();
};
const [skins, bases] = await Promise.all([read('skins'), read('base_weapons')]);
const categories = { Pistols: 'Pistolas', Rifles: 'Rifles', SMGs: 'Subfusiles', Heavy: 'Pesadas', Knives: 'Cuchillos', Gloves: 'Guantes', Equipment: 'Equipo' };
const categoryOrder = Object.values(categories);
const weaponMap = new Map();
const entries = [];
const localAssets = new Set(await fs.readdir(path.join(root, 'dist/assets')));
for (const skin of skins) {
  if (!skin.image || !skin.weapon || !categories[skin.category?.name]) continue;
  const weapon = skin.weapon.name;
  if (!weaponMap.has(weapon)) {
    const slug = weapon.toLowerCase().replaceAll(' ', '-');
    weaponMap.set(weapon, { name: weapon, category: categories[skin.category.name], teams: new Set(), pricempire: `https://pricempire.com/cs2-skin-search/${slug}`, count: 0 });
  }
  const metadata = weaponMap.get(weapon);
  for (const team of skin.team.id === 'both' ? ['CT', 'T'] : [skin.team.id === 'counter-terrorists' ? 'CT' : 'T']) metadata.teams.add(team);
  if (skin.pattern) metadata.count++;
  entries.push({ id: skin.id, weapon, name: skin.pattern ? skin.pattern.name + (skin.phase ? ` · ${skin.phase}` : '') : 'Sin skin', image: localAssets.has(skin.id + '.png') ? `assets/${skin.id}.png` : skin.image, color: skin.rarity.color, ...(!skin.pattern ? {vanilla:true} : {}) });
}
for (const base of bases) {
  if (!weaponMap.has(base.name) || entries.some(s=>s.weapon===base.name&&s.vanilla)) continue;
  entries.push({ id: base.id, weapon: base.name, name: 'Sin skin', image: base.image || 'assets/image-unavailable.svg', color: '#87909a', vanilla: true });
}
const weapons = [...weaponMap.values()].map(w => ({ ...w, teams: [...w.teams].sort() })).sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.name.localeCompare(b.name));
if (new Set(entries.map(s => s.id)).size !== entries.length) throw new Error('Duplicate catalog IDs');
for (const weapon of weapons) if (!entries.some(s => s.weapon === weapon.name)) throw new Error(`Empty weapon: ${weapon.name}`);
await fs.writeFile(path.join(root, 'dist/skins.json'), JSON.stringify(entries) + '\n');
await fs.writeFile(path.join(root, 'dist/weapons.json'), JSON.stringify(weapons, null, 2) + '\n');
console.log(JSON.stringify({ models: weapons.length, finishes: entries.filter(s=>!s.vanilla).length, options: entries.length, awp: weaponMap.get('AWP').count }));
