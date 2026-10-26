"""Restore CS2 inventory poses and bake the omitted procedural eye layer."""
from pathlib import Path
import json,struct,re,subprocess,io,os
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];STAGE=ROOT/'.local-tools/pose-fix';STAGE.mkdir(exist_ok=True);SRC=ROOT/'.local-tools/all-3d';DEST=ROOT/'dist/assets/equipment-3d/eyes';DEST.mkdir(exist_ok=True)
CLI=ROOT/'.local-tools/source2viewer/Source2Viewer-CLI.exe';GAME=Path(os.environ.get('CS2_GAME_DIR','C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo'))
def export(resource,target,model=False):
 if target.exists():return
 args=[str(CLI),'-i',str(GAME/'pak01_dir.vpk'),'-f',resource,'-o',str(target),'-d','--game',str(GAME/'gameinfo.gi')]
 if model:args+=['--gltf_export_format','glb','--gltf_export_animations']
 result=subprocess.run(args,capture_output=True,timeout=120);(STAGE/'export.log').write_bytes(result.stdout+result.stderr)
 if result.returncode or not target.exists():raise ValueError('Export failed '+resource)
def read(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def accessor(j,blob,index):
 a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dtype=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width*dtype.itemsize)
 return np.ndarray((a['count'],width),dtype=dtype,buffer=blob,offset=offset,strides=(stride,dtype.itemsize)).copy()
def matrix(n):
 if 'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]],float);m[:3,:3]*=np.array(n.get('scale',[1,1,1]))[None,:];m[:3,3]=n.get('translation',[0,0,0]);return m

def quaternion_product(a,b):
 ax,ay,az,aw=a;bx,by,bz,bw=b
 return np.array([aw*bx+ax*bw+ay*bz-az*by,aw*by+ay*bw+az*bx-ax*bz,aw*bz+az*bw+ax*by-ay*bx,aw*bw-ax*bx-ay*by-az*bz])

def pose_for(items,id):
 for match in re.finditer(r'"'+id+r'"\s*\{',items):
  tokens=re.finditer(r'"(?:\\.|[^"\\])*"|[{}]',items[match.end()-1:]);depth=0
  for token in tokens:
   if token.group()=='{':depth+=1
   elif token.group()=='}':
    depth-=1
    if depth==0:
     block=items[match.end()-1:match.end()-1+token.end()];break
  if '"model_player"'in block and 'customplayer_'in block:
   m=re.search(r'"pose_sequence"\s*"([^"]+)"',block);return m[1] if m else 'cu_ct_pose01'
 raise ValueError('No item '+id)
