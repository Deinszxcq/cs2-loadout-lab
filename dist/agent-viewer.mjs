import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {GLOVE_FINISHES} from './agent-prototype.mjs';
export function createAgentViewer(host,{finish=GLOVE_FINISHES[0].id,interactive=true,onError=()=>{}}={}){
 let disposed=false,renderer,controls,observer,gloveMaterials=[],textures=new Map(),resize=()=>{},handTarget=new THREE.Vector3(0,.8,0),view='full';
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.01,30);scene.background=null;
 const resources=new Set();const draw=()=>{if(!disposed&&renderer)renderer.render(scene,camera)};
 function setFinish(id){const option=GLOVE_FINISHES.find(f=>f.id===id);if(!option)return;finish=id;const t=textures.get(id);if(t){gloveMaterials.forEach(m=>{m.map=t;m.needsUpdate=true});host.dataset.finish=id;draw()}}
 function setView(next){view=next;if(!controls)return;const target=next==='hands'?handTarget:new THREE.Vector3(0,1.0,0);controls.target.copy(target);const aspect=Math.max(.3,host.clientWidth/Math.max(1,host.clientHeight));const distance=next==='hands'?Math.max(1.8,1.8/aspect):Math.max(4.05,1.5/aspect);camera.position.set(target.x,target.y+.02,target.z+distance);controls.update();draw()}
 const ready=(async()=>{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.domElement.setAttribute('aria-label','Number K en 3D con guantes intercambiables');renderer.domElement.setAttribute('role','img');host.append(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enabled=interactive;controls.enablePan=false;controls.minDistance=.65;controls.maxDistance=6;controls.maxPolarAngle=Math.PI*.8;controls.addEventListener('change',draw);
  scene.add(new THREE.HemisphereLight(0xe6f2ff,0x5c5144,2.5));for(const [x,y,z,power]of [[2,3,3,3.5],[-2,1.5,2,2],[0,2,-2,2]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);scene.add(light)}
  const loader=new GLTFLoader();const [agent,gloves]=await Promise.all([loader.loadAsync('assets/agent-3d/number-k.glb'),loader.loadAsync('assets/agent-3d/sport-gloves.glb')]);
  for(const source of [agent,gloves])source.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value)}});
  if(disposed)return;
  scene.add(agent.scene);agent.scene.updateMatrixWorld(true);const bones=new Map();agent.scene.traverse(o=>{if(o.isBone)bones.set(o.name,o)});
  // Align the authored world glove skeleton to the agent's matching hand/finger bones.
  const gloveMeshes=[];gloves.scene.traverse(mesh=>{if(mesh.isSkinnedMesh)gloveMeshes.push(mesh)});gloveMeshes.forEach(mesh=>{const source=mesh.skeleton;const target=source.bones.map(b=>{const match=bones.get(b.name);if(!match)throw Error('Falta articulación: '+b.name);return match});const skeleton=new THREE.Skeleton(target,source.boneInverses.map(m=>m.clone()));resources.add(skeleton);mesh.bind(skeleton,mesh.bindMatrix.clone());mesh.frustumCulled=false;scene.add(mesh);const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const m of mats){m.metalness=0;m.roughness=.85;gloveMaterials.push(m)}});
  function aim(name,childName,direction){const bone=bones.get(name),child=bones.get(childName);if(!bone||!child)return;agent.scene.updateMatrixWorld(true);const pos=bone.getWorldPosition(new THREE.Vector3()),current=child.getWorldPosition(new THREE.Vector3()).sub(pos).normalize(),q=bone.getWorldQuaternion(new THREE.Quaternion());q.premultiply(new THREE.Quaternion().setFromUnitVectors(current,new THREE.Vector3(...direction).normalize()));const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());bone.quaternion.copy(parent.invert().multiply(q));agent.scene.updateMatrixWorld(true)}
  for(const side of ['L','R']){const sign=side==='L'?1:-1;aim('arm_upper_'+side,'arm_lower_'+side,[sign*.22,-1,.06]);aim('arm_lower_'+side,'hand_'+side,[sign*.1,-1,.15])}
  const hands=['hand_L','hand_R'].map(n=>bones.get(n)?.getWorldPosition(new THREE.Vector3())).filter(Boolean);if(hands.length)handTarget.copy(hands[0]).add(hands[1]).multiplyScalar(.5);
  const textureLoader=new THREE.TextureLoader();await Promise.all(GLOVE_FINISHES.map(async option=>{const texture=await textureLoader.loadAsync('assets/agent-3d/'+option.texture);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;resources.add(texture);textures.set(option.id,texture)}));if(disposed)return;
  resize=()=>{if(disposed)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()};observer=new ResizeObserver(resize);observer.observe(host);resize();setFinish(finish);setView(view);host.dataset.ready='true';
 })().catch(error=>{if(!disposed){host.dataset.error='true';console.error('Agent viewer:',error);onError(error)}}).finally(()=>{if(disposed)for(const r of resources)r.dispose()});
 return {ready,setFinish,setView,dispose(){if(disposed)return;disposed=true;observer?.disconnect();controls?.dispose();for(const r of resources)r.dispose();renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove()}};
}
