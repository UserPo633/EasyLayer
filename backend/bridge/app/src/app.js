import { App } from '@modelcontextprotocol/ext-apps';
const app = new App({name:'EasyLayer booking',version:'0.4.0'});
const el = id => document.getElementById(id);
let draftId = null, reviewUrl = null, busy = false;
function invalidate() {
  el('complete').hidden=true;
  el('review').hidden=true;
  el('status').textContent='Status needs refreshing';
}
function render(result) {
  if (result.isError) throw new Error('The request could not be completed. Ask your assistant to check the source.');
  let data = result.structuredContent;
  if (!data) data = JSON.parse(result.content?.find(c=>c.type==='text')?.text || '{}');
  if (!data.draft_id || !data.summary) {
    draftId=null;reviewUrl=null;invalidate();el('summary').replaceChildren();
    el('status').textContent='No active draft';el('message').textContent=data.next_action || 'Ask your assistant to find a time.';return;
  }
  if (draftId !== data.draft_id) reviewUrl = null;
  draftId = data.draft_id;
  if (data.review_url) reviewUrl = data.review_url;
  const s=data.summary;
  el('title').textContent=s.service;
  el('status').textContent=data.verified===true&&data.state==='verified' ? 'Booking verified' : ({draft:'Review needed',approved:'Approved · not booked yet',pending:'Checking original service',unknown:'Outcome needs checking',conflict:'Time no longer available',changed:'Details changed',expired:'Draft expired',cancelled:'Unsubmitted draft discarded',duplicate:'Existing booking needs checking'}[data.state] || data.state);
  el('summary').replaceChildren();
  for (const [label,value] of [['Teacher',s.provider],['Date',s.date],['Time',`${s.time} · ${s.timezone}`],['Length',`${s.duration_minutes} minutes`],['Price',`${s.currency} ${s.price}`]]) {
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;el('summary').append(dt,dd);
  }
  el('message').textContent=data.next_action;
  el('review').hidden=data.state!=='draft'||!reviewUrl;
  el('complete').hidden=data.state!=='approved';
  el('refresh').disabled=false;
}
async function act(action) {
  if(busy) return;
  busy=true;
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try { await action(); } catch { invalidate();el('message').textContent='The request could not be completed. Refresh the status or ask your assistant. Do not make another draft to retry an uncertain booking.'; }
  finally { busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=!draftId); }
}
app.ontoolresult = result => { try {render(result);} catch {invalidate();el('message').textContent='Unable to read the booking result.';} };
el('refresh').addEventListener('click',()=>act(async()=>render(await app.callServerTool({name:'get_booking_status',arguments:{draft_id:draftId}}))));
el('complete').addEventListener('click',()=>act(async()=>render(await app.callServerTool({name:'complete_booking',arguments:{draft_id:draftId}}))));
el('review').addEventListener('click',()=>act(async()=>{if(reviewUrl) await app.openLink({url:reviewUrl});}));
app.connect().catch(()=>{el('message').textContent='This booking view requires a compatible MCP Apps host. Opening the HTML alone does not connect it to Alexa.';});
