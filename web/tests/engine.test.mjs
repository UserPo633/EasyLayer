import test from'node:test';import assert from'node:assert/strict';import{initial,transition,restoreState,slots}from'../dist/engine.mjs';
const run=(s,...actions)=>actions.reduce(transition,s);
test('explicit approval is required before any write',()=>{const s=run(initial(),'draft','submit');assert.equal(s.records.length,0);assert.equal(s.status,'draft');});
test('pause survives serialization and resumes the same draft',()=>{let s=run(initial(),'later','draft','pause');s=JSON.parse(JSON.stringify(s));s=transition(s,'resume');assert.equal(s.status,'draft');assert.equal(s.slot,1);assert.equal(s.records.length,0);});
test('lost response never reports success until existing record is verified',()=>{let s=run(initial('lost'),'draft','approve','submit');assert.equal(s.status,'unknown');assert.equal(s.records.length,1);s=transition(s,'submit');assert.equal(s.records.length,1);assert.equal(s.status,'unknown');s=transition(s,'verify');assert.equal(s.status,'verified');assert.equal(s.records.length,1);});
test('verification does not invent missing or mismatched records',()=>{let s=run(initial('lost'),'draft','approve','submit');s.records[0].time='different';assert.equal(transition(s,'verify').status,'unknown');s.records=[];assert.equal(transition(s,'verify').status,'unknown');});
test('changed availability blocks writing and requires new approval',()=>{let s=run(initial('changed'),'draft','approve','submit');assert.equal(s.status,'conflict');assert.equal(s.records.length,0);s=run(s,'draft','submit');assert.equal(s.records.length,0);assert.equal(s.approved,false);s=run(s,'approve','submit');assert.equal(s.status,'verified');assert.equal(s.records.length,1);});
test('changing approved details revokes approval',()=>{const s=run(initial(),'draft','approve','later','submit');assert.equal(s.approved,false);assert.equal(s.records.length,0);});
test('verified or unknown submissions cannot be discarded and rewritten',()=>{for(const scenario of ['normal','lost']){let s=run(initial(scenario),'draft','approve','submit','discard','submit','submit');assert.equal(s.records.length,1);assert.equal(s.attempts,1);}});
test('original state is not mutated',()=>{const s=initial();run(s,'draft','approve','submit');assert.equal(s.records.length,0);assert.equal(s.status,'choose');});
test('an unavailable slot stays excluded when navigating back around the choices',()=>{
  let s=run(initial('changed'),'draft','approve','submit');
  const unavailableSlot=s.slot;
  s=transition(s,'draft');
  for(const action of ['earlier','later','later','earlier','earlier','later']) {
    s=transition(s,action); assert.notEqual(s.slot,unavailableSlot);
  }
  s=run(s,'approve','submit');assert.equal(s.status,'verified');
  assert.notEqual(s.records[0].time,slots[unavailableSlot]);
});
test('submission defensively rejects a known unavailable time even if selected outside the UI',()=>{
  let s=run(initial('changed'),'draft','approve','submit','draft');
  s.slot=s.unavailableSlots[0];s=run(s,'approve','submit');
  assert.equal(s.status,'conflict');assert.equal(s.records.length,0);assert.equal(s.approved,false);
});
test('availability history survives pause, restoration and discarding a draft',()=>{
  let s=run(initial('changed'),'later','draft','approve','submit');
  const unavailableSlot=s.slot;
  s=run(s,'draft','pause');s=restoreState(JSON.parse(JSON.stringify(s)));
  s=run(s,'resume','discard');assert.deepEqual(s.unavailableSlots,[unavailableSlot]);
  for(let i=0;i<slots.length*2;i++) {s=transition(s,'later');assert.notEqual(s.slot,unavailableSlot);}
  s=run(s,'draft','approve','submit');assert.equal(s.status,'verified');
  assert.notEqual(s.records[0].time,slots[unavailableSlot]);
});
test('a legacy conflict screen retains its known unavailable slot',()=>{
  const old=run(initial('changed'),'later','draft','approve','submit');
  old.version=2;delete old.unavailableSlots;delete old.availabilityUncertain;
  let s=restoreState(old);assert.deepEqual(s.unavailableSlots,[1]);
  s=run(s,'draft','earlier');assert.notEqual(s.slot,1);
});
test('ambiguous legacy availability cannot be invented to authorize another booking',()=>{
  const old=run(initial('changed'),'draft','approve','submit','draft');
  old.version=2;delete old.unavailableSlots;delete old.availabilityUncertain;
  const s=restoreState(old);assert.equal(s.availabilityUncertain,true);assert.equal(s.status,'conflict');
  const blocked=run(s,'later','draft','approve','submit');assert.equal(blocked.records.length,0);
  assert.equal(blocked.approved,false);assert.equal(transition(s,'reset').availabilityUncertain,false);
});
test('new-format invalid availability history is rejected during restoration',()=>{
  for(const unavailableSlots of [null,[-1],[slots.length],['0']]) {
    assert.throws(()=>restoreState({...initial(),unavailableSlots}),/Invalid saved demo/);
  }
});
