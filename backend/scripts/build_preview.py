"""Generate offline simulation preview from its single source of truth."""
from pathlib import Path
root=Path(__file__).resolve().parent.parent
html=(root/'ui/index.html').read_text()
for name in ('flow.js','ui.js'):
 html=html.replace(f'<script src="{name}"></script>','<script>'+(root/'ui'/name).read_text()+'</script>')
(root/'EasyLayer_Consumer_Preview.html').write_text(html)
print('Generated EasyLayer_Consumer_Preview.html (offline simulation only)')
