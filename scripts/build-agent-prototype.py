"""Pack the local Source 2 exports and bake two glove finishes for a PBR prototype.
The bake uses Valve's palette/masks/patterns, without Source 2 wear composition.
"""
from pathlib import Path
import json,struct,io,re
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'.local-tools/export'; DEST=ROOT/'dist/assets/agent-3d';DEST.mkdir(parents=True,exist_ok=True)
def pack(source,dest):
 raw=source.read_bytes(); n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);blob=bytearray(raw[28+n:]);j.pop('animations',None)
 for m in j.get('materials',[]):m.pop('extras',None)
 for image in j.get('images',[]):
  if 'uri' not in image:continue
  pixels=Image.open(source.parent/image.pop('uri'));pixels.thumbnail((1024,1024));encoded=io.BytesIO();pixels.convert('RGB').save(encoded,'JPEG',quality=90)
  data=encoded.getvalue();blob.extend(b'\0'*(-len(blob)%4));image['bufferView']=len(j['bufferViews']);image['mimeType']='image/jpeg';j['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
 j['buffers']=[{'byteLength':len(blob)}];j['asset']['generator']='Source 2 Viewer 20.1; Loadout Lab prototype';text=json.dumps(j,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob+=b'\0'*(-len(blob)%4)
 dest.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(blob))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
def bake(kit):
 folder=SRC/'gloves'; params=dict(re.findall(r'"([^"\n]+)"\s+"([^"\n]*)"',(folder/(kit+'.vmat')).read_text()))
 palette=np.array([[float(v) for v in params[f'g_vColorTint{i}'].strip('[]').split()][:3] for i in range(1,9)])
 n=1024;mask=np.asarray(Image.open(folder/'sporty_glove_mask.png').convert('RGBA').resize((n,n)),dtype=np.float32)/255;indices=np.minimum(7,(mask[:,:,3]*8).astype(int));color=palette[indices]
 pattern=np.asarray(Image.open(folder/Path(params['TexturePattern']).name).convert('RGB'),dtype=np.float32)/255
 y,x=np.mgrid[0:n,0:n];u=(x+.5)/n-.5;v=(y+.5)/n-.5;angle=np.deg2rad(float(params['g_fPatternTexCoordRotation']));scale=float(params['g_fPatternTexCoordScale']);pu=(u*np.cos(angle)-v*np.sin(angle))*scale;pv=(u*np.sin(angle)+v*np.cos(angle))*scale
 sample=pattern[(np.mod(pv,1)*pattern.shape[0]).astype(int),(np.mod(pu,1)*pattern.shape[1]).astype(int)]
 weights=np.concatenate([np.clip(1-sample.sum(axis=2,keepdims=True),0,1),sample],axis=2);pi=np.array([int(float(x))-1 for x in params['g_vPatternPaletteIndices'].strip('[]').split()]);paint=weights@palette[pi];color=np.where((indices==int(params['g_nPatternReplaceIndex'])-1)[:,:,None],paint,color)
 surface=np.asarray(Image.open(folder/'sporty_glove_ao.png').convert('RGBA').resize((n,n)),dtype=np.float32)/255
 color*=np.clip(surface[:,:,1:2],.6,1)
 Image.fromarray(np.uint8(np.clip(color,0,1)*255)).save(DEST/(kit+'.webp'),'WEBP',quality=94)
pack(SRC/'number-k/model.glb',DEST/'number-k.glb');pack(SRC/'gloves/model.glb',DEST/'sport-gloves.glb')
for kit in ['sporty_green','sporty_blue_pink']:bake(kit)
print([(p.name,p.stat().st_size) for p in DEST.glob('*')])
