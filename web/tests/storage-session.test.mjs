import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, transition} from '../dist/engine.mjs';
import {createStorageSession, storageKey} from '../dist/storage.mjs';
const run = (state, ...actions) => actions.reduce(transition, state);
function memory() {
  const data = new Map();
  return {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
}
test('opening a session does not rewrite stored progress', () => {
  const target = memory(); let writes = 0;
  const original = target.setItem; target.setItem = (...args) => { writes++; original(...args); };
  createStorageSession(() => target).snapshot();
  assert.equal(writes, 0);
});
for (const action of ['pause', 'submit', 'later', 'reset']) {
  test(`stale tab ${action} cannot erase another tab's submitted record`, () => {
    const target = memory();
    const draft = run(initial('lost'), 'draft', 'approve');
    target.setItem(storageKey, JSON.stringify(draft));
    const a = createStorageSession(() => target), b = createStorageSession(() => target);
    const submitted = a.commit(transition(a.snapshot().state, 'submit'));
    const saved = target.getItem(storageKey);
    assert.equal(submitted.state.records.length, 1);
    const result = b.commit(transition(b.snapshot().state, action));
    assert.equal(result.applied, false); assert.equal(result.conflict, true);
    assert.equal(target.getItem(storageKey), saved);
    const refreshed = b.reloadSaved();
    assert.equal(refreshed.state.status, 'unknown'); assert.equal(refreshed.state.records.length, 1);
    const verified = b.commit(transition(refreshed.state, 'verify'));
    assert.equal(verified.state.status, 'verified'); assert.equal(verified.state.records.length, 1);
  });
}
test('storage-event check blocks stale state and requires explicit reload', () => {
  const target = memory(), a = createStorageSession(() => target), b = createStorageSession(() => target);
  a.commit(run(initial(), 'later', 'draft'));
  assert.equal(b.checkForUpdates().conflict, true);
  assert.equal(b.snapshot().state.slot, 0);
  assert.equal(b.reloadSaved().state.slot, 1);
  assert.equal(b.snapshot().conflict, false);
});
test('external storage deletion is detected before a stale tab recreates the record', () => {
  const target = memory();
  target.setItem(storageKey, JSON.stringify(run(initial(), 'draft', 'approve', 'submit')));
  const session = createStorageSession(() => target);
  target.removeItem(storageKey);
  assert.equal(session.commit(session.snapshot().state).conflict, true);
  assert.equal(target.getItem(storageKey), null);
  assert.equal(session.reloadSaved().state.status, 'choose');
});
test('initially blocked storage must not overwrite a draft found after recovery', () => {
  const target = memory(); let blocked = true;
  const getStorage = () => { if (blocked) throw new Error('blocked'); return target; };
  const session = createStorageSession(getStorage);
  const local = session.commit(run(initial(), 'later', 'draft'));
  assert.equal(local.applied, true); assert.equal(local.persistence.mode, 'memory');
  const remote = run(initial('lost'), 'draft', 'approve', 'submit');
  target.setItem(storageKey, JSON.stringify(remote)); blocked = false;
  assert.equal(session.commit(local.state).conflict, true);
  assert.equal(JSON.parse(target.getItem(storageKey)).records.length, 1);
});
test('a failed freshness read never attempts a write even if writes are allowed', () => {
  const target = memory(); let blocked = false, writes = 0;
  const storage = {getItem: key => { if (blocked) throw new Error('blocked'); return target.getItem(key); }, setItem: (key,value) => { writes++; target.setItem(key,value); }};
  const session = createStorageSession(() => storage); blocked = true;
  assert.equal(session.commit(run(initial(), 'draft')).persistence.mode, 'memory');
  assert.equal(writes, 0);
});
test('failed explicit reload keeps in-tab progress and a pending conflict', () => {
  const target = memory(); let blocked = false;
  const getStorage = () => { if (blocked) throw new Error('blocked'); return target; };
  const session = createStorageSession(getStorage);
  session.commit(run(initial(), 'later', 'draft'));
  target.setItem(storageKey, JSON.stringify(initial('lost')));
  session.checkForUpdates(); blocked = true;
  const result = session.reloadSaved();
  assert.equal(result.applied, false); assert.equal(result.conflict, true); assert.equal(result.state.slot, 1);
});
test('storage recovering with no saved progress can save the in-tab draft', () => {
  const target = memory(); let blocked = true;
  const session = createStorageSession(() => { if (blocked) throw new Error('blocked'); return target; });
  const inTab = session.commit(run(initial(), 'later', 'draft'));
  blocked = false;
  assert.equal(session.commit(inTab.state).persistence.mode, 'saved');
  assert.equal(JSON.parse(target.getItem(storageKey)).slot, 1);
});
