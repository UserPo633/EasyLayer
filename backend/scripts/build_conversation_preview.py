"""Build a clearly labelled, self-contained interaction simulation (no server/AI)."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
html=(ROOT/'ui/connected.html').read_text()
html=html.replace('<link rel="stylesheet" href="connected.css">','<style>'+(ROOT/'ui/connected.css').read_text()+'</style>')
html=html.replace('<p id="connection"', '<section class="notice" aria-label="Simulation controls"><strong>INTERACTION SIMULATION — no real booking or AI call</strong><p class="small">Use fictional contacts. These controls intentionally simulate failures for review.</p><div class="row"><button id="fixture-conflict">Simulate 10:00 taken</button><button id="fixture-lost">Simulate lost response</button></div><p id="fixture-status" class="small" aria-live="polite"></p></section><p id="connection"')
for name in ['source.js','booking-session.js','basic-commands.js','connected.js']:
    code=(ROOT/'ui'/name).read_text()
    if name=='connected.js':code=(ROOT/'tests/fixture-source.js').read_text()+'\n'+code+'\n$("planner-mode").value="basic";$("planner-mode").options[0].disabled=true;$("original").removeAttribute("href");$("original").textContent="Simulation only · no original site";'
    html=html.replace('<script src="'+name+'"></script>','<script>\n'+code.replace('</script','<\\/script')+'\n</script>')
(ROOT/'EasyLayer_Conversation_Preview.html').write_text(html)
print('Built EasyLayer_Conversation_Preview.html (simulation only)')
