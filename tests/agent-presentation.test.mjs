import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three/three.module.js';
import {applyInventoryPose} from '../dist/agent-presentation.mjs';
const assets=JSON.parse(fs.readFileSync(new URL('../dist/agent-3d-catalog.json',import.meta.url),'utf8'));
function model(file){const bytes=fs.readFileSync(new URL('../dist/'+file,import.meta.url));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())}
test('all agents retain finite upright inventory poses in their own bind frame',()=>{
 for(const[id,spec]of Object.entries(assets.agents)){
  const pose=assets.poses[spec.pose];assert(pose,id);assert(!pose.rotations.root_motion);
  const data=model(spec.model);const nodes=data.nodes.map(node=>{const object=new THREE.Object3D();object.name=node.name;if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale)}return object});
  data.nodes.forEach((node,i)=>(node.children||[]).forEach(child=>nodes[i].add(nodes[child])));const bones=new Map(nodes.map(node=>[node.name,node]));const originalRoot=bones.get('root_motion').quaternion.clone();applyInventoryPose(bones,pose);nodes[0].updateMatrixWorld(true);assert(bones.get('root_motion').quaternion.equals(originalRoot));
  for(const bone of nodes){assert(bone.matrixWorld.elements.every(Number.isFinite),id+' '+bone.name);assert(Math.abs(bone.quaternion.length()-1)<.0001)}
  const head=bones.get('head_0').getWorldPosition(new THREE.Vector3());assert(head.y>1.4&&head.y<2.2,id+' head outside frame');for(const name of ['ankle_L','ankle_R']){const foot=bones.get(name).getWorldPosition(new THREE.Vector3());assert(foot.y>-.1&&foot.y<.4,id+' foot height')}
 }
});
test('procedural eye materials have baked iris/pupil textures without painting the whole eye black',()=>{
 const eyeMaterials=Object.values(assets.agents).flatMap(a=>a.eyes);assert.equal(eyeMaterials.length,42);
 for(const eye of eyeMaterials){assert(eye.pupilPixels>0,eye.color);assert(eye.pupilPixels<eye.pixels*.4,eye.color);assert(fs.statSync(new URL('../dist/'+eye.color,import.meta.url)).size>1000)}
 const mae=assets.agents['agent-4711'];assert.equal(mae.pose,'cu_ct_pose05');assert(mae.eyes.some(e=>e.material==='ctm_swat_lead_head'));
});
