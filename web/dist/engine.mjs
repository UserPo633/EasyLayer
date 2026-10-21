export const slots = ['10:00 AM', '11:30 AM', '2:00 PM'];
export const scenarios = {normal: 'Smooth booking', lost: 'Lost response', changed: 'Time no longer available', mismatch: 'Record details do not match'};
export const sample = Object.freeze({
  serviceId: 'pottery-101', service: 'Pottery for beginners',
  providerId: 'clay-house', provider: 'Clay House Studio',
  date: '2026-11-14', timezone: 'America/Los_Angeles',
  durationMinutes: 60, priceMinor: 3500, currency: 'USD', contact: 'Alex Demo'
});
export const bookingFields = Object.freeze([...Object.keys(sample), 'time']);
export function appointment(slot) { return {...sample, time: slots[slot]}; }
const matches = (a, b) => Boolean(a && b && bookingFields.every(k => Object.hasOwn(a, k) && Object.hasOwn(b, k) && a[k] === b[k]));
const fieldLabels = {serviceId: 'Service ID', service: 'Service', providerId: 'Provider ID', provider: 'Provider', date: 'Date',
  timezone: 'Time zone', durationMinutes: 'Duration (minutes)', priceMinor: 'Price (minor units)', currency: 'Currency', contact: 'Contact', time: 'Time'};
