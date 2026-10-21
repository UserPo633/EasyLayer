import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, transition, bookingFields, restoreState, recordMatchesApproval} from '../dist/engine.mjs';
const run = (s, ...actions) => actions.reduce(transition, s);
for (const field of [...bookingFields, 'id']) {
  test(`both confirmation routes reject a changed or missing ${field}`, () => {
    for (const mode of ['changed', 'missing']) for (const route of ['normal', 'lost']) {
      let s = run(initial(route), 'later', 'draft', 'approve', 'submit');
      if (route === 'normal') s.status = 'draft'; // exercise the normal submit path with an existing receipt
      if (mode === 'missing') delete s.records[0][field];
      else s.records[0][field] = typeof s.records[0][field] === 'number' ? -1 : 'unrelated';
      const records = structuredClone(s.records), attempts = s.attempts;
      s = transition(s, route === 'normal' ? 'submit' : 'verify');
      assert.equal(s.status, 'unknown', `${route}/${mode}/${field}`);
      assert.deepEqual(s.records, records);
      assert.equal(s.attempts, attempts);
    }
  });
}
test('normal submission cannot verify an unrelated pre-existing record', () => {
  let s = run(initial(), 'draft', 'approve');
  s.records = [{id: 'UNRELATED', time: 'different', contact: 'Someone else', service: 'A different service'}];
  s = transition(s, 'submit');
  assert.equal(s.status, 'unknown'); assert.equal(s.attempts, 0); assert.equal(s.records.length, 1);
});
test('normal confirmation requires an approved snapshot and matches all details', () => {
  let s = run(initial(), 'draft', 'approve'); s.approvedSnapshot = null;
  s = transition(s, 'submit'); assert.equal(s.records.length, 0); assert.equal(s.approved, false);
  s = run(initial(), 'draft', 'approve', 'submit');
  assert.equal(s.status, 'verified'); assert.ok(recordMatchesApproval(s));
});
test('approval of old details cannot authorize a changed draft', () => {
  let s = run(initial(), 'draft', 'approve'); s.slot = 1;
  s = transition(s, 'submit'); assert.equal(s.records.length, 0); assert.equal(s.approved, false);
});
test('multiple receipts are ambiguous even when one matches', () => {
  let s = run(initial('lost'), 'draft', 'approve', 'submit'); s.records.push({...s.records[0], id: 'OTHER'});
  s = transition(s, 'verify'); assert.equal(s.status, 'unknown'); assert.equal(s.records.length, 2);
});
test('restoring a changed verified record downgrades it and blocks another write', () => {
  const s = run(initial(), 'draft', 'approve', 'submit'); s.records[0].service = 'Other service';
  const restored = restoreState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.status, 'unknown'); assert.equal(transition(restored, 'submit').records.length, 1);
});
test('older verified records remain unverified without invented approval details', () => {
  const old = {version: 1, scenario: 'normal', status: 'verified', slot: 0, approved: true, attempts: 1,
    records: [{id: 'DEMO-1042', service: 'Pottery for beginners', time: '10:00 AM', contact: 'Alex Demo'}], events: []};
  const restored = restoreState(old);
  assert.deepEqual(restored.records, old.records); assert.equal(restored.status, 'unknown');
  assert.equal(transition(restored, 'verify').status, 'unknown'); assert.equal(transition(restored, 'submit').attempts, 1);
});
test('older unfinished drafts keep the time but require fresh approval', () => {
  const old = {...run(initial(), 'later', 'draft', 'approve'), version: 1};
  const restored = restoreState(old);
  assert.equal(restored.slot, 1); assert.equal(restored.approved, false);
  assert.equal(transition(restored, 'submit').records.length, 0);
});
test('a restored record without explicit approval cannot stay verified', () => {
  const s = run(initial(), 'draft', 'approve', 'submit'); s.approved = false;
  assert.equal(restoreState(s).status, 'unknown');
  s.status = 'unknown'; assert.equal(transition(s, 'verify').status, 'unknown');
});
