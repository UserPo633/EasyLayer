import{initial,transition,slots,describe,nextStep}from'./engine.mjs';import{renderScene}from'./scene.mjs';
const $=s=>document.querySelector(s);let state=initial();const key='easylayer-demo-v1';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&['normal','lost','changed'].includes(saved.scenario)&&['choose','draft','paused','unknown','verified','conflict'].includes(saved.status)&&Array.isArray(saved.records)&&Array.isArray(saved.events)&&Number.isInteger(saved.slot)&&saved.slot>=0&&saved.slot<3)state=saved;}catch{}
const button=(label,action,primary=false,disabled=false)=>`<button data-action="${action}" class="${primary?'primary':''}" ${disabled?'disabled':''}>${label}</button>`;
function render(){
 $('#board').innerHTML=renderScene(state);$('#scenario').value=state.scenario;$('#status-title').textContent=describe(state);$('#status-detail').textContent=nextStep(state);
 $('#mobile-summary').innerHTML=`<p class="eyebrow">SAMPLE APPOINTMENT</p><strong>Pottery for beginners</strong><p>Clay House Studio · Sat, Nov 14 (sample date)</p><p><b>${slots[state.slot]}</b> · 60 minutes · $35</p><p>Contact: Alex Demo (fictional)</p><span class="badge">${state.records.length} sample record${state.records.length===1?'':'s'} · No real booking</span>`;
 let c='';
 if(['choose','conflict'].includes(state.status)){c=button('Earlier','earlier')+button('Later','later')+button(state.status==='conflict'?'Choose a new time':'Save this draft','draft',true);}
 if(state.status==='draft')c=`<label class="approval"><input type="checkbox" id="approval" ${state.approved?'checked':''}> I approve this exact sample appointment.</label>`+button('Change time','later')+button('Pause','pause')+button('Discard draft','discard')+button('Submit sample booking','submit',true,!state.approved);
 if(state.status==='paused')c=button('Discard draft','discard')+button('Resume my draft','resume',true);
 if(state.status==='unknown')c=button('Try repeat submission','submit')+button('Check existing record','verify',true);
 if(state.status==='verified')c=button('Test duplicate prevention','submit')+button('Start again','reset',true);
 $('#controls').innerHTML=c;$('#live-status').textContent=describe(state)+'. '+state.events.at(-1);$('#event-log').replaceChildren(...state.events.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 try{localStorage.setItem(key,JSON.stringify(state));}catch{}
}
function act(a){state=transition(state,a);render();}
$('#controls').addEventListener('click',e=>{const a=e.target.closest('[data-action]');if(a)act(a.dataset.action);});$('#controls').addEventListener('change',e=>{if(e.target.id==='approval')act('approve');});
$('#scenario').addEventListener('change',e=>{state=initial(e.target.value);render();});$('#reset').addEventListener('click',()=>act('reset'));
$('#command-form').addEventListener('submit',e=>{e.preventDefault();const q=$('#command').value.trim().toLowerCase().replace(/[.!?]/g,'');if(['later','earlier','pause','resume'].includes(q))act(q);else {state.events.push(q==='read summary'?`Pottery for beginners, ${slots[state.slot]}, 60 minutes, $35. ${describe(state)}.`:'Try later, earlier, pause, resume, or read summary.');render();}$('#command').value='';});render();
