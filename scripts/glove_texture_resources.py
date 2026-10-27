"""Resolve texture identity before reading an extracted glove image."""
from pathlib import Path
from functools import lru_cache
import json

def compiled_key(key):
 return 'g_tSurface' if key=='TextureSurfaceProperties' else 'g_t'+key.removeprefix('Texture')

@lru_cache(maxsize=None)
def compiled_index(stage):
 return json.loads((stage/'compiled-textures/index.json').read_text(encoding='utf8'))

def resolve_texture(params,key,stage):
 resource=params.get(compiled_key(key))
 if resource and 'TextureObjectMaterialId' not in params:
  # Material extraction reuses source names even when compiled channels differ.
  # In particular, an RGB mask must never replace an RGBA color-index mask.
  index=compiled_index(stage)
  if resource not in index:raise ValueError('Export compiled glove textures first: '+resource)
  return stage/'compiled-textures'/index[resource]
 filename=Path(params[key].replace('\\','/')).name
 file=stage/'paints'/filename
 return file if file.exists() else file.with_suffix('.png')