const printable = value => value === undefined || value === null ? 'Missing' : ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : 'Unsupported value';
export function verificationReport(s) {
  const records = Array.isArray(s.records) ? s.records : [], record = records.length === 1 ? records[0] : null;
  const approvalMatches = s.approved === true && matches(s.approvedSnapshot, appointment(s.slot));
  const expectedIdPresent = typeof s.expectedRecordId === 'string' && s.expectedRecordId.length > 0;
  const checks = [
    {key: 'approval', label: 'Current appointment approved', expected: 'Explicit approval of all current details', observed: approvalMatches ? 'Approved details match' : 'Missing or outdated approval', matches: approvalMatches},
    {key: 'recordCount', label: 'Sample record count', expected: '1', observed: String(records.length), matches: records.length === 1},
    {key: 'id', label: 'Record ID', expected: printable(s.expectedRecordId), observed: printable(record?.id), matches: expectedIdPresent && record?.id === s.expectedRecordId},
    ...bookingFields.map(key => ({key, label: fieldLabels[key], expected: printable(s.approvedSnapshot?.[key]), observed: printable(record?.[key]),
      matches: Boolean(s.approvedSnapshot && record && Object.hasOwn(s.approvedSnapshot, key) && Object.hasOwn(record, key) && s.approvedSnapshot[key] === record[key])}))
  ];
  const verified = checks.every(check => check.matches);
  const eligible = approvalMatches && records.length === 1 && expectedIdPresent;
  const reason = verified ? 'Every approved detail and the expected record ID match.'
    : !approvalMatches ? 'The current appointment does not have complete, matching approval.'
    : records.length !== 1 ? 'Exactly one existing sample record is required. No new submission is allowed.'
    : !expectedIdPresent ? 'The expected record ID is missing. The result remains unknown.'
    : 'The existing record differs from the approved appointment. The result remains unknown.';
  return {verified, eligible, reason, recordCount: records.length, checks};
}
export function recordMatchesApproval(s) { return verificationReport(s).verified; }
export function initial(scenario = 'normal') {
  return {version: 3, scenario, status: 'choose', slot: 0, approved: false, approvedSnapshot: null, unavailableSlots: [], availabilityUncertain: false,
    expectedRecordId: null, records: [], events: ['Demo ready. All appointments are fictional.'], attempts: 0};
}
const revoke = s => { s.approved = false; s.approvedSnapshot = null; };
const unavailable = (s, slot) => s.unavailableSlots?.includes(slot) === true;
function nextAvailableSlot(s, direction = 1) {
  for (let offset = 1; offset <= slots.length; offset++) {
    const slot = (s.slot + offset * direction + slots.length) % slots.length;
    if (!unavailable(s, slot)) return slot;
  }
  return null;
}
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
    if (s.availabilityUncertain) { revoke(s); s.status = 'conflict'; log('Older availability cannot be reconstructed. Reset demo before starting another sample booking.'); return s; }
    const slot = nextAvailableSlot(s, action === 'later' ? 1 : -1);
    if (slot === null) { revoke(s); s.status = 'conflict'; log('No sample times remain available. Reset demo to start a new scenario.'); return s; }
    s.slot = slot;
    revoke(s);
    if (s.status === 'conflict') s.status = 'choose';
    log('Selected ' + slots[s.slot] + '. Review is required.');
  }
  if (action === 'draft' && ['choose', 'conflict'].includes(s.status)) {
    if (s.availabilityUncertain) { log('Older availability cannot be reconstructed. Reset demo before starting another sample booking.'); return s; }
    if (s.status === 'conflict' || unavailable(s, s.slot)) {
      const slot = nextAvailableSlot(s);
      if (slot === null) { s.status = 'conflict'; log('No sample times remain available. Reset demo to start a new scenario.'); return s; }
      s.slot = slot;
    }
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
  if (action === 'discard' && ['choose', 'draft', 'paused', 'conflict'].includes(s.status) && !s.records.length) {
    const clean = initial(s.scenario);
    clean.unavailableSlots = [...(s.unavailableSlots ?? [])]; clean.availabilityUncertain = s.availabilityUncertain === true;
    clean.conflictHandled = s.conflictHandled === true;
    const slot = unavailable(clean, clean.slot) ? nextAvailableSlot(clean) : clean.slot;
    if (slot !== null) clean.slot = slot;
    if (slot === null || clean.availabilityUncertain) clean.status = 'conflict';
    clean.events.push('Draft discarded. Known unavailable times remain unavailable.');
    return clean;
  }
  if (action === 'submit') {
    if (s.status === 'unknown' || s.status === 'verified') {
      log('Duplicate attempt blocked. No additional record was created.'); return s;
    }
    if (s.status !== 'draft' || s.approved !== true || !matches(s.approvedSnapshot, appointment(s.slot))) {
      revoke(s); log('Review and explicit approval of the current details are required.'); return s;
    }
    // Existing records are never overwritten or bypassed by a fresh submission.
    if (s.records.length) { checkRecord(s); return s; }
    if (s.availabilityUncertain || unavailable(s, s.slot)) {
      s.status = 'conflict'; revoke(s); log('This time is unavailable or cannot be revalidated. No record was created.'); return s;
    }
    s.attempts++;
    if (s.scenario === 'changed' && !s.conflictHandled) {
      s.unavailableSlots = [...new Set([...(s.unavailableSlots ?? []), s.slot])];
      s.conflictHandled = true; s.status = 'conflict'; revoke(s);
      log('Availability changed before writing. No record was created.'); return s;
    }
    s.expectedRecordId = 'DEMO-1042';
    s.records.push({id: s.expectedRecordId, ...s.approvedSnapshot});
    if (s.scenario === 'mismatch') s.records[0].service = 'Advanced ceramics (different sample service)';
    s.status = 'unknown';
    if (s.scenario === 'lost') log('Submission response lost. Outcome unknown; check the existing record.');
    else checkRecord(s);
  }
  if (action === 'verify' && s.status === 'unknown') checkRecord(s);
  return s;
}
// Local storage is editable sample data, not an authenticated source of real bookings.
export function restoreState(value) {
  const valid = value && [1, 2, 3].includes(value.version) && Object.hasOwn(scenarios, value.scenario)
    && ['choose', 'draft', 'paused', 'unknown', 'verified', 'conflict'].includes(value.status)
    && Number.isInteger(value.slot) && value.slot >= 0 && value.slot < slots.length
    && Array.isArray(value.records) && value.records.every(r => r && typeof r === 'object' && !Array.isArray(r))
    && Array.isArray(value.events) && value.events.every(e => typeof e === 'string')
    && Number.isInteger(value.attempts) && value.attempts >= 0
    && (value.version !== 3 || (Array.isArray(value.unavailableSlots)
      && value.unavailableSlots.every(slot => Number.isInteger(slot) && slot >= 0 && slot < slots.length)
      && typeof value.availabilityUncertain === 'boolean'));
  if (!valid) throw new Error('Invalid saved demo');
  const s = structuredClone(value); s.version = 3;
  if (value.version < 3) {
    s.unavailableSlots = []; s.availabilityUncertain = false;
    if (s.scenario === 'changed' && s.conflictHandled) {
      if (s.status === 'conflict') s.unavailableSlots = [s.slot];
      else if (!s.records.length) {
        s.availabilityUncertain = true; s.status = 'conflict'; revoke(s);
        s.events.push('Older progress does not identify the unavailable time. Reset demo before another sample booking.');
      }
    }
  }
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
  if (s.availabilityUncertain) return 'The older draft lacks availability history. Reset demo to start a new sample scenario.';
  return ({choose: 'Select a time, then create your draft.', draft: s.approved ? 'Submit the approved sample appointment.' : 'Confirm the details before you approve.',
    paused: 'Resume this draft when you are ready.', unknown: 'Check the existing record before doing anything else.',
    verified: 'The sample record matches every approved detail.', conflict: 'Choose another time and review the new details.'})[s.status];
}
