// DOM behavior using a synthetic MCP host. These are not native Alexa or browser E2E tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const markup = fs.readFileSync('bridge/simulator/index.html', 'utf8');
const source = fs.readFileSync('bridge/simulator/app.js', 'utf8');
const origin = 'http://127.0.0.1:8092';
const summary = { service: 'Photo <img src=x onerror=alert(1)>', provider: 'Demo Teacher', date: '2099-10-01', time: '10:00', timezone: 'UTC', duration_minutes: 60, price: 35, currency: 'USD' };
const draft = (state = 'draft', extra = {}) => ({ draft_id: 'draft-one', state, verified: state === 'verified', summary, booking_id: state === 'verified' ? 'receipt-one' : null, review_url: `${origin}/review/draft-one?token=private-review-key`, ...extra });
const catalog = { services: [{ id: '1', name: summary.service, duration: 60, price: 35, currency: 'USD' }], providers: [{ id: '7', first_name: 'Demo', last_name: 'Teacher', timezone: 'UTC', services: ['1'] }], source_mode: 'native_http' };
const times = { service_id: '1', provider_id: '7', date: summary.date, timezone: 'UTC', available_times: ['10:00', '11:00', '13:00'] };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function setup(handlers = {}, configure = () => {}) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: `${origin}/simulator/` });
  const calls = []; const fetches = [];
  const responses = { resume_booking: { state: 'none', draft_id: null }, list_services: catalog, find_available_times: times, create_booking_draft: draft(), get_booking_status: draft('approved'), complete_booking: draft('verified'), cancel_booking_draft: draft('cancelled'), verify_booking: draft('unknown'), ...handlers };
  dom.window.fetch = async (url, options = {}) => {
    fetches.push({ url, options });
    if (url.endsWith('/session')) return { ok: true, json: async () => ({ csrf_token: 'test-csrf', mode: 'native_http', alexa_runtime_verified: false, planner_mode: 'guided' }) };
    const call = JSON.parse(options.body); calls.push(call);
    let response = responses[call.name];
    if (typeof response === 'function') response = await response(call.arguments);
    if (response instanceof Error) throw response;
    return { ok: true, json: async () => response?.isError ? response : { structuredContent: response } };
  };
  configure(dom.window); dom.window.eval(source);
  const el = id => dom.window.document.getElementById(id);
  const idle = async () => { for (let n = 0; n < 40; n++) { await tick(); if (el('main').getAttribute('aria-busy') === 'false') return; } throw new Error('UI did not settle'); };
  const submit = id => el(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const command = async text => { el('command').value = text; submit('command-form'); await idle(); };
  await idle();
  return { dom, el, calls, fetches, idle, submit, command, set: (key, value) => { responses[key] = value; } };
}

test('simulator resumes through MCP, keeps the bearer out of browser calls and renders source facts as text', async () => {
  const ui = await setup({ resume_booking: draft() });
  assert.deepEqual(ui.calls.map(call => call.name), ['resume_booking', 'list_services']);
  assert.equal(ui.el('service-title').textContent, summary.service);
  assert.equal(ui.dom.window.document.querySelectorAll('img').length, 0);
  assert.equal(ui.el('review-link').href, draft().review_url);
  assert.match(ui.el('notice').textContent, /older review tab/);
  assert.equal(ui.el('complete-booking').hidden, true);
  assert.equal(ui.dom.window.localStorage.length, 0);
  for (const fetch of ui.fetches.filter(item => item.options.method === 'POST')) { assert.equal(fetch.options.headers['X-EasyLayer-CSRF'], 'test-csrf'); assert.equal(fetch.options.headers.Authorization, undefined); }
  assert.doesNotMatch(ui.el('tool-history').textContent, /private-review-key/);
  ui.dom.window.close();
});

test('source availability and adjacent-time commands select only returned times, then create a draft explicitly', async () => {
  const ui = await setup(); ui.el('date').value = summary.date; ui.submit('search-form'); await ui.idle();
  const options = ui.dom.window.document.querySelectorAll('.time-choice'); options[0].click();
  await ui.command('later'); assert.equal(options[1].getAttribute('aria-pressed'), 'true');
  await ui.command('earlier'); assert.equal(options[0].getAttribute('aria-pressed'), 'true');
  const before = ui.calls.length; await ui.command('earlier'); assert.match(ui.el('notice').textContent, /no earlier/); assert.equal(ui.calls.length, before);
  assert.equal(ui.calls.some(call => call.name === 'create_booking_draft'), false);
  ui.el('create-draft').click(); await ui.idle();
  assert.deepEqual(ui.calls.at(-1), { name: 'create_booking_draft', arguments: { service_id: '1', provider_id: '7', date: summary.date, time: '10:00' } });
  assert.equal(ui.el('review-link').hidden, false); assert.equal(ui.el('choice-fields').disabled, true);
  await ui.command('book it now'); assert.equal(ui.calls.some(call => call.name === 'complete_booking'), false);
  ui.dom.window.close();
});

test('approved is not success; a repeated click sends once and only verified state shows a receipt', async () => {
  let resolveComplete;
  const ui = await setup({ resume_booking: draft('approved'), complete_booking: () => new Promise(resolve => { resolveComplete = resolve; }) });
  assert.match(ui.el('booking-status').textContent, /not booked yet/); assert.equal(ui.el('receipt').hidden, true);
  ui.el('complete-booking').click(); ui.el('complete-booking').click(); await tick();
  assert.equal(ui.calls.filter(call => call.name === 'complete_booking').length, 1);
  resolveComplete(draft('verified')); await ui.idle();
  assert.equal(ui.el('receipt').hidden, false); assert.match(ui.el('receipt-id').textContent, /receipt-one/); assert.equal(ui.el('booking-status').textContent, 'Booking verified');
  ui.dom.window.close();
});

