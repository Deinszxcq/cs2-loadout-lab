import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
export function createAgentViewer(host,{assets,agentId,finish,interactive=true,onError=()=>{}}={}){
 let disposed=false,renderer,controls,observer,paintRevision=0,paintResources=[],view='full',handTarget=new THREE.Vector3(0,.8,0),gloveMaterials=[];
 const resources=new Set(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.01,30),originals=new Map();
 const draw=()=>{if(!disposed&&renderer)renderer.render(scene,camera)};
 const fail=error=>{if(!disposed){host.dataset.error='true';console.error('Agent viewer:',error);onError(error)}};
 function freePaint(list){for(const resource of list){resources.delete(resource);resource.dispose()}}
 async function setFinish(id){
  const option=assets.finishes[id],family=assets.finishes[finish]?.family;if(!option||option.family!==family||disposed)return false;
  finish=id;const revision=++paintRevision;let pending=[];
  try{
   let color,orm,normal;
   if(!option.vanilla){const loader=new THREE.TextureLoader();[color,orm,normal]=await Promise.all([option.color,option.orm,...(option.normal?[option.normal]:[])].map(async(path,index)=>{const texture=await loader.loadAsync(path);texture.flipY=false;texture.wrapS=THREE.MirroredRepeatWrapping;texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.colorSpace=index===0?THREE.SRGBColorSpace:THREE.NoColorSpace;pending.push(texture);return texture}))}
   if(disposed||revision!==paintRevision){freePaint(pending);return false}
   for(const m of gloveMaterials){const original=originals.get(m);if(option.vanilla)Object.assign(m,original);else{m.map=color;m.normalMap=normal||original.normalMap;m.roughnessMap=orm;m.metalnessMap=orm;m.aoMap=orm;m.roughness=1;m.metalness=1;m.aoMapIntensity=.7}m.needsUpdate=true}
   freePaint(paintResources);paintResources=pending;for(const r of pending)resources.add(r);host.dataset.finish=id;draw();return true;
  }catch(error){freePaint(pending);fail(error);return false}
 }
 function setView(next){view=next;if(!controls)return;const target=next==='hands'?handTarget:new THREE.Vector3(0,1,0);controls.target.copy(target);const aspect=Math.max(.3,host.clientWidth/Math.max(1,host.clientHeight)),distance=next==='hands'?Math.max(.95,.65/aspect):Math.max(4.05,1.5/aspect);if(next==='hands')camera.position.set(target.x+distance*.9,target.y+.03,target.z+distance*.45);else camera.position.set(target.x,target.y+.02,target.z+distance);controls.update();draw()}
 const ready=(async()=>{
  const agentSpec=assets.agents[agentId],finishSpec=assets.finishes[finish],familySpec=assets.families[finishSpec?.family];if(!agentSpec||!familySpec)throw Error('Combinación no disponible');
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.domElement.setAttribute('aria-label','Agente en 3D con guantes equipados');renderer.domElement.setAttribute('role','img');host.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enabled=interactive;controls.enablePan=false;controls.minDistance=.7;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.8;controls.addEventListener('change',draw);
  const environmentRoom=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(environmentRoom,.04);scene.environment=environment.texture;scene.environmentIntensity=.3;resources.add(environment);environmentRoom.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe3efff,0x51483b,.9));for(const[x,y,z,power]of [[2,3,3,2.5],[-2,1.5,2,.8],[0,2,-2,1.5]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);scene.add(light)}
  const loader=new GLTFLoader();const result=await Promise.allSettled([loader.loadAsync(agentSpec.model),loader.loadAsync(familySpec.model)]);
  for(const loaded of result)if(loaded.status==='fulfilled')loaded.value.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);for(const val of Object.values(m))if(val?.isTexture)resources.add(val)}});
  if(result.some(r=>r.status==='rejected'))throw result.find(r=>r.status==='rejected').reason;if(disposed)return false;
  const [agent,gloves]=result.map(r=>r.value),bones=new Map(),defaultHandMaterials=[];scene.add(agent.scene);agent.scene.updateMatrixWorld(true);
  agent.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/body|torso|jacket|pants|legs|sleeve/i.test(m.name)){m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.65);')};m.customProgramCacheKey=()=>'cloth-roughness-floor-v1'}if(o.isBone)bones.set(o.name,o);if(o.isMesh&&o.name.includes('thirdperson_default_gloves')){o.visible=false;for(const m of Array.isArray(o.material)?o.material:[o.material])defaultHandMaterials.push(m)}});
  const meshes=[];gloves.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});if(!meshes.length)throw Error('Falta malla de guantes');
  const agentSkin=defaultHandMaterials.find(m=>/^bare_/i.test(m.name));
  for(const mesh of meshes){if(agentSkin){if(Array.isArray(mesh.material))mesh.material=mesh.material.map(m=>/^bare_/i.test(m.name)?agentSkin:m);else if(/^bare_/i.test(mesh.material.name))mesh.material=agentSkin}const source=mesh.skeleton;const target=source.bones.map(b=>{let match=bones.get(b.name);if(!match&&/^attachHand_[LR]$/.test(b.name)){const parent=bones.get('hand_'+b.name.slice(-1));if(parent){match=new THREE.Bone();match.name=b.name;match.position.copy(b.position);match.quaternion.copy(b.quaternion);match.scale.copy(b.scale);parent.add(match);bones.set(b.name,match)}}if(!match)throw Error('Falta articulación: '+b.name);return match});const skeleton=new THREE.Skeleton(target,source.boneInverses.map(m=>m.clone()));resources.add(skeleton);mesh.bind(skeleton,mesh.bindMatrix.clone());mesh.frustumCulled=false;scene.add(mesh);
   for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    // Exposed fingers keep their skin material; paint only the glove surfaces.
    if(/bare_|skin|hand_(?:white|black|brown)/i.test(m.name)&&!/glove/i.test(m.name))continue;
    originals.set(m,{map:m.map,normalMap:m.normalMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,aoMap:m.aoMap,roughness:m.roughness,metalness:m.metalness,aoMapIntensity:m.aoMapIntensity});gloveMaterials.push(m)
   }
  }
  function aim(name,childName,direction){const bone=bones.get(name),child=bones.get(childName);if(!bone||!child)return;agent.scene.updateMatrixWorld(true);const position=bone.getWorldPosition(new THREE.Vector3()),current=child.getWorldPosition(new THREE.Vector3()).sub(position).normalize(),rotation=bone.getWorldQuaternion(new THREE.Quaternion());rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(current,new THREE.Vector3(...direction).normalize()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));agent.scene.updateMatrixWorld(true)}
  for(const side of ['L','R']){const sign=side==='L'?1:-1;aim('arm_upper_'+side,'arm_lower_'+side,[sign*.22,-1,.06]);aim('arm_lower_'+side,'hand_'+side,[sign*.1,-1,.15])}

  const hands=['hand_L','hand_R'].map(n=>bones.get(n)?.getWorldPosition(new THREE.Vector3())).filter(Boolean);if(hands.length)handTarget.copy(hands[0]).add(new THREE.Vector3(0,-.1,0));
  if(!await setFinish(finish)||disposed)return false;
  const resize=()=>{if(disposed)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()};observer=new ResizeObserver(resize);observer.observe(host);resize();setView(view);host.dataset.ready='true';return true;
 })().catch(error=>{fail(error);return false}).finally(()=>{if(disposed)for(const r of resources)r.dispose()});
 return{ready,setFinish,setView,dispose(){if(disposed)return;disposed=true;paintRevision++;observer?.disconnect();controls?.dispose();for(const r of resources)r.dispose();resources.clear();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()}};
}
