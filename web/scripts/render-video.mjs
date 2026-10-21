import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';import sharp from 'sharp';import{spawnSync}from'node:child_process';
import{initial,transition}from'../dist/engine.mjs';import{renderScene}from'../dist/scene.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(project);
const out=path.join(project,'.build/video-render');fs.mkdirSync(out,{recursive:true});
const assets=path.resolve('dist/assets');const paragraphs=fs.readFileSync('scripts/narration.txt','utf8').trim().split(/\n\n+/);
const run=(s,...a)=>a.reduce(transition,s);let s=initial('lost');
const selected=run(s,'later'),draft=run(selected,'draft'),paused=run(draft,'pause'),resumed=run(paused,'resume'),approved=run(resumed,'approve'),unknown=run(approved,'submit'),blocked=run(unknown,'submit'),verified=run(blocked,'verify');
const changed=run(initial('changed'),'later','draft','approve','submit');
const config=[
 {chapter:'01 / THE PROBLEM',state:s,title:true},
 {chapter:'02 / WHAT YOU ARE WATCHING',state:s,caption:'Alexa+ experience simulation · Sample data only'},
 {chapter:'03 / CHOOSE A TIME',state:s,changes:[{at:.66,state:selected}],focus:'time',caption:'Guided command: “later” → 11:30 AM'},
 {chapter:'04 / SAVE A DRAFT',state:draft,caption:'A draft is not a booking.'},
 {chapter:'05 / PAUSE AND RESUME',state:paused,changes:[{at:.52,state:resumed}],caption:'Pause → Resume · Same draft, same time'},
 {chapter:'06 / EXPLICIT APPROVAL',state:resumed,changes:[{at:.46,state:approved}],caption:'Review → Approve → Submit'},
 {chapter:'07 / THE RESPONSE IS LOST',state:unknown,focus:'record',caption:'One sample record exists. The outcome is still unknown.'},
 {chapter:'08 / CHECK BEFORE REPEATING',state:blocked,changes:[{at:.56,state:verified}],focus:'record',caption:'Repeat blocked → Read existing record → Verify'},
 {chapter:'09 / AVAILABILITY CHANGES',state:changed,focus:'time',caption:'No write. Choose again. Review again.'},
 {chapter:'10 / THE IMPLEMENTATION',state:verified,architecture:true},
 {chapter:'11 / EVIDENCE AND NEXT STEPS',state:verified,evidence:true},
 {chapter:'12 / TRY EASYLAYER',state:verified,closing:true}
];
if(paragraphs.length!==config.length)throw Error('Timeline mismatch '+paragraphs.length);
const escape=x=>x.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function special(type){let title,sub,items;
 if(type==='title'){title=['One booking.','A clear next step.'];sub='EasyLayer · Alexa+ experience simulation';items=['Clear choices','Recoverable progress','An honest result'];}
 if(type==='architecture'){title=['Designed as a guided experience.','Built with verifiable state.'];sub='This site runs a browser simulation. The backend is a separate download.';items=['Browser demo / Sample state + local drafts','Python backend / Self-hosted MCP + SQLite','Source adapter / Targets Easy!Appointments 1.6'];}
 if(type==='evidence'){title=['117 recorded backend tests.','The next step is real-world validation.'];sub='Controlled test sources · Earlier v0.4 release';items=['Covered / Draft lifecycle and source contracts','Next / Native Alexa and live service integration','Next / Accessibility and real-user testing'];}
 if(type==='closing'){title=['Clear choices. Recoverable progress.','An honest result.'];sub='Try the interactive demo. Explore the failure cases. Inspect the source.';items=['easylayer-demo-studio.tnqlsdl0721.chatgpt.site','Sample appointments · No real bookings','EasyLayer / Build · Ship · Shape'];}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="810" viewBox="0 0 1440 810" font-family="DejaVu Sans,Arial,sans-serif"><rect width="1440" height="810" fill="#132e33"/><circle cx="1350" cy="50" r="420" fill="#21473e"/><circle cx="1350" cy="50" r="320" fill="none" stroke="#355d4f"/><text x="75" y="88" font-size="36" fill="#fff" font-weight="700">easy<tspan fill="#96e5ca">layer</tspan></text><text x="75" y="195" font-size="15" fill="#96e5ca" letter-spacing="3">ALEXA+ EXPERIENCE SIMULATION</text>${title.map((x,i)=>`<text x="75" y="${280+i*72}" font-size="${type==='title'?65:43}" fill="${i?'#96e5ca':'#fff'}" font-weight="500">${escape(x)}</text>`).join('')}<text x="75" y="410" font-size="23" fill="#c1d3c8">${escape(sub)}</text>${items.map((x,i)=>`<line x1="75" y1="${473+i*67}" x2="1360" y2="${473+i*67}" stroke="#3d5c51"/><text x="75" y="${514+i*67}" font-size="15" fill="#76b69c">0${i+1}</text><text x="130" y="${514+i*67}" font-size="24" fill="#eaf2e8">${escape(x)}</text>`).join('')}<text x="75" y="730" font-size="13" fill="#91afa0">SAMPLE DATA · NO NATIVE ALEXA CONNECTION · NO LIVE BOOKING SERVICE</text></svg>`;
}
// Reading pace: 145 words/minute plus a small pause per chapter.
const chapters=[];let elapsed=0;for(let i=0;i<paragraphs.length;i++){const words=paragraphs[i].split(/\s+/).length;const duration=Math.max(7,words/145*60+1.4);chapters.push({start:elapsed,duration,paragraph:paragraphs[i],...config[i]});elapsed+=duration;}
const time=t=>{let ms=Math.round(t*1000);const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);ms%=60000;const s=Math.floor(ms/1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
let vtt='WEBVTT\n\n',srt='',n=1;const clips=[];
for(let i=0;i<chapters.length;i++){
 const c=chapters[i];const chunks=c.paragraph.match(/.{1,90}(?:\s|$)/g)||[c.paragraph];if(chunks.length>1&&chunks.at(-1).trim().length<25)chunks[chunks.length-2]+=chunks.pop();let local=0;
 for(const chunk of chunks){const duration=c.duration*chunk.trim().split(/\s+/).length/c.paragraph.split(/\s+/).length;const start=c.start+local,end=Math.min(c.start+c.duration,start+duration);vtt+=`${time(start)} --> ${time(end)}\n${chunk.trim()}\n\n`;srt+=`${n++}\n${time(start).replace('.',',')} --> ${time(end).replace('.',',')}\n${chunk.trim()}\n\n`;local+=duration;}
 const changes=[{at:0,state:c.state},...(c.changes||[]),{at:1}];
 for(let j=0;j<changes.length-1;j++){
  const f=`${out}/scene-${String(i).padStart(2,'0')}-${j}.png`;const type=['title','architecture','evidence','closing'].find(k=>c[k]);let svg=type?special(type):renderScene(changes[j].state,{chapter:c.chapter,caption:c.caption||'',focus:c.focus||''});
  await sharp(Buffer.from(svg)).resize(1920,1080).png().toFile(f);clips.push({file:f,duration:c.duration*(changes[j+1].at-changes[j].at)});
 }
}
const poster=renderScene(verified,{chapter:'EASYLAYER / THE DEMO',caption:'One booking. A clear next step.',focus:'record'});await sharp(Buffer.from(poster)).png().toFile(`${assets}/poster.png`);
fs.writeFileSync(`${out}/captions.srt`,srt);fs.writeFileSync(`${assets}/captions.vtt`,vtt);fs.writeFileSync(`${assets}/transcript.txt`,'EasyLayer — Demo transcript\n\nCaptioned automated walkthrough. Sample data only. No voice track.\n\n'+paragraphs.join('\n\n')+'\n');fs.writeFileSync(`${out}/chapters.json`,JSON.stringify(chapters,null,2));
fs.writeFileSync(`${out}/concat.txt`,clips.map(c=>`file '${c.file}'\nduration ${c.duration.toFixed(3)}`).join('\n')+`\nfile '${clips.at(-1).file}'\n`);
console.log(JSON.stringify({seconds:elapsed,chapters:chapters.length,shots:clips.length,frames:out}));
const vf=`fps=24,scale=1920:1080,drawbox=x=0:y=987:w=iw:h=93:color=0x10272e@0.94:t=fill,subtitles=${out}/captions.srt:force_style='FontName=DejaVu Sans,FontSize=9,PrimaryColour=&H00FFFFFF,OutlineColour=&H00273213,Outline=1,Shadow=0,MarginV=3,Alignment=2',drawbox=x=0:y=1076:w=iw:h=4:color=0x4a7564:t=fill`;
const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-threads','2','-filter_threads','1','-f','concat','-safe','0','-i',`${out}/concat.txt`,'-vf',vf,'-r','24','-t',elapsed.toFixed(3),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',`${assets}/EasyLayer_Demo.mp4`],{stdio:'inherit'});if(r.status)process.exit(r.status);console.log('Video complete.');
