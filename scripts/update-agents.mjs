import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const response=await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/agents.json');
if(!response.ok)throw Error(`Agent catalog: HTTP ${response.status}`);
const source=await response.json();
const directory=path.join(root,'dist/assets/agents');await fs.mkdir(directory,{recursive:true});
const catalog=source.map(agent=>({id:agent.id,name:agent.name.split(' | ')[0],squad:agent.name.split(' | ').slice(1).join(' | '),team:agent.team.id==='counter-terrorists'?'CT':'T',image:`assets/agents/${agent.id}.png`,color:agent.rarity.color,collection:agent.collections[0]?.name||'',sourceImage:agent.image}));
let cursor=0;
await Promise.all(Array.from({length:5},async()=>{
  while(cursor<catalog.length){
    const agent=catalog[cursor++],file=path.join(root,'dist',agent.image);
    try{await fs.access(file);continue}catch{}
    const image=await fetch(agent.sourceImage);if(!image.ok)throw Error(`${agent.id}: HTTP ${image.status}`);
    const bytes=Buffer.from(await image.arrayBuffer());if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error(`Invalid PNG: ${agent.id}`);
    await fs.writeFile(file,bytes);
  }
}));
catalog.sort((a,b)=>a.name.localeCompare(b.name));
await fs.writeFile(path.join(root,'dist/agents.json'),JSON.stringify(catalog.map(({sourceImage,...agent})=>agent),null,2)+'\n');
console.log(JSON.stringify({agents:catalog.length,CT:catalog.filter(a=>a.team==='CT').length,T:catalog.filter(a=>a.team==='T').length}));
