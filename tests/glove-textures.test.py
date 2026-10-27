"""A shared source filename must not erase a compiled mask's color-index alpha."""
from pathlib import Path
import json,sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from glove_texture_resources import resolve_texture,compiled_index

class TextureIdentityTests(unittest.TestCase):
 def test_same_source_name_keeps_distinct_compiled_resources(self):
  with tempfile.TemporaryDirectory() as folder:
   stage=Path(folder);(stage/'compiled-textures').mkdir();(stage/'paints').mkdir()
   (stage/'compiled-textures/index.json').write_text(json.dumps({'mask_rgba.vtex':'rgba.png','mask_rgb.vtex':'rgb.png'}))
   original={'TextureLayerMask':'characters/sporty_glove_mask.png','g_tLayerMask':'mask_rgba.vtex'}
   other={**original,'g_tLayerMask':'mask_rgb.vtex'}
   self.assertEqual(resolve_texture(original,'TextureLayerMask',stage),stage/'compiled-textures/rgba.png')
   self.assertEqual(resolve_texture(other,'TextureLayerMask',stage),stage/'compiled-textures/rgb.png')
   self.assertNotEqual(resolve_texture(original,'TextureLayerMask',stage),stage/'paints/sporty_glove_mask.png')
   with self.assertRaises(ValueError):resolve_texture({**original,'g_tLayerMask':'missing.vtex'},'TextureLayerMask',stage)
  compiled_index.cache_clear()

 def test_modern_compositor_keeps_its_separately_exported_inputs(self):
  stage=Path('stage')
  p={'TextureObjectMaterialId':'gloves/modern_mask.png'}
  self.assertEqual(resolve_texture(p,'TextureObjectMaterialId',stage),stage/'paints/modern_mask.png')

if __name__=='__main__':unittest.main()
