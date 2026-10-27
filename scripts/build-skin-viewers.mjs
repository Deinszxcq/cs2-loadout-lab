// Build only from URLs published in Skinshotter's public sitemap.
// Ambiguous Doppler routes are matched by their copied public inspect identity.
import fs from 'node:fs';import path from 'node:path';import {domainToUnicode} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const links=read('.local-tools/skinshotter-sitemap.json'),phases=read('.local-tools/skinshotter-phases.json'),skins=read('dist/skins.json'),source=read('.local-tools/skins-source.json');
const normalize=text=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const decodeSlug=slug=>slug.replace(/xn--[a-z0-9]+/g,p=>domainToUnicode(p));
const index=new Map();for(const value of links){const url=new URL(value),parts=url.pathname.split('/').filter(Boolean);if(url.origin!=='https://skinshotter.com'||!['rifles','pistols','smgs','heavy','knives','gloves'].includes(parts[0])||parts.length!==3)continue;index.set(normalize(parts[1])+'/'+normalize(decodeSlug(parts[2])),value)}
function identity(inspect){const hex=decodeURIComponent(inspect).split(' ').at(-1),bytes=Buffer.from(hex,'hex');if(bytes[0]!==0)throw Error('Expected an unmasked preview');let p=1,result={};const integer=()=>{let n=0,shift=0,b;do{b=bytes[p++];n+=(b&127)*2**shift;shift+=7;if(shift>49)throw Error('Invalid preview integer')}while(b&128);return n};while(p<bytes.length-4){const key=integer(),field=key>>3,wire=key&7;if(wire===0){const value=integer();if(field===3)result.weapon=value;if(field===4)result.paint=value}else if(wire===5)p+=4;else if(wire===1)p+=8;else if(wire===2)p+=integer();else throw Error('Unsupported preview wire type')}return result}
const overrides=new Map();for(const entry of phases){if(!entry.inspect)throw Error('Unverified phase '+entry.url);if(!links.includes(entry.url))throw Error('Unpublished route');const {weapon,paint}=identity(entry.inspect);for(const s of source.filter(s=>s.weapon?.weapon_id===weapon&&Number(s.paint_index)===paint))overrides.set(s.id,entry.url)}
const viewers={},missing=[];for(const s of skins.filter(s=>!s.vanilla)){const key=normalize(s.weapon.replace(/ Gloves$| Knife$/,''))+'/'+normalize(s.name),url=overrides.get(s.id)||index.get(key);if(url)viewers[s.id]=url;else missing.push(s.weapon+' · '+s.name)}
if(missing.length)throw Error('Missing viewer routes:\n'+missing.join('\n'));
fs.writeFileSync(path.join(root,'dist/skin-viewers.json'),JSON.stringify(viewers,null,2)+'\n');console.log('Verified viewer routes:',Object.keys(viewers).length);
