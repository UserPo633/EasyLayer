export const slots = ['10:00 AM', '11:30 AM', '2:00 PM'];
export const scenarios = {normal: 'Smooth booking', lost: 'Lost response', changed: 'Time no longer available'};
export const sample = Object.freeze({
  serviceId: 'pottery-101', service: 'Pottery for beginners',
  providerId: 'clay-house', provider: 'Clay House Studio',
  date: '2026-11-14', timezone: 'America/Los_Angeles',
  durationMinutes: 60, priceMinor: 3500, currency: 'USD', contact: 'Alex Demo'
});
export const bookingFields = Object.freeze([...Object.keys(sample), 'time']);
export function appointment(slot) { return {...sample, time: slots[slot]}; }
const matches = (a, b) => Boolean(a && b && bookingFields.every(k => Object.hasOwn(a, k) && Object.hasOwn(b, k) && a[k] === b[k]));
export function recordMatchesApproval(s) {
  return s.approved === true && s.records.length === 1 && typeof s.expectedRecordId === 'string' && s.expectedRecordId.length > 0
    && s.records[0]?.id === s.expectedRecordId
    && matches(s.approvedSnapshot, appointment(s.slot))
    && matches(s.records[0], s.approvedSnapshot);
}
export function initial(scenario = 'normal') {
  return {version: 2, scenario, status: 'choose', slot: 0, approved: false, approvedSnapshot: null,
    expectedRecordId: null, records: [], events: ['Demo ready. All appointments are fictional.'], attempts: 0};
}
const revoke = s => { s.approved = false; s.approvedSnapshot = null; };
function checkRecord(s) {
  if (recordMatchesApproval(s)) {
    s.status = 'verified';
    s.events.push('All approved details and the existing record ID matched. Verified without another write.');
  } else {
    s.status = 'unknown';
    s.events.push('The record is missing, ambiguous, or does not match every approved detail. Still unverified.');
  }
}
export function transition(state, action) {
  if (action === 'reset') return initial(state.scenario);
  const s = structuredClone(state);
  const log = x => s.events.push(x);
  if (['later', 'earlier'].includes(action) && ['choose', 'draft', 'conflict'].includes(s.status)) {
    s.slot = (s.slot + (action === 'later' ? 1 : slots.length - 1)) % slots.length;
    revoke(s);
    if (s.status === 'conflict') s.status = 'choose';
    log('Selected ' + slots[s.slot] + '. Review is required.');
  }
  if (action === 'draft' && ['choose', 'conflict'].includes(s.status)) {
    if (s.status === 'conflict') s.slot = (s.slot + 1) % slots.length;
    s.status = 'draft'; revoke(s);
    log('Draft created. No booking has been made.');
  }
  if (action === 'pause' && s.status === 'draft') {
    s.status = 'paused'; revoke(s); log('Paused. Resume this draft from the current screen.');
  }
  if (action === 'resume' && s.status === 'paused') {
    s.status = 'draft'; log('Restored the same draft and time.');
  }
  if (action === 'approve' && s.status === 'draft') {
    if (s.approved) { revoke(s); log('Approval removed.'); }
    else { s.approved = true; s.approvedSnapshot = appointment(s.slot); log('You approved this exact draft.'); }
  }
  if (action === 'discard' && ['choose', 'draft', 'paused', 'conflict'].includes(s.status) && !s.records.length) return initial(s.scenario);
  if (action === 'submit') {
    if (s.status === 'unknown' || s.status === 'verified') {
      log('Duplicate attempt blocked. No additional record was created.'); return s;
    }
    if (s.status !== 'draft' || s.approved !== true || !matches(s.approvedSnapshot, appointment(s.slot))) {
      revoke(s); log('Review and explicit approval of the current details are required.'); return s;
    }
    // Existing records are never overwritten or bypassed by a fresh submission.
    if (s.records.length) { checkRecord(s); return s; }
    s.attempts++;
    if (s.scenario === 'changed' && !s.conflictHandled) {
      s.conflictHandled = true; s.status = 'conflict'; revoke(s);
      log('Availability changed before writing. No record was created.'); return s;
    }
    s.expectedRecordId = 'DEMO-1042';
    s.records.push({id: s.expectedRecordId, ...s.approvedSnapshot});
    s.status = 'unknown';
    if (s.scenario === 'lost') log('Submission response lost. Outcome unknown; check the existing record.');
    else checkRecord(s);
  }
  if (action === 'verify' && s.status === 'unknown') checkRecord(s);
  return s;
}
// Local storage is editable sample data, not an authenticated source of real bookings.
export function restoreState(value) {
  const valid = value && [1, 2].includes(value.version) && Object.hasOwn(scenarios, value.scenario)
    && ['choose', 'draft', 'paused', 'unknown', 'verified', 'conflict'].includes(value.status)
    && Number.isInteger(value.slot) && value.slot >= 0 && value.slot < slots.length
    && Array.isArray(value.records) && value.records.every(r => r && typeof r === 'object' && !Array.isArray(r))
    && Array.isArray(value.events) && value.events.every(e => typeof e === 'string')
    && Number.isInteger(value.attempts) && value.attempts >= 0;
  if (!valid) throw new Error('Invalid saved demo');
  const s = structuredClone(value); s.version = 2;
  if (value.version === 1) {
    revoke(s); s.expectedRecordId = null;
    s.events.push('Older demo progress restored. Missing approval details cannot be reconstructed.');
  }
  if (s.records.length || ['unknown', 'verified'].includes(s.status)) {
    if (s.status !== 'verified' || !recordMatchesApproval(s)) {
      s.status = 'unknown'; s.events.push('Restored record requires verification. No new submission is allowed.');
    }
  } else {
    if (s.approved !== true || s.status !== 'draft' || !matches(s.approvedSnapshot, appointment(s.slot))) revoke(s);
    s.expectedRecordId = null;
  }
  return s;
}
export function describe(s) {
  return ({choose: 'Choose an available time', draft: s.approved ? 'Ready to submit' : 'Review your draft',
    paused: 'Your draft is paused', unknown: 'We need to check the result', verified: 'Verified in the simulator',
    conflict: 'That time just became unavailable'})[s.status];
}
export function nextStep(s) {
  return ({choose: 'Select a time, then create your draft.', draft: s.approved ? 'Submit the approved sample appointment.' : 'Confirm the details before you approve.',
    paused: 'Resume this draft when you are ready.', unknown: 'Check the existing record before doing anything else.',
    verified: 'The sample record matches every approved detail.', conflict: 'Choose another time and review the new details.'})[s.status];
}
