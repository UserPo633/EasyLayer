import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, transition, appointment, verificationReport} from '../dist/engine.mjs';
import {appointmentSummaryText, appointmentSummaryHTML, verificationReportHTML} from '../dist/presentation.mjs';

test('read summary includes the current appointment details needed for approval', () => {
  const state = transition(initial(), 'later'), item = appointment(state.slot);
  const text = appointmentSummaryText(state);
  for (const field of ['service', 'provider', 'date', 'time', 'timezone', 'contact', 'currency']) assert.ok(text.includes(item[field]), field);
  assert.match(text, /60 minutes/); assert.match(text, /35\.00/); assert.match(text, /No real booking/);
  assert.ok(!text.includes(appointment(0).time));
});

test('semantic appointment summary exposes named fields and exact currency without the SVG', () => {
  const html = appointmentSummaryHTML(initial());
  for (const field of ['Class', 'Provider', 'Date', 'Time', 'Time zone', 'Duration', 'Price', 'Contact']) assert.ok(html.includes(`<dt>${field}</dt>`));
  assert.match(html, /USD \$35\.00/); assert.match(html, /2026-11-14/); assert.match(html, /America\/Los_Angeles/);
});

test('verification output escapes external record text and distinguishes missing details', () => {
  const html = verificationReportHTML({verified: false, reason: '<img src=x onerror=alert(1)>', checks: [
    {key: 'service', label: 'Service', expected: 'Pottery', observed: '<script>alert(1)</script>', matches: false},
    {key: 'contact', label: 'Contact', expected: 'Alex', observed: undefined, matches: false}
  ]});
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /Not available/); assert.match(html, /Does not match/);
  assert.match(html, /scope="row">Service/); assert.match(html, /never authorizes another submission/);
});

test('matching sample data does not announce success before explicit lost-response verification', () => {
  let state = ['draft', 'approve', 'submit'].reduce(transition, initial('lost'));
  const pending = verificationReportHTML(verificationReport(state), {status: state.status});
  assert.match(pending, /outcome is still unknown/); assert.match(pending, /Choose Check existing record/);
  assert.match(pending, /verification-result mismatch/);
  state = transition(state, 'verify');
  const verified = verificationReportHTML(verificationReport(state), {status: state.status});
  assert.match(verified, /verification-result match/); assert.doesNotMatch(verified, /outcome is still unknown/);
});
