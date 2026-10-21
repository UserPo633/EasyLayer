import {initial, restoreState} from './engine.mjs';
export const storageKey = 'easylayer-demo-v1'; // Retain the old key to check existing drafts safely.
const storage = () => globalThis.localStorage;
export function loadState(getStorage = storage) {
  let raw;
  try { raw = getStorage().getItem(storageKey); }
  catch { return {state: initial(), notice: 'Saved progress could not be read. This is a new sample session in this tab.'}; }
  if (raw === null) return {state: initial(), notice: ''};
  try {
    const value = JSON.parse(raw);
    return {state: restoreState(value), notice: value.version === 1 ? 'Older demo restored. Review unfinished drafts again; incomplete records remain unverified.' : ''};
  } catch {
    const state = initial(); state.status = 'unknown';
    state.events.push('Saved progress could not be restored safely. Reset demo to start a new sample session.');
    return {state, notice: 'Saved data could not be restored safely. No booking will be submitted. Use Reset demo to start again.'};
  }
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
