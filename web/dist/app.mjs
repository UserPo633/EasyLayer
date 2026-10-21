import {initial, transition, describe, nextStep, verificationReport} from './engine.mjs';
import {renderScene} from './scene.mjs';
import {createStorageSession, storageKey} from './storage.mjs';
import {appointmentSummaryHTML, appointmentSummaryText, verificationReportHTML} from './presentation.mjs';

const $ = selector => document.querySelector(selector);
const storageSession = createStorageSession();
const restored = storageSession.snapshot();
let state = restored.state;
let restoreNotice = restored.notice;
let persistence = restored.persistence;
let storageConflict = restored.conflict;
const button = (label, action, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;

function focusedControl() {
  const focused = document.activeElement;
  if (!$('#controls').contains(focused)) return null;
  return {id: focused.id, action: focused.dataset.action};
}

function restoreFocus(previous) {
  if (!previous) return;
  const candidates = [...$('#controls').querySelectorAll('button, input')];
  const replacement = candidates.find(element => !element.disabled && (
    previous.id ? element.id === previous.id : element.dataset.action === previous.action
  ));
  (replacement || $('#status-title')).focus({preventScroll: true});
}

function render(previousFocus = null) {
  const activeBeforeRender = document.activeElement;
  $('#storage-status').textContent = persistence.message;
  $('#storage-status').className = 'storage-status ' + persistence.mode;
  $('#restore-notice').textContent = restoreNotice;
  $('#restore-notice').hidden = !restoreNotice;
  $('#board').innerHTML = renderScene(state);
  $('#scenario').value = state.scenario;
  $('#status-title').textContent = describe(state);
  $('#status-detail').textContent = nextStep(state);
  $('#appointment-summary').innerHTML = appointmentSummaryHTML(state);

  let controls = '';
  if (['choose', 'conflict'].includes(state.status)) {
    controls = button('Earlier', 'earlier') + button('Later', 'later')
      + button(state.status === 'conflict' ? 'Choose a new time' : 'Create this draft', 'draft', true);
  }
  if (state.status === 'draft') {
    controls = `<label class="approval"><input type="checkbox" id="approval" ${state.approved ? 'checked' : ''}> I approve this exact sample appointment.</label>`
      + button('Change time', 'later') + button('Pause', 'pause') + button('Discard draft', 'discard')
      + button('Submit sample booking', 'submit', true, !state.approved);
  }
  if (state.status === 'paused') controls = button('Discard draft', 'discard') + button('Resume my draft', 'resume', true);
  if (state.status === 'unknown') controls = button('Try repeat submission', 'submit') + button('Check existing record', 'verify', true);
  if (state.status === 'verified') controls = button('Test duplicate prevention', 'submit') + button('Start again', 'reset', true);
  $('#controls').innerHTML = controls;
  $('#reload-saved').hidden = !storageConflict;
  for (const control of $('#controls').querySelectorAll('button, input')) {
    if (storageConflict) control.disabled = true;
  }
  for (const selector of ['#scenario', '#reset', '#command', '#command-form button']) {
    $(selector).disabled = storageConflict;
  }

  const showVerification = state.records.length > 0 || ['unknown', 'verified'].includes(state.status);
  $('#verification-panel').hidden = !showVerification;
  $('#verification-report').innerHTML = showVerification ? verificationReportHTML(verificationReport(state), {status: state.status}) : '';
  $('#live-status').textContent = `${describe(state)}. ${state.events.at(-1)}. ${persistence.message}`;
  $('#event-log').replaceChildren(...state.events.map(text => {
    const item = document.createElement('li'); item.textContent = text; return item;
  }));
  restoreFocus(previousFocus);
  if (storageConflict && (previousFocus || activeBeforeRender?.disabled)) {
    $('#reload-saved').focus({preventScroll: true});
  }
}

function applySnapshot(snapshot, previousFocus = null) {
  state = snapshot.state;
  persistence = snapshot.persistence;
  restoreNotice = snapshot.notice;
  storageConflict = snapshot.conflict;
  render(previousFocus);
}

function commitState(next, options = {}) {
  const previousFocus = focusedControl();
  applySnapshot(storageSession.commit(next, options), previousFocus);
}

function act(action) {
  commitState(transition(state, action), {clearNotice: action === 'reset'});
}

$('#controls').addEventListener('click', event => {
  const target = event.target.closest('[data-action]'); if (target) act(target.dataset.action);
});
$('#controls').addEventListener('change', event => { if (event.target.id === 'approval') act('approve'); });
$('#scenario').addEventListener('change', event => { commitState(initial(event.target.value), {clearNotice: true}); });
$('#reset').addEventListener('click', () => act('reset'));
$('#reload-saved').addEventListener('click', () => {
  applySnapshot(storageSession.reloadSaved());
  $('#status-title').focus({preventScroll: true});
});
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) applySnapshot(storageSession.checkForUpdates(), focusedControl());
});
$('#command-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = $('#command').value.trim().toLowerCase().replace(/[.!?]/g, '');
  $('#command').value = '';
  if (['later', 'earlier', 'pause', 'resume'].includes(query)) {
    const next = transition(state, query);
    if (next.events.length === state.events.length) next.events.push(`That command is not available now. ${nextStep(state)}`);
    commitState(next);
  } else {
    const next = structuredClone(state);
    next.events.push(query === 'read summary' ? appointmentSummaryText(state) : 'Try later, earlier, pause, resume, or read summary.');
    commitState(next);
  }
});
render();
