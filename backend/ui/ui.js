'use strict';
const {Flow,services,slots}=EasyFlow;let flow=new Flow(),step='start',expanded=false,scenario='success',message='',privateVisible=false;let available=slots(),lastFocusedStep=null;
const $=id=>document.getElementById(id);const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const money=s=>s.price===0?'무료':`${s.price}달러 (USD)`;const button=(text,action,cls='')=>`<button class="${cls}" data-action="${action}">${text}</button>`;
function render(focus=true){
 available=slots();
 const locked=flow.busy||flow.unknown||!!flow.receipt;
 $('progress').textContent=({start:'예약 시작',service:'1 / 4 · 수업 선택',time:'2 / 4 · 시간 선택',contact:'3 / 4 · 연락처 입력',review:'4 / 4 · 최종 확인',done:'체험 완료',history:'체험 예약 내역'})[step];
 $('status').textContent=message;
 $('summary').innerHTML=`<div class="summary-item">수업<br><strong>${esc(flow.service?.name||'아직 선택하지 않았어요')}</strong>${flow.service?'<br>'+money(flow.service)+' · '+flow.service.duration+'분':''}<br>${!locked&&flow.service?button('수업 수정','edit-service'):''}</div><div class="summary-item">시간<br><strong>${esc(flow.slot?.label||'아직 선택하지 않았어요')}</strong><br>${!locked&&flow.slot?button('시간 수정','edit-time'):''}</div><div class="summary-item">연락처<br>${flow.contact.name?'입력됨 · 개인정보 숨김':'아직 입력하지 않았어요'}<br>${!locked&&flow.contact.name?button('연락처 수정','edit-contact'):''}</div>`;
 let html='';
 if(step==='start')html+=`<h1>어떤 일을 도와드릴까요?</h1><p>화면을 눌러 처음부터 끝까지 진행할 수 있어요.</p><div class="options">${button('수업 예약하기','begin','primary')}${flow.receipt?button('예약 내역 다시 보기','history'):''}</div><p class="muted">예: “사진을 배우고 싶어요.”<br>이 체험에서는 아래 선택 버튼을 사용해 주세요.</p>`;
 if(step==='service')html+=`<h1>무엇을 배우고 싶으세요?</h1><p>수업과 금액을 보고 선택해 주세요.</p><div class="options">${services.map(s=>button(`${esc(s.name)}<span class="muted">${money(s)} · ${s.duration}분</span>`,'service:'+s.id,'option')).join('')}</div><p class="muted">체험에 준비된 수업 3개 전체입니다. 수업을 바꾸면 가능한 시간을 다시 선택합니다.</p>`;
 if(step==='time'){const list=available.filter(x=>!flow.blocked.has(x.id));html+=`<h1>언제 방문하시겠어요?</h1><p>${esc(flow.service.name)} · ${money(flow.service)} · ${flow.service.duration}분</p><p class="muted">${expanded?'준비된 시간 전체입니다.':'가장 빠른 시간 2개를 먼저 보여드려요.'}</p><div class="options">${(expanded?list:list.slice(0,2)).map(s=>button(esc(s.label),'slot:'+s.id,'option')).join('')}</div>${button(expanded?'빠른 시간만 보기':'다른 시간 보기','expand')}`;}
 if(step==='contact')html+=`<h1>예약 연락처를 알려주세요</h1><p>이름과 전화번호만 필수예요. 입력한 내용은 소리 내어 읽지 않아요.</p><form id="contact-form" novalidate><label for="name">이름 · 필수</label><input id="name" name="name" autocomplete="off" maxlength="80" value="${esc(flow.contact.name)}" aria-describedby="name-error"><div class="error" id="name-error"></div><label for="phone">전화번호 · 필수</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="010-1234-5678" maxlength="20" value="${esc(flow.contact.phone)}" aria-describedby="phone-error"><div class="error" id="phone-error"></div><label for="email">이메일 · 선택</label><input id="email" name="email" type="email" inputmode="email" autocomplete="off" placeholder="비워 두어도 돼요" maxlength="160" value="${esc(flow.contact.email)}" aria-describedby="email-error"><div class="error" id="email-error"></div><div class="row"><button class="primary" type="submit">입력 내용 확인하기</button></div></form>`;
 if(step==='review')html+=`<h1>${flow.unknown?'예약 결과를 확인해야 해요':'이 내용으로 예약할까요?'}</h1><p><strong>${esc(flow.service.name)}</strong><br>${esc(flow.slot.label)}<br>${money(flow.service)} · ${flow.service.duration}분</p><p>장소: 체험용 배움센터 · 2층</p><p>체험 조건: 실제 예약·결제는 발생하지 않습니다. 취소 수수료는 없습니다.</p>${button(privateVisible?'연락처 숨기기':'입력한 연락처 확인','privacy')}<p>${privateVisible?esc(flow.contact.name)+' / '+esc(flow.contact.phone)+(flow.contact.email?' / '+esc(flow.contact.email):''):'연락처는 가려져 있어요.'}</p>${flow.unknown?`<p>같은 예약을 다시 보내지 않고, 기존 요청의 기록을 확인합니다.</p>${button('예약 결과 확인하기','verify','primary')}`:`<label class="check"><input type="checkbox" id="approval">수업·시간·금액과 조건을 확인했어요.</label><div class="row">${button('체험 예약 확정하기','submit','primary')}</div>`}`;
 if(step==='done'||step==='history'){const r=flow.receipt;html+=`<h1>${step==='done'?'체험 예약 기록을 확인했어요':'체험 예약 내역'}</h1><div class="success"><strong>${esc(r.service)}</strong><br>${esc(r.slot)}<br>${money(r)}<br>${esc(r.place)}<br>체험 예약번호: ${esc(r.id)}</div><p>실제 예약이 아닙니다. 이 기록은 현재 페이지를 열어 둔 동안 다시 볼 수 있어요.</p><div class="row">${button('시작 화면으로','home')}${button('체험 내역 저장','download')}${button('새 체험 시작','reset')}</div>`;}
 $('panel').innerHTML=html;$('panel').setAttribute('aria-busy',String(flow.busy));if(flow.busy){$('panel').querySelectorAll('button,input').forEach(x=>x.disabled=true);document.querySelectorAll('[data-scenario]').forEach(x=>x.disabled=true);}else document.querySelectorAll('[data-scenario]').forEach(x=>x.disabled=false);
 if($('approval'))$('approval').addEventListener('change',()=>{document.querySelector('[data-action="submit"]').disabled=!$('approval').checked;});if(document.querySelector('[data-action="submit"]'))document.querySelector('[data-action="submit"]').disabled=true;
 if($('contact-form'))$('contact-form').addEventListener('submit',e=>{e.preventDefault();const c={name:$('name').value.trim(),phone:$('phone').value.trim(),email:$('email').value.trim()};const errors=flow.errors(c);for(const field of ['name','phone','email']){$(field+'-error').textContent=errors[field]||'';$(field).setAttribute('aria-invalid',String(!!errors[field]));}if(Object.keys(errors).length){$(Object.keys(errors)[0]).focus();return;}if(!flow.change('contact',c))return;step='review';message='';render();});
 if(focus&&step!==lastFocusedStep){const heading=$('panel').querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus();}lastFocusedStep=step;}
}
function stash(){if(flow.busy||flow.unknown||flow.receipt)return;if(step==='contact'&&$('name'))flow.contact={name:$('name').value,phone:$('phone').value,email:$('email').value};}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.id==='size'){const on=document.body.classList.toggle('large');b.setAttribute('aria-pressed',String(on));b.textContent=on?'기본 글씨 크기':'글씨 더 크게';return;}
 if(b.dataset.scenario){scenario=b.dataset.scenario;$('scenario-label').textContent='현재: '+b.textContent;return;}
 const a=b.dataset.action;if(!a||flow.busy)return;
 if(a==='submit'||a==='verify'){
  if(a==='submit'&&!$('approval')?.checked)return;
  const approved=flow.revision;const promise=a==='submit'?flow.submit(approved,scenario):flow.verify();message=a==='verify'?'기존 체험 예약 기록을 확인하고 있어요.':'선택한 내용으로 체험 예약을 처리하고 있어요.';render();
  try{const result=await promise;if(result.kind==='full'){step='time';scenario='success';$('scenario-label').textContent='현재: 정상 완료';message='입력하시는 동안 선택한 시간이 마감됐어요. 연락처는 그대로 두었어요. 다른 시간을 선택해 주세요.';}else if(result.kind==='unknown'){message='응답을 받지 못해 완료 여부를 아직 알 수 없어요. 예약 결과 확인 버튼을 눌러 주세요.';}else if(result.kind==='verified'){step='done';message='';}else message='조건을 다시 확인해 주세요.';}catch{message='처리가 중단됐어요. 완료 여부는 확인되지 않았습니다.';flow.unknown=true;}render();return;
 }
 stash();message='';
 if(a==='begin'){if(flow.receipt){step='history';}else step=flow.service?'time':'service';}
 if(a==='edit-service')step='service';if(a==='edit-time')step='time';if(a==='edit-contact')step='contact';
 if(a.startsWith('service:')){if(!flow.change('service',services.find(s=>s.id===a.slice(8))))return;step='time';}
 if(a.startsWith('slot:')){if(!flow.change('slot',available.find(s=>s.id===a.slice(5))))return;step=Object.keys(flow.errors()).length?'contact':'review';}
 if(a==='expand')expanded=!expanded;
 if(a==='privacy'){privateVisible=!privateVisible;}
 if(a==='home')step='start';if(a==='history')step='history';
 if(a==='reset'){flow=new Flow();step='start';privateVisible=false;expanded=false;}
 if(a==='download'){const r=flow.receipt;const url=URL.createObjectURL(new Blob([`EasyLayer 체험 예약 — 실제 예약 아님\n${r.id}\n${r.service}\n${r.slot}\n${money(r)}\n${r.place}\n`],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='EasyLayer-demo-receipt.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 render();
});render(false);
