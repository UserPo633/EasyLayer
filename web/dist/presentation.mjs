import {appointment, describe} from './engine.mjs';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function appointmentValues(state) {
  const item = appointment(state.slot);
  const price = new Intl.NumberFormat('en-US', {style: 'currency', currency: item.currency}).format(item.priceMinor / 100);
  return {item, price: `${item.currency} ${price}`};
}

export function appointmentSummaryText(state) {
  const {item, price} = appointmentValues(state);
  return `${item.service} at ${item.provider}, ${item.date}, ${item.time}, time zone ${item.timezone}. `
    + `${item.durationMinutes} minutes, ${price}. Contact: ${item.contact} (fictional). ${describe(state)}. No real booking.`;
}

export function appointmentSummaryHTML(state) {
  const {item, price} = appointmentValues(state);
  const fields = [
    ['Class', item.service], ['Provider', item.provider], ['Date', item.date], ['Time', item.time],
    ['Time zone', item.timezone], ['Duration', `${item.durationMinutes} minutes`],
    ['Price', price], ['Contact', `${item.contact} (fictional)`]
  ];
  return '<h3 id="appointment-summary-title">Review this sample appointment</h3><dl>'
    + fields.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')
    + `</dl><p class="summary-footnote">${state.records.length} sample record${state.records.length === 1 ? '' : 's'} · No real booking</p>`;
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function verificationReportHTML(report, {status = 'unknown'} = {}) {
  const confirmed = status === 'verified' && report.verified;
  const reason = !confirmed && report.verified
    ? 'The sample fields match, but the outcome is still unknown. Choose Check existing record to verify the result.'
    : report.reason;
  return `<p class="verification-result ${confirmed ? 'match' : 'mismatch'}">${escapeHTML(reason)}</p>`
    + '<div class="table-scroll" role="region" aria-label="Booking verification details" tabindex="0"><table>'
    + '<caption>Approved details compared with the sample record</caption><thead><tr><th scope="col">Check</th><th scope="col">Expected</th><th scope="col">Observed</th><th scope="col">Result</th></tr></thead><tbody>'
    + report.checks.map(check => `<tr><th scope="row">${escapeHTML(check.label)}</th><td>${escapeHTML(displayValue(check.expected))}</td><td>${escapeHTML(displayValue(check.observed))}</td><td><span class="check-result ${check.matches ? 'match' : 'mismatch'}">${check.matches ? 'Match' : 'Does not match'}</span></td></tr>`).join('')
    + '</tbody></table></div><p class="verification-footnote">This checks fictional sample data. A mismatch keeps the result unverified and never authorizes another submission.</p>';
}
