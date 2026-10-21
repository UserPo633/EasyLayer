/* DOM integration tests in jsdom. No browser, layout engine, microphone or AWS. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {snapshot}=require('../ui/source.js');
const html=fs.readFileSync('EasyLayer_Conversation_Preview.html','utf8');
function page(){
 const dom=new JSDOM(html,{url:'https://easylayer.test',runScripts:'outside-only'});
 dom.window.fetch=async()=>({ok:false,status:503});
 for(const script of dom.window.document.querySelectorAll('script'))dom.window.eval(script.textContent);
 const d=dom.window.document;
 function click(selector){const n=d.querySelector(selector);assert.ok(n,'Missing '+selector);n.click();}
 function input(selector,value){const n=d.querySelector(selector);assert.ok(n,'Missing '+selector);n.value=value;n.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}
 async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('DOM transition did not finish: '+d.querySelector('#title').textContent+' / '+d.querySelector('#status').textContent);}
 async function ready(){click('[data-action="connect"]');await until(()=>!!d.querySelector('[data-action="service:1"]'));click('[data-action="service:1"]');await until(()=>!!d.querySelector('#date'));}
 async function times(){input('#date','2099-09-22');click('[data-action="hours"]');await until(()=>!!d.querySelector('[data-action="hour:10:00"]'));}
 async function request(text){input('#request',text);click('#send');await until(()=>!d.querySelector('#send').disabled);}
 async function contact(){for(const [k,v] of Object.entries({first_name:'Synthetic',last_name:'User',email:'synthetic@example.invalid'}))input('#field-'+k,v);click('#contact-form button');await until(()=>!!d.querySelector('#approve'));}
 return {dom,d,click,input,until,ready,times,request,contact};
}
test('DOM: initial render, language switch, and basic date/time conversation',async()=>{
 const p=page();try{await p.ready();await p.request('2099-09-24 morning');assert.match(p.d.querySelector('#title').textContent,/options/);await p.request('second');assert.ok(p.d.querySelector('#contact-form'));p.click('#language');assert.match(p.d.querySelector('#title').textContent,/연락처/);assert.equal(p.d.documentElement.lang,'ko');}finally{p.dom.window.close();}
});
test('DOM: final review shows contacts; production controller recovers fixture conflict with a new approval',async()=>{
 const p=page();try{await p.ready();await p.times();p.click('[data-action="hour:10:00"]');await p.contact();assert.match(p.d.querySelector('#content').textContent,/synthetic@example.invalid/);
 p.click('#approve');assert.equal(p.d.querySelector('[data-action="submit"]').disabled,false);p.click('#fixture-conflict');p.click('[data-action="submit"]');await p.until(()=>!!p.d.querySelector('[data-action="hour:09:00"]'));
 assert.match(p.d.querySelector('#status').textContent,/just taken/);p.click('[data-action="hour:09:00"]');await p.until(()=>!!p.d.querySelector('#approve'));assert.equal(p.d.querySelector('#approve').checked,false);assert.match(p.d.querySelector('#content').textContent,/synthetic@example.invalid/);
 p.click('#approve');p.click('[data-action="submit"]');await p.until(()=>p.d.querySelector('#title').textContent==='Your demo is complete.');assert.match(p.d.querySelector('#assistant-line').textContent,/No real reservation/);
 }finally{p.dom.window.close();}
});
test('DOM: language change keeps typed contacts and clears confirmation',async()=>{
 const p=page();try{await p.ready();await p.times();p.click('[data-action="hour:10:00"]');p.input('#field-first_name','Kept');p.click('#language');assert.equal(p.d.querySelector('#field-first_name').value,'Kept');await p.contact();p.click('#approve');p.click('#language');assert.equal(p.d.querySelector('#approve').checked,false);assert.equal(p.d.querySelector('[data-action="submit"]').disabled,true);}finally{p.dom.window.close();}
});
test('DOM: unsupported speech and unavailable AI keep touch controls usable',async()=>{
 const p=page();try{await p.ready();p.click('[data-action="speak"]');assert.match(p.d.querySelector('#status').textContent,/Speech is unavailable/);
 p.d.querySelector('#planner-mode').options[0].disabled=false;p.d.querySelector('#planner-mode').value='bedrock';await p.request('Thursday morning instead');assert.match(p.d.querySelector('#status').textContent,/AI is unavailable/);assert.equal(p.d.querySelector('[data-action="hours"]').disabled,false);
 }finally{p.dom.window.close();}
});
test('DOM: lost-response fixture cannot be submitted twice',async()=>{
 const p=page();try{await p.ready();await p.times();p.click('[data-action="hour:10:00"]');await p.contact();p.click('#fixture-lost');p.click('#approve');p.click('[data-action="submit"]');await p.until(()=>p.d.querySelector('#title').textContent==='Let’s check before trying again.');assert.equal(p.d.querySelector('[data-action="submit"]'),null);assert.equal(p.d.querySelector('#conversation').hidden,true);
 }finally{p.dom.window.close();}
});
test('DOM source parsing respects HttpOnly page contract and unsupported custom required fields',()=>{
 const dom=new JSDOM('');global.DOMParser=dom.window.DOMParser;
 try{
 const vars={csrf_token:'fixture-only',available_services:[{id:1,name:'Photography',price:'10',duration:'30'}],available_providers:[]};
 const h='<script>const vars = '+JSON.stringify(vars)+';</script><div id="wizard-frame-3"><input id="first-name" class="required" maxlength="100"></div>';
 const s=snapshot(h);assert.equal(s.services[0].price,10);assert.equal(s.inputs[0].required,true);assert.equal(s.unsupported,false);
 assert.equal(snapshot(h.replace('</div>','<input id="custom-field-1" required></div>')).unsupported,true);
 }finally{delete global.DOMParser;dom.window.close();}
});
