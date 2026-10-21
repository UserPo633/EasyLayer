import {slots,scenarios,describe,nextStep} from './engine.mjs';
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text=(x,y,t,size=24,color='#142d32',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(t)}</text>`;
const rect=(x,y,w,h,fill,rx=20,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
function wrap(t,max=48){const lines=[];let l='';for(const w of t.split(' ')){if((l+' '+w).length>max){lines.push(l);l=w;}else l+=(l?' ':'')+w;}if(l)lines.push(l);return lines;}
export function renderScene(s,{chapter='INTERACTIVE DEMO',caption='',progress=0,focus=''}={}){
 const statusColor=s.status==='unknown'||s.status==='conflict'?'#a45b15':'#087569';
 let inner=rect(0,0,1440,810,'#f1f2eb',0)+rect(0,0,1440,90,'#132e33',0);
 inner+=text(46,57,'easy',38,'#fff',700)+text(145,57,'layer',38,'#96e5ca',700)+text(300,51,'A clearer way to finish.',18,'#d2dfda');
 inner+=rect(1097,28,297,35,'#29454a',18)+text(1116,52,'ALEXA+ EXPERIENCE SIMULATION',13,'#dff7ee',600);
 inner+=text(48,133,chapter,14,'#53746e',700)+text(48,184,describe(s),38,'#142d32',650)+text(48,222,nextStep(s),22,'#556b69');
 inner+=rect(48,254,876,430,'#fff',24)+rect(948,254,444,430,'#e3eae0',24);
 inner+=rect(76,283,72,72,'#deeee5',19)+`<path d="M97 302h30l-4 32H101z M94 302h36" stroke="#087569" stroke-width="4" fill="none"/><path d="M104 295q10-15 20 0" stroke="#087569" stroke-width="3" fill="none"/>`;
 inner+=text(169,311,'Pottery for beginners',28,'#142d32',650)+text(169,343,'Clay House Studio · fictional provider',18,'#607270');
 inner+=`<line x1="76" y1="379" x2="894" y2="379" stroke="#e1e7e1"/>`;
 inner+=text(76,416,'SAT, NOV 14, 2026 · SAMPLE',14,'#607270',650)+text(686,416,'60 MIN  /  USD $35',16,'#142d32',600);
 slots.forEach((slot,i)=>{inner+=rect(76+i*277,441,258,64,i===s.slot?'#0b776b':'#f0f3ee',15,i===s.slot?'#0b776b':'#d5dfd7')+text(104+i*277,481,slot,23,i===s.slot?'#fff':'#31534f',600);});
 inner+=text(76,549,'CONTACT',12,'#6d817d',650)+text(76,580,'Alex Demo',22,'#142d32',600)+text(76,609,'Fictional contact · no personal data needed',17,'#607270');
 inner+=text(76,645,'TIME ZONE: America/Los_Angeles',12,'#607270');
 const stateLabel=({choose:'Not booked',draft:s.approved?'Approved · not booked':'Draft · not booked',paused:'Paused · not booked',unknown:'Outcome unknown',verified:'Verified sample record',conflict:'Stopped · no booking'})[s.status];
 inner+=rect(558,542,335,76,s.status==='unknown'||s.status==='conflict'?'#fff1d8':'#e5f3e9',14)+text(579,572,'CURRENT STATE',11,statusColor,650)+text(579,602,stateLabel,21,statusColor,650);
 inner+=text(978,295,'A result you can trust',25,'#142d32',650)+text(978,331,'Scenario: '+scenarios[s.scenario],17,'#536b65');
 inner+=rect(978,356,384,117,'#fff',17)+text(1001,392,'SAMPLE RECORDS',12,'#607270',650)+text(1001,446,String(s.records.length).padStart(2,'0'),48,'#0b776b',650)+text(1080,438,s.records.length===1?'One sample record.':s.records.length?'Multiple records. Check needed.':'Nothing written yet.',17,'#526d67');
 inner+=text(978,512,'LATEST EVENT',12,'#607270',650);
 wrap(s.events.at(-1),35).slice(0,4).forEach((l,i)=>inner+=text(978,546+i*26,l,19,'#284e47',500));
 const step=s.status==='choose'?0:['draft','paused'].includes(s.status)?1:s.status==='verified'?3:2;
 ['CHOOSE','REVIEW','CHECK','VERIFIED'].forEach((l,i)=>{inner+=rect(48+i*220,714,206,5,i<=step?'#0b776b':'#c9d6cc',2)+text(48+i*220,746,l,13,i<=step?'#0b776b':'#6d817d',650);});
 inner+=text(1392,744,'SAMPLE DATA · NO REAL APPOINTMENTS',12,'#607270',600).replace('x="1392"','x="1392" text-anchor="end"');
 if(caption)inner+=rect(0,758,1440,52,'#132e33',0)+text(720,792,caption,20,'#fff',500).replace('x="720"','x="720" text-anchor="middle"');
 if(focus==='record')inner+=`<rect x="974" y="352" width="392" height="125" rx="21" stroke="#e7a43f" stroke-width="4" fill="none"/>`;
 if(focus==='time')inner+=`<rect x="72" y="437" width="816" height="72" rx="19" stroke="#e7a43f" stroke-width="4" fill="none"/>`;
 if(progress>0)inner+=rect(0,805,1440*Math.min(progress,1),5,'#88ddbb',0);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 810" role="img" aria-label="${esc(describe(s))}" font-family="DejaVu Sans, Arial, sans-serif">${inner}</svg>`;
}
