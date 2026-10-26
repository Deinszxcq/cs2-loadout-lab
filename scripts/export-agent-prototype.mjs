import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const game=process.env.CS2_GAME_DIR||'C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo';
const cli=path.join(root,'.local-tools/source2viewer/Source2Viewer-CLI.exe');
if(!fs.existsSync(cli))throw Error('Install the official Source 2 Viewer CLI in .local-tools/source2viewer first (see README).');
const sources=[['agents/models/tm_professional/tm_professional_vari.vmdl_c','number-k/model.glb','thirdperson_body'],['agents/models/shared/arms/glove_sporty/glove_sporty.vmdl_c','gloves/model.glb','worldmodel'],['gloves/paints/sporty_green.vmat_c','gloves/sporty_green.vmat'],['gloves/paints/sporty_blue_pink.vmat_c','gloves/sporty_blue_pink.vmat']];
for(const [resource,file,mesh]of sources){const target=path.join(root,'.local-tools/export',file);fs.mkdirSync(path.dirname(target),{recursive:true});const args=['-i',path.join(game,'pak01_dir.vpk'),'-f',resource,'-o',target,'-d','--game',path.join(game,'gameinfo.gi')];if(mesh)args.push('--gltf_export_format','glb','--gltf_mesh_list',mesh,'--gltf_export_animations','--gltf_animation_list','lab_no_animation','--gltf_export_materials','--gltf_textures_adapt','--gltf_export_extras');const result=spawnSync(cli,args,{windowsHide:true,stdio:'inherit',timeout:180000});if(result.status!==0||result.error)throw Error('Export failed: '+resource)}
