"""Retiming for the downloaded ElevenLabs Kayleigh / Eleven v4 take.

Sentence boundaries follow measured pauses in the 132.754-second source.
Run after render-video.mjs has produced the storyboard PNGs. This script
reuses those exact visuals and publishes the narrated export atomically.
"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.build/video-render'
ASSETS = ROOT / 'dist/assets'
AUDIO = ASSETS / 'narration-en.mp3'
OUT = WORK / 'narrated'
OUT.mkdir(exist_ok=True)
PARAGRAPHS = (ROOT / 'scripts/narration.txt').read_text().strip().split('\n\n')
CHAPTERS = json.loads((WORK / 'chapters.json').read_text())

# Per-sentence starts and ends, in source-audio seconds.
TIMES = [
 [(0,3.896),(4.351,9.912)],
 [(10.588,13.287),(13.681,17.470)],
 [(18.050,19.524),(20.148,24.550),(25.020,29.928)],
 [(30.386,33.351),(33.830,37.307)],
 [(37.880,39.529),(39.957,41.710),(42.155,44.963),(45.368,48.026)],
 [(48.517,51.686),(52.130,56.129),(56.588,58.901)],
 [(59.382,63.530),(63.985,68.129),(68.505,70.763)],
 [(71.242,73.856),(74.348,77.721),(78.220,82.415),(82.855,84.581)],
 [(85.125,89.813),(90.201,94.939)],
 [(95.546,103.464),(103.834,106.110),(106.412,109.995)],
 [(110.377,116.584),(116.963,120.440)],
 [(120.952,127.632),(128.017,132.529)],
]
DURATION = 134.0  # Brief end hold, with padded silence after the narration.

def stamp(t, sep='.'):
    ms = round(t * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'

captions = []
for p, spans in zip(PARAGRAPHS, TIMES, strict=True):
    sentences = re.split(r'(?<=[.!?])\s+', p)
    assert len(sentences) == len(spans), (p, sentences, spans)
    for sentence, (start,end) in zip(sentences, spans, strict=True):
        # At most two lines within the existing 93-pixel caption band.
        # Split the longest sentence at its measured pause after "drafts".
        if sentence.startswith('The downloadable Python'):
            captions.extend([(start,99.680,'The downloadable Python project contains the self-hosted MCP server, persistent drafts,'),
                             (99.680,end,'and an adapter targeting Easy Appointments.')])
        else:
            captions.append((start,end,sentence))

vtt = 'WEBVTT\n\n'
srt = ''
for i,(start,end,text) in enumerate(captions,1):
    lines = textwrap.wrap(text, width=78, break_long_words=False)
    assert len(lines) <= 2
    body = '\n'.join(lines)
    vtt += f'{stamp(start)} --> {stamp(end+0.12)}\n{body}\n\n'
    srt += f'{i}\n{stamp(start,",")} --> {stamp(end+0.12,",")}\n{body}\n\n'
(OUT/'captions.srt').write_text(srt)
(ASSETS/'captions.vtt').write_text(vtt)

starts = [0] + [(TIMES[i-1][-1][1]+TIMES[i][0][0])/2 for i in range(1,len(TIMES))]
ends = starts[1:] + [DURATION]
# Action changes now land on their spoken explanation.
changes = {2:27.6, 4:41.2, 5:51.7, 7:81.9}
clips=[]
for i,(c,start,end) in enumerate(zip(CHAPTERS,starts,ends,strict=True)):
    boundaries = [start] + ([changes[i]] if i in changes else []) + [end]
    for j in range(len(boundaries)-1):
        image = WORK / f'scene-{i:02}-{j}.png'
        assert image.is_file(), image
        clips.append((image,boundaries[j+1]-boundaries[j]))
timeline = {'voice':'Kayleigh - Poised Tech Tutorial Narrator','provider':'ElevenLabs','model':'Eleven v4',
            'source_seconds':132.75425,'export_seconds':DURATION,'sentence_timing_method':'Measured pauses, manually matched to the script',
            'chapters':[{'chapter':c['chapter'],'start':start,'end':end} for c,start,end in zip(CHAPTERS,starts,ends)],
            'captions':[{'start':s,'end':e,'text':t} for s,e,t in captions]}
(ROOT/'scripts/narration-timing.json').write_text(json.dumps(timeline,indent=2)+'\n')
(OUT/'concat.txt').write_text('\n'.join(f"file '{p}'\nduration {d:.6f}" for p,d in clips)+f"\nfile '{clips[-1][0]}'\n")
(ASSETS/'transcript.txt').write_text('EasyLayer — Demo transcript\n\nEnglish narration: ElevenLabs / Kayleigh - Poised Tech Tutorial Narrator / Eleven v4.\nCaptioned automated walkthrough. Sample data only.\n\n'+'\n\n'.join(PARAGRAPHS)+'\n')
vf = f"fps=24,drawbox=x=0:y=987:w=iw:h=93:color=0x10272e@0.94:t=fill,subtitles={OUT}/captions.srt:force_style='FontName=DejaVu Sans,FontSize=9,PrimaryColour=&H00FFFFFF,OutlineColour=&H00273213,Outline=1,Shadow=0,MarginV=3,Alignment=2',drawbox=x=0:y=1076:w=iw:h=4:color=0x4a7564:t=fill"
subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-y','-threads','2','-filter_threads','1',
 '-f','concat','-safe','0','-i',str(OUT/'concat.txt'),'-i',str(AUDIO),
 '-map','0:v:0','-map','1:a:0','-vf',vf,'-af','loudnorm=I=-18:TP=-1.5:LRA=7,apad','-t',str(DURATION),
 '-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-pix_fmt','yuv420p',
 '-c:a','aac','-b:a','160k','-ar','44100','-metadata:s:a:0','language=eng','-movflags','+faststart',
 str(OUT/'final.mp4')],check=True)
shutil.copyfile(OUT/'final.mp4',ASSETS/'EasyLayer_Demo.mp4')
print(json.dumps({'duration':DURATION,'chapters':len(CHAPTERS),'captions':len(captions),'video':str(ASSETS/'EasyLayer_Demo.mp4')}))
