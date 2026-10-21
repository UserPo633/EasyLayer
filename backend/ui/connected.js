'use strict';
const $=id=>document.getElementById(id);
let storage;try{storage=window.sessionStorage;}catch{storage={getItem(){throw Error('storage');}};}
const booking=new EasyBooking.BookingSession(new EasySource.Source(),storage);
const simulated=booking.source.simulation===true;
let lang='en',speech=null,voiceEnabled=false,requestBusy=false,spoken='',customQuestion='',approvalRevision=null,requestRevision=null;
const words={
 unknown_title:['Let’s check before trying again.','다시 예약하기 전에 확인할게요.'],
 start:['Choose something you’d love to learn.','배우고 싶은 것을 골라볼까요?'],service:['What would you like to learn?','무엇을 배우고 싶으세요?'],provider:['Who would you like to learn with?','어떤 선생님과 함께할까요?'],date:['When works for you?','언제가 편하세요?'],time:['Here are your options.','가능한 시간을 골라주세요.'],contact:['A few details, then you’re ready.','연락처를 입력하면 준비가 끝나요.'],review:['Does everything look right?','예약 내용을 확인해 주세요.'],unknown:['Let’s check before trying again.','다시 예약하기 전에 확인할게요.'],done:['You’re all booked.','예약이 확인됐어요.'],
 welcome:['Tell me what you need, or choose a class below.','원하는 수업을 말하거나 아래에서 선택해 주세요.'],empty:['No classes are available on the original site.','원본 사이트에 가능한 수업이 없어요.'],
 'choose-time':['Choose a time below, or say “the second one”.','시간을 누르거나 “두 번째로”라고 말해 주세요.'], 'no-times':['No times match. Try another day or a different time of day.','조건에 맞는 시간이 없어요. 날짜나 시간대를 바꿔주세요.'],
 conflict:['That time was just taken. Your details are saved. Choose another time, then review again.','방금 해당 시간이 마감됐어요. 연락처는 유지했어요. 다른 시간을 고른 뒤 다시 확인해 주세요.'],
 changed:['The original details changed. Please choose a time and review the updated information.','원본 정보가 바뀌었어요. 시간을 다시 고르고 변경된 내용을 확인해 주세요.'],
 unknown:['The result is not confirmed. Do not submit again. Check the original booking site.','결과를 확인하지 못했어요. 다시 제출하지 말고 원본 사이트에서 확인해 주세요.'],
 restored:['A previous submission was found in this tab. Check its result before doing anything else.','이 탭에 이전 제출 기록이 있어요. 먼저 결과를 확인해 주세요.'],
 verified:['We checked your booking against the original record.','원본 예약 기록과 일치하는 것을 확인했어요.'],
 storage:['This browser cannot preserve a pending booking. Use the original site to continue.','이 브라우저에 제출 상태를 보관할 수 없어요. 원본 사이트에서 진행해 주세요.'],
 unsupported:['The original site requires an additional consent or verification step. Continue there.','원본 사이트에서 추가 동의나 인증이 필요해요. 원본에서 진행해 주세요.'],
 catalog:['The original class information could not be read reliably. Open the original site.','원본 수업 정보를 확인하지 못했어요. 원본 사이트를 열어주세요.'],
 network:['We could not reach the booking site. Your choices are kept. Try again or open the original site.','예약 사이트에 연결하지 못했어요. 선택은 유지했어요. 다시 시도하거나 원본을 열어주세요.'],
 date_error:['Please choose a valid date, today or later.','오늘 이후의 올바른 날짜를 골라주세요.'],
 plan:['I could not safely apply that request. Please rephrase or use the buttons.','요청을 확실히 적용하지 못했어요. 다시 말하거나 버튼을 사용해 주세요.'],
 choice:['Please select one of the times currently shown.','지금 화면에 표시된 시간 중에서 골라주세요.'],
 'time-unavailable':['That time is not in the available options. Please choose a time shown below.','해당 시간은 현재 예약할 수 없어요. 표시된 시간 중에서 골라주세요.'],
 clarify:['Which class or time did you mean? You can also use the buttons.','어떤 수업이나 시간을 원하세요? 버튼으로 선택해도 돼요.'],
 privacy:['Contact form fields stay out of the AI request. Anything you type or say in the request box goes to the selected service. Enter private details only in the contact form.','연락처 입력란의 값은 AI에 보내지 않아요. 요청창에 입력하거나 말한 내용은 선택한 서비스로 전달되므로, 개인정보는 연락처 입력란에만 적어주세요.'],
 first_name:['First name','이름'],last_name:['Last name','성'],email:['Email','이메일'],phone_number:['Phone number','전화번호'],address:['Address','주소'],city:['City','도시'],zip_code:['ZIP code','우편번호'],notes:['Notes','요청 사항']
};
const tr=(en,ko)=>lang==='ko'?ko:en;
const w=key=>words[key]?.[lang==='ko'?1:0]||key;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,cls='')=>`<button type="button" data-action="${esc(action)}" class="${cls}">${esc(label)}</button>`;
const money=s=>`${s.price} ${s.currency||tr('(currency unspecified)','(통화 미표시)')}`;
const providerName=()=>booking.provider?[booking.provider.first_name,booking.provider.last_name].join(' '):'';
const unavailable=()=>booking.locked||requestBusy;
function summaryText(){return [booking.service?.name,booking.service?money(booking.service):'',providerName(),booking.date,booking.hour,booking.timezone].filter(Boolean).join(', ');}
function speak(text,force=false){if((!voiceEnabled&&!force)||!('speechSynthesis'in window)||!text)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang==='ko'?'ko-KR':'en-US';u.rate=.92;window.speechSynthesis.speak(u);}
function status(text){$('status').textContent=text;$('status').hidden=!text;}
function contactValues(){return Object.fromEntries([...document.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.value]));}
function render(){
 const phase=booking.phase, busy=booking.busy||requestBusy;
 document.documentElement.lang=lang;$('language').textContent=lang==='en'?'한국어':'English';$('language').disabled=busy;
 $('mode').textContent=tr('Simulated Alexa+ experience','Alexa+ 경험 시뮬레이션');
 $('eyebrow').textContent=tr('A LITTLE GUIDANCE. A LOT MORE INDEPENDENCE.','작은 안내로, 스스로 할 수 있는 일이 더 많아지도록.');
 $('headline').textContent=tr('Let’s make it easy.','쉽게, 함께 해볼까요.');$('subtitle').textContent=tr('Say what you need. See your choices. Stay in control.','원하는 일을 말하고, 선택을 확인하고, 직접 결정하세요.');
 $('connection').textContent=simulated?tr('INTERACTION SIMULATION · No real booking. No Bedrock call.','동작 시뮬레이션 · 실제 예약과 Bedrock 호출이 없습니다.'):tr('Connected mode · bookings are written to your self-hosted test site. Use fictional contacts.','연결 모드 · 직접 운영하는 테스트 사이트에 예약이 저장됩니다. 가상 연락처를 사용하세요.');
 $('summary-title').textContent=tr('Your choices','선택한 내용');$('summary-eyebrow').textContent=tr('ALWAYS HERE TO REVIEW','언제든 다시 확인하세요');$('assurance').textContent=tr('You decide. We check the details.','결정은 직접, 확인은 함께.');$('original').textContent=simulated?tr('Simulation only · no original site','시뮬레이션 · 원본 사이트 없음'):tr('Open original booking site ↗','원본 예약 사이트 열기 ↗');if(simulated)$('original').removeAttribute('href');
 $('foot').textContent=w('privacy');$('about-label').textContent=tr('About this prototype','프로토타입 안내');$('technical').textContent=tr('A simulated Alexa+ web experience, not an Alexa runtime integration. Easy!Appointments 1.6.0 supplies the booking data. Browser speech support varies. The basic-command mode uses rules, not AI. Closing this tab removes its pending-state guard; it is not server-wide idempotency.','실제 Alexa 런타임에 연결된 서비스가 아닌 Alexa+ 웹 경험 시뮬레이션입니다. Easy!Appointments 1.6.0에서 예약 정보를 가져옵니다. 브라우저마다 음성 지원이 다르며 기본 명령 모드는 AI가 아닌 규칙으로 작동합니다. 이 탭을 닫으면 제출 상태 보호 기록이 사라지며 서버 전체의 중복 방지 기능은 아닙니다.');
 const steps={start:1,service:1,provider:2,date:2,time:2,contact:3,review:4,unknown:4,done:4};
 $('progress').textContent=tr(`STEP ${steps[phase]} OF 4`,`4단계 중 ${steps[phase]}단계`);$('source-state').textContent=booking.data?(simulated?tr('Simulated source','가상 원본'):tr('Source connected','원본 연결됨')):tr('Source not connected','원본 연결 전');
 $('title').textContent=simulated&&phase==='done'?tr('Your demo is complete.','예약 시뮬레이션을 완료했어요.'):w(phase==='unknown'?'unknown_title':phase);$('assistant-line').textContent=simulated&&phase==='done'?tr('A fictional record was checked in this browser. No real reservation was made.','이 브라우저의 가상 기록을 확인했어요. 실제 예약은 생성하지 않았어요.'):busy?tr('One moment, checking…','잠시만요, 확인하고 있어요…'):customQuestion||(['welcome','choose-time','no-times','clarify','verified'].includes(booking.message)?w(booking.message):phase==='review'?tr('Review the class, time, price and contact details below.','수업·시간·금액·연락처를 확인해 주세요.'):phase==='date'?tr('All times follow the teacher’s timezone.','모든 시간은 선생님의 시간대를 기준으로 해요.'):phase==='contact'?tr('These details are sent only to the booking site.','이 정보는 예약 사이트로만 전달돼요.'):phase==='start'?tr('Connect to see the classes available at your centre.','센터의 예약 가능한 수업을 불러올게요.'):phase==='service'?w('welcome'):'');
 const messages=['conflict','changed','unknown','restored','storage','time-unavailable'];status(messages.includes(booking.message)?w(booking.message):'');
 let html='';
 if(phase==='start')html=button(tr('Find a class','수업 찾아보기'),'connect','primary');
 if(phase==='service')html=`<div class="options">${booking.data.services.map(s=>`<button class="option" data-action="service:${esc(s.id)}"><span><strong>${esc(s.name)}</strong><small>${esc(money(s))} · ${s.duration} ${tr('minutes','분')}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
 if(phase==='provider')html=`<div class="options">${booking.availableProviders().map(p=>button([p.first_name,p.last_name].join(' '),'provider:'+p.id,'option')).join('')}</div>`;
 if(phase==='date')html=`<label for="date">${tr('Date','날짜')}</label><input type="date" id="date" min="${booking.today()}" value="${esc(booking.date||booking.today())}"><label for="period">${tr('Time of day','시간대')}</label><select id="period">${[['any','Any time','전체'],['morning','Morning · before 12','오전 · 12시 이전'],['afternoon','Afternoon · 12–18','오후 · 12~18시'],['evening','Evening · after 18','저녁 · 18시 이후']].map(([v,en,ko])=>`<option value="${v}" ${booking.period===v?'selected':''}>${tr(en,ko)}</option>`).join('')}</select><div class="row">${button(tr('Find available times','가능한 시간 찾기'),'hours','primary')}</div>`;
 if(phase==='time')html=`<p class="small">${esc(booking.date)} · ${esc(booking.timezone)}</p><div class="options">${booking.visibleChoices.map((h,i)=>`<button class="option" data-action="hour:${h}"><span><span class="number">${i+1}</span><strong>${h}</strong></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>${booking.visibleChoices.length<booking.choices.length?button(tr('Show all times','시간 모두 보기'),'expand','quiet'):''}`;
 if(phase==='contact')html=`<form id="contact-form">${booking.data.inputs.map(f=>`<label for="field-${f.key}">${esc(w(f.key))} · ${tr(f.required?'Required':'Optional',f.required?'필수':'선택')}</label><input data-field="${f.key}" id="field-${f.key}" maxlength="${f.maxLength}" value="${esc(booking.contact[f.key]||'')}" ${f.required?'required':''} type="${f.key==='email'?'email':f.key==='phone_number'?'tel':'text'}" autocomplete="off">`).join('')}<div class="row"><button class="primary" type="submit">${tr('Review booking','예약 내용 확인')}</button></div></form>`;
 if(phase==='review')html=`<div class="review-card"><p><strong>${esc(booking.service.name)}</strong></p><p>${esc(providerName())}</p><p>${esc(booking.date)} · ${esc(booking.hour)} · ${esc(booking.timezone)}</p><p>${esc(money(booking.service))} · ${booking.service.duration} ${tr('minutes','분')}</p></div><h3>${tr('Contact details to send','전송할 연락처')}</h3><div class="review-card">${booking.data.inputs.filter(f=>booking.contact[f.key]).map(f=>`<p><span class="small">${esc(w(f.key))}</span><br>${esc(booking.contact[f.key])}</p>`).join('')}</div><p class="small">${tr('Check cancellation terms on the original site before confirming. This adapter does not retrieve them.','확정 전에 원본 사이트의 취소 조건을 확인해 주세요. 이 연결 기능은 취소 조건을 가져오지 않습니다.')}</p><label class="check"><input id="approve" type="checkbox"><span>${tr('I reviewed the details above.','위 내용을 확인했어요.')}</span></label><div class="row">${button(tr('Confirm booking','예약 확정하기'),'submit','primary')}</div><p class="small">${tr('After checking the box, you may also say “confirm booking”.','확인란을 체크한 뒤 “예약 확정”이라고 말해도 돼요.')}</p>`;
 if(phase==='unknown')html=`<p>${w('unknown')}</p>${booking.result?button(tr('Check existing booking','기존 예약 확인'),'verify','primary'):''}`;
 if(phase==='done')html=`<div class="success-mark" aria-hidden="true">✓</div><div class="review-card"><p><strong>${esc(booking.service.name)}</strong></p><p>${esc(booking.date)} · ${esc(booking.hour)}</p><p>${esc(booking.timezone)} · ${esc(money(booking.service))}</p></div><p class="receipt">${simulated?tr('Simulated record ID','가상 기록 번호'):tr('Verified booking ID','확인된 예약 번호')}: <strong>${esc(booking.result.id)}</strong></p>`;
 $('content').innerHTML=html;approvalRevision=null;
 const summaryItem=(label,value,edit)=>`<div class="summary-item"><span class="label">${esc(label)}</span><strong>${esc(value)}</strong>${edit&&!unavailable()?button(tr('Change','수정'),edit,'quiet'):''}</div>`;
 $('selection').innerHTML=booking.service?summaryItem(tr('CLASS','수업'),booking.service.name,'edit-service')+summaryItem(tr('TEACHER','선생님'),providerName()||tr('Not selected yet','아직 선택 전'),null)+summaryItem(tr('WHEN','일시'),[booking.date,booking.hour].filter(Boolean).join(' · ')||tr('Not selected yet','아직 선택 전'),'edit-date')+`<p class="small">${esc(booking.timezone)}</p>`+summaryItem(tr('PRICE','금액'),money(booking.service),null)+(booking.hour&&!['unknown','done'].includes(phase)?summaryItem(tr('CONTACT','연락처'),booking.contactValid()?tr('Details entered','입력됨'):tr('Details needed','입력 필요'),'edit-contact'):''):`<p class="empty">${tr('Your choices will appear here as we go.','선택한 내용이 여기에 차곡차곡 표시돼요.')}</p>`;
 $('conversation').hidden=!booking.data||['unknown','done'].includes(phase);$('talk-title').textContent=tr('Or tell me what to change','말로 바꿔도 좋아요');$('readback').textContent=tr('Read aloud','읽어주기');$('request-label').textContent=tr('Your request','요청');$('request').placeholder=tr('Thursday morning instead','목요일 오전으로 바꿔줘');$('speak').textContent=tr('Speak','말하기');$('stop').textContent=tr('Stop','멈추기');$('send').textContent=tr('Send request ↗','요청 보내기 ↗');$('voice-label').textContent=tr('Speak guidance','안내 읽어주기');$('planner-label').textContent=tr('Understanding','요청 이해');$('planner-mode').options[1].textContent=tr('Basic commands · no AI','기본 명령 · AI 미사용');
 $('command-help').textContent=tr('Basic commands: exact class name, “Tuesday morning”, “tomorrow”, “second”, “read summary”. Voice is transcribed for you to review before sending.','기본 명령: 정확한 수업 이름, “화요일 오전”, “내일”, “두 번째로”, “다시 읽어줘”. 음성은 글로 바뀌며 확인 후 요청을 보내세요.');
 document.querySelectorAll('#content button,#content input,#content select,#selection button,#request-form button,#request,#planner-mode').forEach(n=>n.disabled=busy);
 if(phase==='review'){const submit=document.querySelector('[data-action="submit"]');submit.disabled=true;$('approve').addEventListener('change',()=>{approvalRevision=$('approve').checked?booking.revision:null;submit.disabled=approvalRevision===null||busy;});}
 const form=$('contact-form');if(form){form.addEventListener('input',()=>booking.setContact(contactValues()));form.addEventListener('submit',e=>{e.preventDefault();booking.setContact(contactValues());if(booking.review()){render();$('title').focus();}else status(tr('Please check the required fields.','필수 입력 항목을 확인해 주세요.'));});}
 const line=$('assistant-line').textContent;if(!busy&&line&&line!==spoken){spoken=line;speak(line);}
}
async function act(fn){
 customQuestion='';const prevPhase=booking.phase;
 let promise;try{promise=fn();render();await promise;render();if(prevPhase!==booking.phase)$('title').focus();}
 catch(e){render();status(w(e.message==='date'?'date_error':words[e.message]?e.message:'network'));}
}
async function sendRequest(){
 if(unavailable())return;
 const text=$('request').value.trim();if(!text)return;speech?.abort();
 if(/^(confirm booking|예약 확정)[.!。]?$/i.test(text)){
   if(booking.phase==='review'&&approvalRevision===booking.revision){const approved=approvalRevision;await act(()=>booking.confirm(approved));}
   else status(tr('Review the booking and check the confirmation box first.','예약 내용을 확인하고 확인란을 먼저 체크해 주세요.'));
   return;
 }
 const revision=booking.revision, mode=$('planner-mode').value;
 if(requestRevision!==null&&requestRevision!==revision){status(tr('Your choices changed while you were speaking. Please record or type the request again.','말하는 동안 선택이 바뀌었어요. 요청을 다시 말하거나 입력해 주세요.'));return;}
 requestBusy=true;render();let error='';
 try{
  let plan;
  if(mode==='basic'){plan=EasyCommands.parse(text,booking.context(),booking.data.services);if(!plan)throw Error('basic');$('planner-status').textContent=tr('Basic commands · rules only, no AI call','기본 명령 · 규칙만 사용, AI 호출 없음');}
  else{
   const response=await fetch('intent.php',{method:'POST',headers:{'Content-Type':'application/json','X-EasyLayer':'1'},body:JSON.stringify({text,catalog:booking.data.services.map(s=>({id:s.id,name:s.name})),providers:booking.data.providers.map(p=>({id:String(p.id),name:[p.first_name,p.last_name].join(' '),services:p.services})),context:booking.context()}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('ai');plan=await response.json();if(plan.provider!=='bedrock')throw Error('ai');
   $('planner-status').textContent=tr(`Amazon Bedrock · ${plan.latency_ms} ms`,`Amazon Bedrock · ${plan.latency_ms}ms`);
   if(plan.action==='select_service')plan={...plan,action:'update'};
  }
  requestBusy=false;
  await booking.applyPlan(plan,revision);
  if(plan.action==='clarify')customQuestion=plan.question||w('clarify');
  if(plan.action==='read_summary')speak(summaryText(),true);
  $('request').value='';requestRevision=null;
 }catch(e){error=e.message==='ai'?tr('AI is unavailable. Your choices are unchanged. Use the buttons or switch to Basic commands.','AI에 연결하지 못했어요. 선택은 유지했어요. 버튼이나 기본 명령 모드를 사용해 주세요.'):e.message==='basic'?tr('That is outside Basic commands. Use an example below, the buttons, or Amazon Bedrock.','기본 명령 범위를 벗어났어요. 아래 예시나 버튼, Amazon Bedrock을 사용해 주세요.'):w(e.message==='date'?'date_error':words[e.message]?e.message:'plan');}
 finally{requestBusy=false;render();if(error)status(error);}
}
$('request-form').addEventListener('submit',e=>{e.preventDefault();sendRequest();});$('request').addEventListener('input',()=>requestRevision=null);
$('voice-output').addEventListener('change',()=>{voiceEnabled=$('voice-output').checked;if(voiceEnabled)speak($('assistant-line').textContent||summaryText());else window.speechSynthesis?.cancel();});
$('planner-mode').addEventListener('change',()=>{$('planner-status').textContent='';});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.id==='language'){speech?.abort();window.speechSynthesis?.cancel();lang=lang==='en'?'ko':'en';render();return;}
 if(b.id==='textsize'){document.body.classList.toggle('large');b.setAttribute('aria-pressed',String(document.body.classList.contains('large')));return;}
 const a=b.dataset.action;if(!a)return;
 if(a==='read'){speak(summaryText()||$('assistant-line').textContent,true);return;}
 if(a==='stop'){speech?.stop();window.speechSynthesis?.cancel();return;}
 if(unavailable()&&a!=='verify')return;
 if(a==='speak'){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){status(tr('Speech is unavailable. Type your request or use the buttons.','음성을 사용할 수 없어요. 요청을 입력하거나 버튼을 사용해 주세요.'));return;}
  window.speechSynthesis?.cancel();speech?.abort();const rev=booking.revision;const phase=booking.phase;speech=new SR();speech.lang=lang==='ko'?'ko-KR':'en-US';speech.interimResults=false;
  speech.onresult=e=>{if(booking.revision!==rev||booking.phase!==phase){status(w('plan'));return;}$('request').value=e.results[0][0].transcript;requestRevision=rev;status(tr('Check the text, then send your request.','변환된 글을 확인한 뒤 요청을 보내주세요.'));};
  speech.onerror=()=>status(tr('Microphone unavailable or speech not recognized. You can type or use the buttons.','마이크를 사용할 수 없거나 음성을 인식하지 못했어요. 입력이나 버튼으로 진행할 수 있어요.'));
  speech.onend=()=>{$('stop').hidden=true;};try{speech.start();$('stop').hidden=false;status(tr('Listening…','듣고 있어요…'));}catch{status(w('plan'));}return;
 }
 if(a==='connect'){await act(()=>booking.connect());return;}
 if(a.startsWith('service:')){await act(()=>booking.selectService(a.slice(8)));return;}
 if(a.startsWith('provider:')){await act(()=>booking.selectProvider(a.slice(9)));return;}
 if(a==='hours'){const date=$('date').value,period=$('period').value;await act(()=>booking.chooseDate(date,period));return;}
 if(a.startsWith('hour:')){await act(()=>booking.chooseHour(a.slice(5)));return;}
 if(a==='expand'){booking.visibleChoices=[...booking.choices];booking.revision++;render();return;}
 if(a.startsWith('edit-')){await act(()=>booking.edit(a.slice(5)));return;}
 if(a==='submit'){const approved=approvalRevision;if(approved!==null)await act(()=>booking.confirm(approved));return;}
 if(a==='verify')await act(()=>booking.verify());
});
window.addEventListener('beforeunload',e=>{if(booking.busy){e.preventDefault();e.returnValue='';}});
render();
