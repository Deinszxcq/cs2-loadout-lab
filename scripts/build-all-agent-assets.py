"""Build all local agent/world-glove models and source-based PBR glove finishes."""
from pathlib import Path
import json,struct,io,re,time,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'.local-tools/all-3d';DEST=ROOT/'dist/assets/equipment-3d';DEST.mkdir(parents=True,exist_ok=True)
def read(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def pack(source,dest):
 if dest.exists() and '--repack' not in sys.argv:return
 j,raw=read(source);blob=bytearray(raw);j.pop('animations',None)
 for m in j.get('materials',[]):m.pop('extras',None)
 color_images=set();alpha_images=set()
 for material in j.get('materials',[]):
  tex=material.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index')
  if tex is not None:
   index=j['textures'][tex]['source'];color_images.add(index)
   if material.get('alphaMode','OPAQUE')!='OPAQUE':alpha_images.add(index)
 for index,image in enumerate(j.get('images',[])):
  if 'uri' not in image:continue
  file=source.parent/image.pop('uri');pixels=Image.open(file);limit=1024 if index in color_images or 'families' in str(source) else 512;pixels.thumbnail((limit,limit));buf=io.BytesIO();lossless=index not in color_images or index in alpha_images
  pixels.convert('RGBA' if index in alpha_images else 'RGB').save(buf,'WEBP',quality=95 if lossless else 92,method=4)
  data=buf.getvalue();blob.extend(b'\0'*(-len(blob)%4));image['bufferView']=len(j['bufferViews']);image['mimeType']='image/webp';j['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data)
 for texture in j.get('textures',[]):
  if 'source'in texture:texture.setdefault('extensions',{})['EXT_texture_webp']={'source':texture.pop('source')}
 j['extensionsUsed']=list(set(j.get('extensionsUsed',[])+['EXT_texture_webp']));j['extensionsRequired']=list(set(j.get('extensionsRequired',[])+['EXT_texture_webp']))
 j['buffers']=[{'byteLength':len(blob)}];j['asset']['generator']='Source 2 Viewer 20.1; Loadout Lab equipment';text=json.dumps(j,separators=(',',':')).encode();text+=b' '*(-len(text)%4);blob+=b'\0'*(-len(blob)%4);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(blob))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
def vector(p,k,default):return [float(v) for v in p.get(k,default).strip('[]').split()]
def image(p,key,n,mode='RGBA',nearest=False):
 value=p[key]
 if value.startswith('['):
  channels=4 if mode=='RGBA' else 3;values=vector(p,key,'[1 1 1 1]');return np.broadcast_to(np.array((values+[1]*4)[:channels],np.float32),(n,n,channels)).copy()
 filename=Path(value.replace('\\','/')).name;file=SRC/'paints'/filename
 if not file.exists():file=file.with_suffix('.png')
 return np.asarray(Image.open(file).convert(mode).resize((n,n),Image.Resampling.NEAREST if nearest else Image.Resampling.LANCZOS),dtype=np.float32)/255

def save_paint(kit,color,orm,normal=None):
 dest=DEST/'finishes';dest.mkdir(exist_ok=True);Image.fromarray(np.uint8(np.clip(color,0,1)*255)).save(dest/(kit+'.webp'),'WEBP',quality=94);Image.fromarray(np.uint8(np.clip(orm,0,1)*255)).resize((512,512)).save(dest/(kit+'-orm.webp'),'WEBP',lossless=True)
 result={'color':f'assets/equipment-3d/finishes/{kit}.webp','orm':f'assets/equipment-3d/finishes/{kit}-orm.webp','paintkit':kit}
 if normal is not None:
  Image.fromarray(np.uint8(np.clip(normal,0,1)*255)).save(dest/(kit+'-normal.png'),optimize=True);result['normal']=f'assets/equipment-3d/finishes/{kit}-normal.png'
 return result

def modern_bake(kit,p):
 n=1024;mask=image(p,'TextureObjectMaterialId',n,nearest=True);weights=np.concatenate([mask[:,:,:3],np.clip(1-mask[:,:,:3].sum(axis=2,keepdims=True),0,1)],axis=2);weights/=np.maximum(weights.sum(axis=2,keepdims=True),1)
 y,x=np.mgrid[0:n,0:n];u=(x+.5)/n;v=(y+.5)/n;color=np.zeros((n,n,3),np.float32);rough=np.zeros((n,n),np.float32);metal=np.zeros_like(rough);detail_normal=np.zeros((n,n,3),np.float32)
 def tiled(key,i,default):
  if key not in p:return np.broadcast_to(np.array(default,np.float32),(n,n,4)).copy()
  tex=image(p,key,n);scale=vector(p,f'g_vUvScale{i}','[1 1 0 0]');offset=vector(p,f'g_vUvOffset{i}','[0 0 0 0]');angle=np.deg2rad(float(p.get(f'g_fUvRotation{i}','0')));pu=((u-.5)*np.cos(angle)-(v-.5)*np.sin(angle))*scale[0]+offset[0]+.5;pv=((u-.5)*np.sin(angle)+(v-.5)*np.cos(angle))*scale[1]+offset[1]+.5
  return tex[(np.mod(pv,1)*n).astype(int),(np.mod(pu,1)*n).astype(int)]
 for i in range(1,5):
  albedo=tiled(f'TextureSurfaceAlbedo{i}',i,[1,1,1,1])[:,:,:3];tintmask=tiled(f'TextureSurfaceTintMask{i}',i,[1,1,1,1])[:,:,:1];tint=np.array(vector(p,f'g_vSurfaceColorTint{i}','[1 1 1 0]')[:3]);col=albedo*(1-tintmask+tintmask*tint);saturation=float(p.get(f'g_fSurfaceColorSaturation{i}','1'));luma=(col*np.array([.2126,.7152,.0722])).sum(axis=2,keepdims=True);col=luma+(col-luma)*saturation;contrast=float(p.get(f'g_fSurfaceColorContrast{i}','1'));col=(col-.5)*contrast+.5;brightness=float(p.get(f'g_fSurfaceColorBrightness{i}','1'));col*=max(.03,brightness if brightness>=0 else 1+brightness);w=weights[:,:,i-1:i];color+=col*w
  norm=tiled(f'TextureSurfaceNormal{i}',i,[.5,.5,1,.8]);detail_normal+=(norm[:,:,:3]*2-1)*w;rough+=norm[:,:,3]*w[:,:,0];metal+=tiled(f'TextureSurfaceMetalness{i}',i,[0,0,0,1])[:,:,0]*w[:,:,0]
 ao=image(p,'TextureObjectAmbientOcclusion',n)[:,:,0] if 'TextureObjectAmbientOcclusion'in p else np.ones((n,n));base=image(p,'TextureObjectNormal',n)[:,:,:3]*2-1;normal=np.concatenate([base[:,:,:2]+detail_normal[:,:,:2]*.4,(base[:,:,2]*detail_normal[:,:,2])[:,:,None]],axis=2);normal/=np.maximum(np.linalg.norm(normal,axis=2,keepdims=True),.001);normal=normal*.5+.5
 return save_paint(kit,color,np.stack([np.clip(ao,.2,1),np.clip(rough,.2,.95),np.clip(metal,0,1)],axis=2),normal)

def bake(kit):
 p=dict(re.findall(r'"([^"\n]+)"\s+"([^"\n]*)"',(SRC/'paints'/(kit+'.vmat')).read_text(encoding='utf8')));n=1024
 if 'TextureObjectMaterialId'in p:return modern_bake(kit,p)
 palette=np.array([vector(p,f'g_vColorTint{i}','[0.4 0.4 0.4 0]')[:3] for i in range(1,9)],dtype=np.float32)
 mask=image(p,'TextureLayerMask',n,nearest=True);indices=np.minimum(7,(mask[:,:,3]*8).astype(int));color=palette[indices]
 y,x=np.mgrid[0:n,0:n].astype(np.float32);u=(x+.5)/n-.5;v=(y+.5)/n-.5
 pattern_replace=int(p.get('g_nPatternReplaceIndex','8'))-1
 if p.get('F_PATTERN')=='1' and 'TexturePattern' in p:
  raw=Image.open(SRC/'paints'/Path(p['TexturePattern'].replace('\\','/')).name).convert('RGB');pattern=np.asarray(raw,dtype=np.float32)/255;angle=np.deg2rad(float(p.get('g_fPatternTexCoordRotation','0')));scale=float(p.get('g_fPatternTexCoordScale','1'));offset=vector(p,'g_fPatternTexCoordOffset','[0 0 0 0]');pu=(u*np.cos(angle)-v*np.sin(angle))*scale+offset[0];pv=(u*np.sin(angle)+v*np.cos(angle))*scale+offset[1];sample=pattern[(np.mod(pv,1)*pattern.shape[0]).astype(int),(np.mod(pu,1)*pattern.shape[1]).astype(int)]
  pi=np.clip(np.array(vector(p,'g_vPatternPaletteIndices','[1 2 3 4]'),dtype=int)-1,0,7);weights=np.concatenate([np.clip(1-sample.sum(axis=2,keepdims=True),0,1),sample],axis=2);weights/=np.maximum(weights.sum(axis=2,keepdims=True),1);paint=weights@palette[pi];color=np.where((indices==pattern_replace)[:,:,None],paint,color)
 layer=np.concatenate([np.clip(1-mask[:,:,:3].sum(axis=2,keepdims=True),0,1),mask[:,:,:3]],axis=2);layer/=np.maximum(layer.sum(axis=2,keepdims=True),1);detail=np.zeros((n,n),np.float32);rough=np.zeros_like(detail);metal=np.zeros_like(detail)
 for i in range(4):
  key=f'TextureDetail{i+1}';scale=float(p.get(f'g_fDetailScale{i+1}','1'));d=image(p,key,n) if key in p else np.full((n,n,4),.5,dtype=np.float32);sample=d[(np.mod((v+.5)*scale,1)*n).astype(int),(np.mod((u+.5)*scale,1)*n).astype(int)];detail+=layer[:,:,i]*(.88+.18*sample[:,:,0]);rough+=layer[:,:,i]*np.clip(float(p.get(f'g_fDetailRoughnessBrightness{i+1}','.8'))*(.6+sample[:,:,1]*.35),.25,.95);metal+=layer[:,:,i]*float(p.get(f'g_fDetailMetalness{i+1}','0'))
 color*=detail[:,:,None];surface=image(p,'TextureSurfaceProperties',n) if 'TextureSurfaceProperties' in p else np.ones((n,n,4),np.float32);ao=np.clip(surface[:,:,1],.25,1);orm=np.stack([ao,rough,np.clip(metal,0,1)],axis=2)
 return save_paint(kit,color,orm)

def main():
 sources=json.loads((SRC/'sources.json').read_text(encoding='utf8'));catalog=json.loads((ROOT/'dist/skins.json').read_text(encoding='utf8'));manifest={'agents':{},'families':{},'finishes':{},'rendering':'Source-based PBR; fixed pose; no wear/seed simulation'}
 for agent in sources['agents']:
  file=f'agents/{agent["id"]}.glb';pack(SRC/'agents'/agent['id']/'model.glb',DEST/file);manifest['agents'][agent['id']]={'model':'assets/equipment-3d/'+file,'team':agent['team']};print(agent['id'],flush=True)
 for family,key in sources['map'].items():
  file=f'families/{key}.glb';pack(SRC/'families'/key/'model.glb',DEST/file);manifest['families'][family]={'model':'assets/equipment-3d/'+file}
  for vanilla in [s for s in catalog if s['weapon']==family and s.get('vanilla')]:manifest['finishes'][vanilla['id']]={'family':family,'name':vanilla['name'],'vanilla':True}
 (ROOT/'dist/agent-3d-catalog.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
 for skin in sources['skins']:
  log=SRC/'paints'/(skin['pattern']['id']+'.vmat.log')
  for _ in range(360):
   if log.exists():break
   time.sleep(.5)
  params=bake(skin['pattern']['id']);manifest['finishes'][skin['id']]={'family':skin['weapon']['name'],'name':skin['pattern']['name'],**params};print(skin['pattern']['id'],flush=True)
 (ROOT/'dist/agent-3d-catalog.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8');print('Complete',len(manifest['agents']),len(manifest['families']),len(manifest['finishes']))
if __name__=='__main__':main()
