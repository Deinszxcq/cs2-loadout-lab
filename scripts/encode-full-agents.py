from PIL import Image
from pathlib import Path
import json
p=Path('dist/agents.json'); agents=json.loads(p.read_text())
for a in agents:
 src=Path('dist')/a['fullImage'];
 if src.suffix=='.webp': continue
 dest=src.with_suffix('.webp'); Image.open(src).save(dest,'WEBP',quality=88,method=6); src.unlink(); a['fullImage']=a['fullImage'].replace('.png','.webp')
p.write_text(json.dumps(agents,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print(sum(p.stat().st_size for p in Path('dist/assets/agents/full').glob('*')))
