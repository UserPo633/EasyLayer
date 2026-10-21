import {initial, restoreState} from './engine.mjs';
export const storageKey = 'easylayer-demo-v1'; // Retain the old key to check existing drafts safely.
const storage = () => globalThis.localStorage;
export function loadState(getStorage = storage) {
  let raw;
  try { raw = getStorage().getItem(storageKey); }
  catch { return {state: initial(), raw: undefined, readable: false, notice: 'Saved progress could not be read. This is a new sample session in this tab.'}; }
  if (raw === null) return {state: initial(), raw, readable: true, notice: ''};
  try {
    const value = JSON.parse(raw);
    return {state: restoreState(value), raw, readable: true, notice: value.version === 1 ? 'Older demo restored. Review unfinished drafts again; incomplete records remain unverified.' : ''};
  } catch {
    const state = initial(); state.status = 'unknown';
    state.events.push('Saved progress could not be restored safely. Reset demo to start a new sample session.');
    return {state, raw, readable: true, notice: 'Saved data could not be restored safely. No booking will be submitted. Use Reset demo to start again.'};
  }
}

const conflictMessage = 'Saved progress changed in another tab. Load the saved progress before continuing; this tab has not overwritten it.';
const memoryMessage = 'Progress is only in this tab. You can continue, but refreshing or closing it may lose your changes or restore an older draft.';
// Best-effort stale-tab detection, not an atomic cross-tab lock or a real booking database.
// Rendering never calls commit. Compare immediately before every state-changing action.
export function createStorageSession(getStorage = storage) {
  let loaded = loadState(getStorage);
  let state = loaded.state, raw = loaded.raw, readable = loaded.readable;
  let notice = loaded.notice, conflict = false, latestReadable = readable;
  let persistence = !readable ? {mode: 'memory', message: memoryMessage}
    : {mode: 'ready', message: raw === null ? 'No saved draft yet. Changes will be saved when browser storage is available.' : 'Saved progress loaded. Changes will be saved when browser storage is available.'};
  const snapshot = (applied = false) => ({state: structuredClone(state), notice, persistence: {...persistence}, conflict, applied});
  function markConflict() {
    conflict = true;
    persistence = {mode: 'conflict', message: conflictMessage};
    return snapshot();
  }
  function checkForUpdates() {
    if (conflict) return snapshot();
    try {
      const latest = getStorage().getItem(storageKey);
      latestReadable = true;
      // If the initial read failed, never silently overwrite a draft discovered later.
      if ((!readable && latest !== null) || (readable && latest !== raw)) return markConflict();
      if (!readable) { readable = true; raw = latest; }
    } catch {
      latestReadable = false;
      persistence = {mode: 'memory', message: memoryMessage};
    }
    return snapshot();
  }
  function commit(next, {clearNotice = false} = {}) {
    checkForUpdates();
    if (conflict) return snapshot();
    const result = latestReadable ? persistState(next, getStorage) : {mode: 'memory', message: memoryMessage};
    state = structuredClone(next);
    persistence = result;
    if (result.mode === 'saved') { raw = JSON.stringify(next); readable = true; }
    if (clearNotice) notice = '';
    return snapshot(true);
  }
  function reloadSaved() {
    loaded = loadState(getStorage);
    if (!loaded.readable) {
      notice = 'Saved progress could not be read. Your current in-tab progress has been kept. Try loading again when storage is available.';
      persistence = {mode: conflict ? 'conflict' : 'memory', message: conflict ? conflictMessage : memoryMessage};
      return snapshot();
    }
    state = loaded.state; raw = loaded.raw; readable = true; latestReadable = true; conflict = false; notice = loaded.notice;
    persistence = {mode: 'ready', message: raw === null ? 'No saved progress remains. Review a new sample appointment before submitting.' : 'Latest saved progress loaded. Review its status before continuing.'};
    return snapshot(true);
  }
  return {snapshot, commit, checkForUpdates, reloadSaved};
}
export function persistState(state, getStorage = storage) {
  try {
    const target = getStorage(); const data = JSON.stringify(state);
    target.setItem(storageKey, data);
    if (target.getItem(storageKey) !== data) throw new Error('Storage read-back mismatch');
    return {mode: 'saved', message: 'Progress saved in this browser. Browser data clearing can remove it.'};
  } catch {
    return {mode: 'memory', message: 'Progress is only in this tab. You can continue, but refreshing or closing it may lose your changes or restore an older draft.'};
  }
}
