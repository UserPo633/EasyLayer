const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BookingSession}=require('../ui/booking-session.js');
const Commands=require('../ui/basic-commands.js');
const fixture=()=>({services:[{id:'1',name:'Photography',price:10,currency:'USD',duration:30},{id:'2',name:'Editing',price:15,currency:'USD',duration:30}],providers:[{id:7,first_name:'Demo',last_name:'Teacher',timezone:'UTC',services:['1','2']}],inputs:[{key:'first_name',required:true,maxLength:100},{key:'email',required:true,maxLength:120}],unsupported:false,timezone:'UTC'});
function setup(){
 const map=new Map(); const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 let hours=['09:00','10:00','11:00','14:00']; let calls=0, success=true, fail=false;
 const source={load:async()=>fixture(),hours:async()=>[...hours],register:async(s,p,d,h,c)=>{calls++;if(fail)throw Error('lost response');return {id:'51',hash:'test-hash',start:d+' '+h+':00'};},verify:async()=>success};
 const session=new BookingSession(source,storage,()=>new Date('2026-09-21T00:00:00Z'));
 return {session,source,storage,map,get calls(){return calls},setHours:v=>hours=v,setVerify:v=>success=v,setFail:v=>fail=v};
}
async function ready(f){const s=f.session;await s.connect();s.selectService('1');await s.chooseDate('2026-09-22','morning');s.chooseHour('10:00');s.setContact({first_name:'Synthetic',email:'test@example.invalid'});s.review();return s;}
test('conversation preserves contact, rechecks availability and resolves visible ordinal',async()=>{
 const f=setup(),s=await ready(f);const old=s.revision;
 await s.applyPlan({action:'update',date:'2026-09-24'},s.revision);
 assert.equal(s.phase,'time');assert.equal(s.contact.first_name,'Synthetic');assert.equal(await s.confirm(old),false);assert.equal(f.calls,0);
 await s.applyPlan({action:'update',choice_index:2},s.revision);assert.equal(s.hour,'10:00');assert.equal(s.phase,'review');
});
test('source slot competition returns alternatives and requires a fresh approval',async()=>{
 const f=setup(),s=await ready(f),approved=s.revision;f.setHours(['11:00','14:00']);
 assert.equal(await s.confirm(approved),false);assert.equal(f.calls,0);assert.equal(s.message,'conflict');assert.deepEqual(s.visibleChoices,['11:00']);assert.equal(s.contact.email,'test@example.invalid');
 s.chooseHour('11:00');assert.equal(await s.confirm(approved),false);assert.equal(await s.confirm(s.revision),true);assert.equal(f.calls,1);
});
test('a double confirmation produces one POST only',async()=>{
 const f=setup(),s=await ready(f),rev=s.revision;await Promise.all([s.confirm(rev),s.confirm(rev)]);assert.equal(f.calls,1);assert.equal(s.phase,'done');
});
test('lost response remains locked after reload and stores no contact',async()=>{
 const f=setup(),s=await ready(f);f.setFail(true);await s.confirm(s.revision);assert.equal(s.phase,'unknown');
 const serialized=[...f.map.values()].join();assert.ok(!serialized.includes('test@example.invalid'));assert.ok(!serialized.includes('Synthetic'));
 const reloaded=new BookingSession(f.source,f.storage);assert.equal(reloaded.phase,'unknown');await reloaded.confirm(reloaded.revision);assert.equal(f.calls,1);
});
test('known result can be verified after reload without re-posting',async()=>{
 const f=setup(),s=await ready(f);f.setVerify(false);await s.confirm(s.revision);assert.equal(s.phase,'unknown');
 f.setVerify(true);const reloaded=new BookingSession(f.source,f.storage);assert.equal(await reloaded.verify(),true);assert.equal(f.calls,1);
});
test('storage failure blocks reservation before POST',async()=>{
 const f=setup(),s=await ready(f);s.storage={setItem(){throw Error('storage');}};await assert.rejects(s.confirm(s.revision),/storage/);assert.equal(f.calls,0);
});
test('catalog price and provider timezone changes invalidate confirmation',async()=>{
 for(const mutate of [d=>d.services[0].price=11,d=>d.providers[0].timezone='Asia/Seoul',d=>d.providers=[]]){
  const f=setup(),s=await ready(f);f.source.load=async()=>{const d=fixture();mutate(d);return d;};await s.confirm(s.revision);assert.equal(f.calls,0);assert.equal(s.message,'changed');assert.notEqual(s.phase,'review');
 }
});
test('model submission, unknown fields, stale plans and hidden ordinals cannot execute',async()=>{
 const f=setup(),s=await ready(f);
 await assert.rejects(s.applyPlan({action:'submit'},s.revision),/plan/);
 await assert.rejects(s.applyPlan({action:'update',service_id:'1',execute:true},s.revision),/plan/);
 assert.equal(await s.applyPlan({action:'update',date:'2026-09-25'},s.revision-1),false);
 await s.chooseDate('2026-09-22');await assert.rejects(s.applyPlan({action:'update',choice_index:3},s.revision),/choice/);assert.equal(f.calls,0);
});
test('invalid dates, IDs and invalid contact cannot reach confirmation',async()=>{
 const f=setup(),s=await ready(f);await assert.rejects(s.applyPlan({action:'update',service_id:'bad'},s.revision),/plan/);
 await assert.rejects(s.chooseDate('2026-02-30'),/date/);s.setContact({first_name:' ',email:'invalid'});assert.equal(s.review(),false);assert.equal(await s.confirm(s.revision),false);assert.equal(f.calls,0);
});
test('basic commands respect next week, ordinals and refuse compound or negated requests',()=>{
 const c={today:'2026-09-21',phase:'time',visible_choices:['09:00','10:00']};
 assert.deepEqual(Commands.parse('Tuesday morning',c,[]),{action:'update',date:'2026-09-22',period:'morning'});
 assert.deepEqual(Commands.parse('목요일 오전으로 바꿔줘',c,[]),{action:'update',date:'2026-09-24',period:'morning'});
 assert.equal(Commands.parse('next week Tuesday',c,[]).date,'2026-09-29');
 assert.equal(Commands.parse('두 번째로',c,[]).choice_index,2);
 assert.equal(Commands.parse('not Tuesday',c,[]),null);assert.equal(Commands.parse('Tuesday or Thursday',c,[]),null);assert.equal(Commands.parse('cancel Tuesday',c,[]),null);assert.equal(Commands.parse('photography Tuesday',c,[]),null);
});
test('contact fields never enter planner context',async()=>{const f=setup(),s=await ready(f);assert.ok(!JSON.stringify(s.context()).includes('Synthetic'));assert.ok(!JSON.stringify(s.context()).includes('test@example.invalid'));});
