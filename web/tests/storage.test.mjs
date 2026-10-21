import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, transition, describe} from '../dist/engine.mjs';
import {loadState, persistState, storageKey} from '../dist/storage.mjs';
const run = (s, ...actions) => actions.reduce(transition, s);
function memory() { const data = new Map(); return {getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v)}; }
test('a persisted paused draft restores the same time and no booking', () => {
  const target = memory(), s = run(initial(), 'later', 'draft', 'pause');
  assert.equal(persistState(s, () => target).mode, 'saved');
  const restored = loadState(() => target).state;
  assert.equal(restored.slot, 1); assert.equal(restored.status, 'paused'); assert.equal(restored.records.length, 0);
});
test('blocked storage is reported and the in-tab draft still works', () => {
  const blocked = () => { throw new Error('SecurityError'); };
  let s = run(loadState(blocked).state, 'later', 'draft', 'pause');
  const result = persistState(s, blocked);
  assert.equal(result.mode, 'memory'); assert.match(result.message, /refreshing or closing/);
  assert.doesNotMatch(describe(s), /saved/i);
  s = transition(s, 'resume'); assert.equal(s.slot, 1); assert.equal(s.status, 'draft');
});
test('quota failure reports possible restoration of an older draft', () => {
  const old = JSON.stringify(run(initial(), 'draft'));
  const target = {getItem: () => old, setItem: () => { throw new Error('QuotaExceededError'); }};
  const result = persistState(run(initial(), 'later', 'draft'), () => target);
  assert.equal(result.mode, 'memory'); assert.match(result.message, /older draft/);
  assert.equal(target.getItem(storageKey), old);
});
test('a silently ignored write is not advertised as saved', () => {
  const result = persistState(initial(), () => ({setItem() {}, getItem: () => null}));
  assert.equal(result.mode, 'memory');
});
test('read-back failure is not advertised as saved', () => {
  const result = persistState(initial(), () => ({setItem() {}, getItem() { throw new Error('blocked'); }}));
  assert.equal(result.mode, 'memory');
});
test('malformed saved data cannot immediately authorize a new write', () => {
  for (const raw of ['{broken', '{}', 'null']) {
    const restored = loadState(() => ({getItem: () => raw}));
    assert.equal(restored.state.status, 'unknown'); assert.match(restored.notice, /Reset demo/);
    assert.equal(transition(restored.state, 'submit').records.length, 0);
  }
});
test('storage recovery removes the memory-only result after a confirmed write', () => {
  const s = run(initial(), 'draft'), target = memory();
  assert.equal(persistState(s, () => {throw new Error('blocked');}).mode, 'memory');
  assert.equal(persistState(s, () => target).mode, 'saved');
  assert.equal(loadState(() => target).state.status, 'draft');
});