test('lost completion response invalidates stale approved controls and keeps retry focused on existing draft', async () => {
  const ui = await setup({ resume_booking: draft('approved'), complete_booking: new Error('connection lost') });
  ui.el('complete-booking').click(); await ui.idle();
  assert.equal(ui.el('complete-booking').hidden, true); assert.equal(ui.el('new-booking').hidden, true); assert.equal(ui.el('discard-draft').hidden, true);
  assert.match(ui.el('booking-status').textContent, /needs checking/); assert.equal(ui.el('service-title').textContent, summary.service);
  ui.set('get_booking_status', draft('unknown')); ui.el('refresh-status').click(); await ui.idle();
  assert.equal(ui.el('verify-booking').hidden, false); assert.equal(ui.el('new-booking').hidden, true); assert.equal(ui.el('choice-fields').disabled, true);
  assert.equal(ui.calls.filter(call => call.name === 'complete_booking').length, 1);
  ui.dom.window.close();
});

test('unknown resumes locked and duplicate follows the referenced existing booking', async () => {
  const ui = await setup({ resume_booking: draft('duplicate', { related_draft_id: 'prior-request' }), get_booking_status: draft('unknown', { draft_id: 'prior-request' }) });
  assert.equal(ui.el('new-booking').hidden, true); assert.equal(ui.el('discard-draft').hidden, true);
  ui.el('verify-booking').click(); await ui.idle();
  assert.deepEqual(ui.calls.at(-1), { name: 'get_booking_status', arguments: { draft_id: 'prior-request' } });
  assert.equal(ui.el('verify-booking').textContent, 'Check existing booking'); assert.equal(ui.el('choice-fields').disabled, true);
  ui.el('verify-booking').click(); await ui.idle(); assert.equal(ui.calls.at(-1).name, 'verify_booking');
  assert.equal(ui.calls.some(call => call.name === 'create_booking_draft'), false);
  ui.dom.window.close();
});

test('failed source connection has no fixture fallback and keeps a restored draft available', async () => {
  const ui = await setup({ resume_booking: draft('draft'), list_services: { isError: true } });
  assert.equal(ui.el('source-error').hidden, false); assert.equal(ui.el('choice-fields').disabled, true);
  assert.equal(ui.dom.window.document.querySelectorAll('.time-choice').length, 0);
  assert.equal(ui.el('service-title').textContent, summary.service); assert.equal(ui.el('review-link').hidden, false);
  assert.match(ui.el('connection-status').textContent, /needs attention/);
  ui.dom.window.close();
});

test('untrusted review links and inconsistent success signals are never presented as valid', async () => {
  const ui = await setup({ resume_booking: draft('draft', { review_url: 'https://untrusted.example/review/draft-one?token=private' }) });
  assert.equal(ui.el('review-link').hidden, true); assert.equal(ui.el('review-unavailable').hidden, false);
  ui.set('get_booking_status', draft('verified', { verified: false })); ui.el('refresh-status').click(); await ui.idle();
  assert.equal(ui.el('receipt').hidden, true); assert.match(ui.el('notice').textContent, /verification signal/);
  assert.equal(ui.el('complete-booking').hidden, true);
  ui.dom.window.close();
});

test('speech recognition requires manual review and never auto-executes a booking command', async () => {
  let recognition;
  const ui = await setup({}, window => { window.SpeechRecognition = class { constructor() { recognition = this; } start() { this.onstart(); } stop() { this.onend?.(); } }; });
  const before = ui.calls.length; ui.el('listen').click(); recognition.onresult({ results: [[{ transcript: 'find times' }]] }); recognition.onend(); await tick();
  assert.equal(ui.el('command').value, 'find times'); assert.equal(ui.calls.length, before);
  ui.submit('command-form'); await ui.idle(); assert.equal(ui.calls.at(-1).name, 'find_available_times');
  ui.dom.window.close();
});

test('discard is a server mutation for unsubmitted drafts and a fresh choice never claims reservation cancellation', async () => {
  const ui = await setup({ resume_booking: draft('approved') });
  ui.el('discard-draft').click(); await ui.idle(); assert.deepEqual(ui.calls.at(-1), { name: 'cancel_booking_draft', arguments: { draft_id: 'draft-one' } });
  assert.match(ui.el('next-action').textContent, /No reservation was cancelled/);
  ui.el('new-booking').click(); assert.equal(ui.el('active-draft').hidden, true); assert.equal(ui.el('choice-fields').disabled, false);
  ui.dom.window.close();
});

test('expired-session failures expose recovery and retry always establishes a fresh session before resuming', async () => {
  const ui = await setup({ resume_booking: draft('approved'), get_booking_status: new Error('session expired') });
  ui.el('refresh-status').click(); await ui.idle();
  assert.equal(ui.el('source-error').hidden, false); assert.equal(ui.el('complete-booking').hidden, true);
  ui.el('retry-connection').click(); await ui.idle();
  assert.equal(ui.fetches.filter(fetch => fetch.url.endsWith('/session')).length, 2);
  assert.equal(ui.calls.filter(call => call.name === 'resume_booking').length, 2);
  assert.equal(ui.el('source-error').hidden, true); assert.equal(ui.el('complete-booking').hidden, false);
  ui.dom.window.close();
});

test('startup resume failure leaves a visible retry action rather than an empty blocked page', async () => {
  const ui = await setup({ resume_booking: new Error('MCP temporarily unavailable') });
  assert.equal(ui.el('source-error').hidden, false); assert.equal(ui.el('retry-connection').disabled, false);
  assert.equal(ui.el('choice-fields').disabled, true); assert.equal(ui.calls.some(call => call.name === 'list_services'), false);
  ui.dom.window.close();
});
