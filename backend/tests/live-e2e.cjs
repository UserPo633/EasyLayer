/* Run ONLY against this package's seeded local Docker instance.
 * Makes synthetic source reservations. Never calls AWS. No mocked source success.
 * Not executed by the authoring environment when Docker/browser access is absent.
 */
'use strict';
const {chromium,request}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {execFileSync}=require('node:child_process');
const {variables}=require('../ui/source.js');
const {todayIn}=require('../ui/booking-session.js');
const base='http://localhost:8080';
const report={kind:'live Easy!Appointments browser E2E; no AI call',executed_at:new Date().toISOString(),passed:false,checks:[]};
let browser, api;
async function record(name,fn){await fn();report.checks.push({name,passed:true});}
async function sourceInfo(client){const r=await client.get(base+'/index.php/booking');assert.equal(r.status(),200);return variables(await r.text());}
async function findSlot(client,v){
 const service=v.available_services.find(s=>s.name==='Photography Introduction');assert.ok(service);
 const provider=v.available_providers.find(p=>p.services.map(String).includes(String(service.id)));assert.ok(provider);
 const now=new Date(todayIn(provider.timezone)+'T00:00:00Z');
 for(let i=2;i<16;i++){
  const d=new Date(now);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);
  const r=await client.post(base+'/index.php/booking/get_available_hours',{form:{csrf_token:v.csrf_token,service_id:String(service.id),provider_id:String(provider.id),selected_date:date,manage_mode:'false'}});
  assert.equal(r.status(),200);const hours=await r.json();if(Array.isArray(hours)&&hours.length>=3)return {service,provider,date,hours};
 }
 throw Error('No date with three available slots in next 15 days');
}
async function compete(slot,hour){
 const other=await request.newContext();
 try{
  const v=await sourceInfo(other), start=slot.date+' '+hour+':00';
  const end=new Date(slot.date+'T'+hour+':00Z');end.setUTCMinutes(end.getUTCMinutes()+Number(slot.service.duration));
  const r=await other.post(base+'/index.php/booking/register',{form:{csrf_token:v.csrf_token,'post_data[manage_mode]':'false','post_data[appointment][id_services]':String(slot.service.id),'post_data[appointment][id_users_provider]':String(slot.provider.id),'post_data[appointment][start_datetime]':start,'post_data[appointment][end_datetime]':end.toISOString().slice(0,19).replace('T',' '),'post_data[customer][first_name]':'Synthetic','post_data[customer][last_name]':'Competitor','post_data[customer][email]':'competitor-'+Date.now()+'@example.invalid','post_data[customer][phone_number]':'0000000000'}});
  assert.equal(r.status(),200);const result=await r.json();assert.ok(result.appointment_id);assert.ok(result.appointment_hash);
  const check=await other.get(base+'/index.php/booking/reschedule/'+encodeURIComponent(result.appointment_hash));
  const saved=variables(await check.text()).appointment_data;assert.equal(String(saved.id),String(result.appointment_id));assert.equal(saved.start_datetime,start);
 }finally{await other.dispose();}
}
async function fillContact(page,suffix){
 for(const [key,val] of Object.entries({first_name:'Synthetic',last_name:'Participant',email:`ui-${suffix}-${Date.now()}@example.invalid`,phone_number:'0000000000',address:'Test address',city:'Test city',zip_code:'00000',notes:'Synthetic E2E'})){
  const field=page.locator('#field-'+key);if(await field.count())await field.fill(val);
 }
 await page.getByRole('button',{name:'Review booking',exact:true}).click();
 await page.getByRole('heading',{name:'Does everything look right?',exact:true}).waitFor();
}
async function selectFirst(page){
 await page.getByRole('button',{name:'Find a class',exact:true}).click();
 await page.getByRole('button',{name:/Photography Introduction/}).click();
 const providers=page.locator('[data-action^="provider:"]');if(await providers.count())await providers.first().click();
}
(async()=>{
 await fs.mkdir('evidence',{recursive:true});
 try{
  api=await request.newContext();const v=await sourceInfo(api),slot=await findSlot(api,v);
  browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/easylayer-demo/connected.html');await selectFirst(page);
  await record('connected text request uses shared task state (basic commands, not AI)',async()=>{
   await page.locator('#planner-mode').selectOption('basic');await page.locator('#request').fill(slot.date);await page.locator('#send').click();
   await page.getByRole('heading',{name:'Here are your options.',exact:true}).waitFor();
   await page.locator('#request').fill('second');await page.locator('#send').click();await page.getByRole('heading',{name:'A few details, then you’re ready.',exact:true}).waitFor();
  });
  await fillContact(page,'conflict');
  await record('contact fields appear on final review',async()=>{assert.ok((await page.locator('#content').innerText()).includes('Synthetic'));});
  await compete(slot,slot.hours[1]);
  await record('real second-session booking invalidates old approval and offers alternatives',async()=>{
   await page.locator('#approve').check();await page.getByRole('button',{name:'Confirm booking',exact:true}).click();
   await page.getByRole('heading',{name:'Here are your options.',exact:true}).waitFor();assert.ok((await page.locator('#status').innerText()).includes('just taken'));
   assert.equal(await page.locator('[data-action="hour:'+slot.hours[1]+'"]').count(),0);
   await page.screenshot({path:'evidence/live-conflict.png',fullPage:true});
  });
  await record('alternative booking requires fresh approval and is verified against original record',async()=>{
   await page.locator('[data-action^="hour:"]').first().click();
   await page.getByRole('heading',{name:'Does everything look right?',exact:true}).waitFor();assert.equal(await page.locator('#approve').isChecked(),false);
   assert.ok((await page.locator('#content').innerText()).includes('Synthetic'));
   await page.locator('#approve').check();await page.getByRole('button',{name:'Confirm booking',exact:true}).click();
   await page.getByRole('heading',{name:'You’re all booked.',exact:true}).waitFor({timeout:30000});
   const id=(await page.locator('.receipt strong').innerText()).trim();
   const db=JSON.parse(execFileSync('docker',['compose','exec','-T','app','php','/opt/easylayer/inspect.php'],{encoding:'utf8'}));
   assert.ok(db.bookings.some(b=>String(b.id)===id));
   await page.screenshot({path:'evidence/live-verified.png',fullPage:true});
  });
  await record('reload checks saved result without submitting again',async()=>{
   let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/booking/register'))posts++;});
   await page.reload();await page.getByRole('button',{name:'Check existing booking',exact:true}).click();
   await page.getByRole('heading',{name:'You’re all booked.',exact:true}).waitFor();assert.equal(posts,0);
  });
  await record('mobile start page fits viewport',async()=>{
   const mobile=await browser.newContext({viewport:{width:390,height:844}});const p=await mobile.newPage();await p.goto(base+'/easylayer-demo/connected.html');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await p.screenshot({path:'evidence/live-mobile.png',fullPage:true});await mobile.close();
  });
  assert.deepEqual(errors,[]);report.checks.push({name:'no uncaught browser errors',passed:true});report.passed=true;
 }catch(e){report.error=String(e.message).slice(0,500);process.exitCode=1;}
 finally{
  await browser?.close();await api?.dispose();await fs.writeFile('evidence/live-e2e.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
})();
