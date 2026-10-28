// Reading or pricing equipment must never invent a desired finish or write it.
export function fallbackPair(skins){const base=skins.find(s=>s.vanilla)||skins[0];return {current:base?.id,desired:base?.id}}
export function resolveEquippedSkin(equipment,weapon,mode,index,skins){const selected=index.get(equipment?.[weapon]?.[mode]);return selected?.weapon===weapon?selected:index.get(fallbackPair(skins)[mode])}
