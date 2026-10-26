export function applyInventoryPose(bones,presentation){
 if(!presentation?.rotations)throw Error('Falta la pose de inventario');
 // Animation clips use their own bind frame. Apply local deltas to the agent's
 // authored bind rotations so body proportions and Source-to-glTF axes survive.
 for(const[name,q]of Object.entries(presentation.rotations)){const bone=bones.get(name);if(bone&&name!=='root_motion')bone.quaternion.multiply(bone.quaternion.clone().fromArray(q)).normalize()}
 const pelvis=bones.get('pelvis');if(pelvis&&presentation.pelvisDelta){const delta=presentation.pelvisDelta;pelvis.position.x+=delta[0];pelvis.position.y+=delta[1];pelvis.position.z+=delta[2]}
}
