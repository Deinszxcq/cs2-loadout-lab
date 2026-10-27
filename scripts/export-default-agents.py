"""Extract the original SAS/Phoenix defaults from a local CS2 installation."""
import importlib.util,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('builder',ROOT/'scripts/build-all-agent-assets.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
game=Path(os.environ.get('CS2_GAME_DIR','C:/Program Files (x86)/Steam/steamapps/common/Counter-Strike Global Offensive/game/csgo'))
cli=ROOT/'.local-tools/source2viewer/Source2Viewer-CLI.exe';manifest=ROOT/'dist/agent-3d-catalog.json';assets=json.loads(manifest.read_text(encoding='utf-8'));assets['defaults']={}
for index,(team,model,pose) in enumerate([('CT','ctm_sas','cu_ct_pose02'),('T','tm_phoenix','cu_t_pose01')]):
 target=ROOT/f'.local-tools/all-3d/default-{index}/model.glb';target.parent.mkdir(parents=True,exist_ok=True)
 common=[str(cli),'-i',str(game/'pak01_dir.vpk'),'-d','--game',str(game/'gameinfo.gi')]
 if not target.exists():subprocess.run(common+['-f',f'agents/models/{model}/{model}.vmdl_c','-o',str(target),'--gltf_export_format','glb','--gltf_mesh_list','thirdperson_body,thirdperson_default_gloves','--gltf_export_animations','--gltf_animation_list','lab_no_animation','--gltf_export_materials','--gltf_textures_adapt','--gltf_export_extras'],check=True,capture_output=True)
 path=f'assets/equipment-3d/agents/default-{team.lower()}.glb';builder.pack(target,ROOT/'dist'/path)
 icon=ROOT/f'dist/assets/agents/default-{team.lower()}.png'
 if not icon.exists():subprocess.run(common+['-f',f'panorama/images/econ/characters/customplayer_{model}_png.vtex_c','-o',str(icon)],check=True,capture_output=True)
 assets['defaults'][team]={'model':path,'team':team,'pose':pose,'eyes':[]}
manifest.write_text(json.dumps(assets,separators=(',',':'))+'\n',encoding='utf-8')
print('Default SAS and Phoenix models and inventory icons exported.')
