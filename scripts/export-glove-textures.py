"""Export compiled glove textures by resource identity, never by shared source basename."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,os,re,subprocess
from glove_texture_resources import compiled_key

ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'.local-tools/all-3d'
DEST=STAGE/'compiled-textures'
CLI=ROOT/'.local-tools/source2viewer/Source2Viewer-CLI.exe'
GAME=Path(os.environ.get('CS2_GAME_DIR','C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo'))

def params(kit):
 return dict(re.findall(r'"([^"\n]+)"\s+"([^"\n]*)"',(STAGE/'paints'/(kit+'.vmat')).read_text(encoding='utf8')))

def main():
 DEST.mkdir(exist_ok=True)
 sources=json.loads((STAGE/'sources.json').read_text(encoding='utf8'))
 resources=set()
 for skin in sources['skins']:
  p=params(skin['pattern']['id'])
  if 'TextureObjectMaterialId' in p:continue
  for key,value in p.items():
   if key.startswith('Texture') and not value.startswith('['):
    resource=p.get(compiled_key(key))
    if not resource:raise ValueError('Missing compiled resource: '+key)
    resources.add(resource)
 index={r:hashlib.sha256(r.encode()).hexdigest()[:20]+'.png' for r in sorted(resources)}
 def export(item):
  resource,name=item;target=DEST/name
  if not target.exists():
   result=subprocess.run([str(CLI),'-i',str(GAME/'pak01_dir.vpk'),'-f',resource+'_c','-o',str(target),'-d'],capture_output=True,timeout=120)
   if result.returncode or not target.exists():raise ValueError(resource+'\n'+result.stdout.decode(errors='replace'))
  return name
 with ThreadPoolExecutor(max_workers=4) as pool:
  for n,name in enumerate(pool.map(export,index.items()),1):
   if n%20==0:print(n,'/',len(index),flush=True)
 (DEST/'index.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf8')
 print('Exported',len(index),'distinct compiled textures',flush=True)

if __name__=='__main__':main()