def bake_eyes(agent,j,blob):
 parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};worlds={}
 def world(i):
  if i not in worlds:worlds[i]=(world(parents[i]) if i in parents else np.eye(4))@matrix(j['nodes'][i])
  return worlds[i]
 centers=[world(i)[:3,3] for i,n in enumerate(j['nodes']) if n['name'] in ['eyeball_l','eyeball_r']]
 if len(centers)!=2:return []
 output=[]
 for mi,material in enumerate(j['materials']):
  vmat=material.get('extras',{}).get('vmat',{});params=vmat.get('TextureParams',{});floats=vmat.get('FloatParams',{})
  if vmat.get('IntParams',{}).get('F_EYEBALLS')!=1 or 'g_tEyeMask1'not in params:continue
  paths={}
  for key in ['g_tEyeMask1','g_tEyeAlbedo1']:
   resource=params[key]+'_c';file=STAGE/(Path(resource).stem+'.png');export(resource,file);paths[key]=file
  filename=agent+'-'+str(mi)+'.webp'
  if (DEST/filename).exists():
   cached=np.asarray(Image.open(DEST/filename).convert('RGB'),dtype=np.float32)/255;mh,mw=cached.shape[:2];eye_mask=np.asarray(Image.open(paths['g_tEyeMask1']).convert('RGB').resize((mw,mh)))[:,:,0]/255;output.append({'material':material['name'],'color':'assets/equipment-3d/eyes/'+filename,'pixels':int((eye_mask>.01).sum()),'pupilPixels':int(((eye_mask>.5)&(cached.mean(axis=2)<.08)).sum())});continue
  tex=j['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];original=SRC/'agents'/agent/'model.glb';color_file=original.parent/j['images'][tex]['uri'];base=Image.open(color_file).convert('RGB');base.thumbnail((2048,2048));w,h=base.size;base=np.asarray(base,dtype=np.float32)/255;mask=np.asarray(Image.open(paths['g_tEyeMask1']).convert('RGB').resize((w,h)),dtype=np.float32)[:,:,0]/255;iris=np.asarray(Image.open(paths['g_tEyeAlbedo1']).convert('RGB'),dtype=np.float32)/255;radius=float(floats.get('g_flEyeBallRadius1',.65))*.0254;iris_size=float(floats.get('g_flEyeIrisSize1',1));pupil=float(floats.get('g_flEyePupilSize1',.15));coverage=np.zeros((h,w),bool)
  for mesh in j['meshes']:
   for primitive in mesh['primitives']:
    if primitive.get('material')!=mi:continue
    positions=accessor(j,blob,primitive['attributes']['POSITION']);uv=accessor(j,blob,primitive['attributes']['TEXCOORD_0'])*[w,h];indices=accessor(j,blob,primitive['indices']).reshape(-1,3)
    for triangle in indices:
     t=uv[triangle];x0=max(0,int(np.floor(t[:,0].min())));x1=min(w,int(np.ceil(t[:,0].max()))+1);y0=max(0,int(np.floor(t[:,1].min())));y1=min(h,int(np.ceil(t[:,1].max()))+1)
     if x1<=x0 or y1<=y0 or not np.any(mask[y0:y1,x0:x1]>.01):continue
     denominator=(t[1,1]-t[2,1])*(t[0,0]-t[2,0])+(t[2,0]-t[1,0])*(t[0,1]-t[2,1])
     if abs(denominator)<1e-8:continue
     yy,xx=np.mgrid[y0:y1,x0:x1];xx=xx+.5;yy=yy+.5;b0=((t[1,1]-t[2,1])*(xx-t[2,0])+(t[2,0]-t[1,0])*(yy-t[2,1]))/denominator;b1=((t[2,1]-t[0,1])*(xx-t[2,0])+(t[0,0]-t[2,0])*(yy-t[2,1]))/denominator;b2=1-b0-b1;inside=(b0>=-.001)&(b1>=-.001)&(b2>=-.001)&(mask[y0:y1,x0:x1]>.01)
     if not np.any(inside):continue
     point=b0[:,:,None]*positions[triangle[0]]+b1[:,:,None]*positions[triangle[1]]+b2[:,:,None]*positions[triangle[2]];eye=np.where((np.linalg.norm(point-centers[0],axis=2)<np.linalg.norm(point-centers[1],axis=2))[:,:,None],centers[0],centers[1]);delta=(point-eye)/radius;projection=delta[:,:,:2]*[1,-1];rho=np.linalg.norm(projection,axis=2);warped=projection*((2-iris_size)*(1-rho)+rho)[:,:,None];sample_uv=np.clip(warped*.5+.5,0,1);sample=iris[np.minimum(iris.shape[0]-1,(sample_uv[:,:,1]*iris.shape[0]).astype(int)),np.minimum(iris.shape[1]-1,(sample_uv[:,:,0]*iris.shape[1]).astype(int))];pupil_factor=np.clip((rho-pupil)/.03,0,1);pupil_factor=pupil_factor*pupil_factor*(3-2*pupil_factor);sample*=pupil_factor[:,:,None];luma=(sample*np.array([.2126,.7152,.0722])).sum(axis=2,keepdims=True);sample=luma+(sample-luma)*float(floats.get('g_flEyeSaturation1',1));alpha=(mask[y0:y1,x0:x1]*inside)[:,:,None];base[y0:y1,x0:x1]=base[y0:y1,x0:x1]*(1-alpha)+sample*alpha;coverage[y0:y1,x0:x1]|=inside
  filename=agent+'-'+str(mi)+'.webp';Image.fromarray(np.uint8(np.clip(base,0,1)*255)).save(DEST/filename,'WEBP',quality=97);output.append({'material':material['name'],'color':'assets/equipment-3d/eyes/'+filename,'pixels':int(coverage.sum()),'pupilPixels':int(((mask>.5)&(base.mean(axis=2)<.08)).sum())})
 return output

def main():
 manifest_path=ROOT/'dist/agent-3d-catalog.json';manifest=json.loads(manifest_path.read_text(encoding='utf8'));items_path=ROOT/'.local-tools/items_game.txt';listing_path=ROOT/'.local-tools/vpk-list.txt'
 if not items_path.exists():export('scripts/items/items_game.txt',items_path)
 if not listing_path.exists():listing_path.write_bytes(subprocess.run([str(CLI),'-i',str(GAME/'pak01_dir.vpk'),'-l'],capture_output=True,check=True).stdout)
 items=items_path.read_text(encoding='utf8');listing=listing_path.read_text(encoding='utf8');poses={}
 for id,spec in manifest['agents'].items():
  pose=pose_for(items,id.split('-')[1])
  # The installed item schema still names an absent legacy professional pose.
  # Reuse the available inventory stance from the same professional family.
  pose={'cu_t_pose05':'cu_t_pose04'}.get(pose,pose);resource=next(line.split(' ')[0] for line in listing.splitlines() if '/inventory_pose/'in line and line.split(' ')[0].endswith('/'+pose+'.vnmclip_c'));file=STAGE/(pose+'.glb');export(resource,file,True)
  if pose not in poses:
   j,b=read(file);clip=j['animations'][0];rotations={};pelvis_delta=None
   for channel in clip['channels']:
    target=channel['target'];sampler=clip['samplers'][channel['sampler']];node=j['nodes'][target['node']];value=accessor(j,b,sampler['output'])[0]
    if target['path']=='rotation' and node['name']!='root_motion':
     bind=np.array(node.get('rotation',[0,0,0,1]));inverse=bind*np.array([-1,-1,-1,1]);delta=quaternion_product(inverse,value);rotations[node['name']]=(delta/np.linalg.norm(delta)).tolist()
    if target['path']=='translation'and node['name']=='pelvis':pelvis_delta=(value-np.array(node.get('translation',[0,0,0])))[[1,2,0]].tolist()
   poses[pose]={'rotations':rotations,'pelvisDelta':pelvis_delta}
  spec['pose']=pose;j,b=read(SRC/'agents'/id/'model.glb');spec['eyes']=bake_eyes(id,j,b);print(id,pose,'eyes',len(spec['eyes']),flush=True)
 manifest['poses']=poses;manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8');print('Completed poses and eyes',len(poses))
if __name__=='__main__':main()
