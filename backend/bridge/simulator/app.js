/* Guided demo host. All booking data and transitions come from MCP tools. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { csrf: null, busy: false, catalog: null, active: null, reviewUrl: null, times: null, selectedTime: null, unconfirmed: false, history: [], reviewOpened: false };
  const closedStates = new Set(['verified', 'cancelled', 'expired', 'conflict', 'changed']);
  const statusLabels = { draft: 'Review needed · not booked', approved: 'Approved · not booked yet', pending: 'Checking the booking', unknown: 'Outcome needs checking', conflict: 'Time no longer available', changed: 'Booking details changed', expired: 'Draft expired', verified: 'Booking verified', cancelled: 'Unsubmitted draft discarded', duplicate: 'An existing booking needs attention' };
  const nextSteps = {
    draft: 'Open the separate review page. Check these details, enter your contact information, and approve. Then return here.',
    approved: 'You approved these details. Choose “Complete approved booking” to send the booking and check the original record.',
    pending: 'A booking request may be in progress. Check the existing booking. Do not submit again or create a new booking to retry.',
    unknown: 'We cannot confirm the outcome yet. Check the existing booking or the original service. Do not book again to retry.',
    conflict: 'This time is no longer available. Choose another time and review a fresh draft before booking.',
    changed: 'The source changed the booking details. Choose again and review a fresh summary before booking.',
    expired: 'This draft is no longer valid. Choose a time again and approve a fresh draft.',
    verified: 'The booking service’s original record matches this summary. Keep the booking reference below.',
    cancelled: 'This draft was discarded before submission. No reservation was cancelled. You can choose another time.',
    duplicate: 'There is already a request for this appointment. Resume that existing booking and check it before doing anything else.'
  };

  function announce(message) { $('announcer').textContent = message; }
  function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = false; announce(message); }
  function clearNotice() { $('notice').hidden = true; $('notice').textContent = ''; }
  function history(name, ok) {
    state.history.unshift({ name, ok }); state.history = state.history.slice(0, 8);
    $('tool-history').replaceChildren(...state.history.map(item => { const li = document.createElement('li'); li.textContent = `${item.name} · ${item.ok ? 'response received' : 'needs checking'}`; return li; }));
  }
  async function tool(name, args = {}) {
    try {
      const response = await fetch('/simulator/api/tool', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-EasyLayer-CSRF': state.csrf }, body: JSON.stringify({ name, arguments: args }) });
      if (!response.ok) throw new Error('The simulator could not reach its MCP tools. Retry the connection, then check the current booking status.');
      const result = await response.json();
      if (result.isError) throw new Error('The booking tool could not complete this request. Check the source connection and the current booking status.');
      const data = result.structuredContent || JSON.parse(result.content?.find(item => item.type === 'text')?.text || '{}');
      history(name, true); return data;
    } catch (error) { history(name, false); throw error; }
  }
  function locksChoices() { return !!state.active; }
  function eligibleProviders() { return (state.catalog?.providers || []).filter(provider => provider.services?.includes($('service').value)); }
  function chosenProvider() { return eligibleProviders().find(provider => provider.id === $('provider').value); }
  function chosenService() { return state.catalog?.services?.find(service => service.id === $('service').value); }
  function dateInZone(zone) {
    try { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-'); }
    catch { return new Date().toISOString().slice(0, 10); }
  }
  function price(summary) { const value = Number(summary.price); return `${summary.currency || ''} ${Number.isFinite(value) ? value.toFixed(2) : summary.price}`.trim(); }
  function friendlyDate(value) {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed);
  }
  function refreshChoiceDetails() {
    const provider = chosenProvider(); const service = chosenService();
    $('service-detail').textContent = service ? `${service.duration} minutes · ${price(service)}` : '';
    $('timezone').textContent = provider ? `All times are shown in ${provider.timezone}.` : 'Choose a provider to see the timezone.';
    const today = dateInZone(provider?.timezone || 'UTC'); $('date').min = today;
    if (!$('date').value || $('date').value < today) $('date').value = today;
    resetTimes(); renderControls();
  }
  function renderProviders() {
    const providers = eligibleProviders();
    $('provider').replaceChildren(...providers.map(provider => new Option(`${provider.first_name || ''} ${provider.last_name || ''}`.trim() || 'Provider', provider.id)));
    if (!providers.length) $('provider').append(new Option('No provider is available', ''));
    refreshChoiceDetails();
  }
  function resetTimes() { state.times = null; state.selectedTime = null; $('times-section').hidden = true; $('times').replaceChildren(); }
  function renderControls() {
    const ready = !!state.csrf; const locked = locksChoices(); const active = state.active;
    document.querySelectorAll('button').forEach(button => { button.disabled = state.busy || !ready; });
    $('choice-fields').disabled = state.busy || !ready || !state.catalog?.services?.length || locked;
    $('find-times').disabled = state.busy || !ready || !chosenProvider() || !chosenService() || locked;
    $('create-draft').disabled = state.busy || !ready || !state.selectedTime || locked || state.unconfirmed;
    document.querySelectorAll('.time-choice').forEach(button => { button.disabled = state.busy || locked; });
    $('complete-booking').disabled = state.busy || !ready || active?.state !== 'approved' || state.unconfirmed;
    $('discard-draft').disabled = state.busy || !ready || !['draft', 'approved'].includes(active?.state) || state.unconfirmed;
    $('refresh-status').disabled = state.busy || !ready || !active;
    $('verify-booking').disabled = state.busy || !ready || !active;
    $('new-booking').disabled = state.busy || !ready || !closedStates.has(active?.state) || state.unconfirmed;
    $('retry-connection').disabled = state.busy;
    $('listen').disabled = state.busy || !SpeechRecognition;
    $('stop-speaking').disabled = false;
    $('choices-locked').hidden = !locked;
    $('choices-locked').textContent = ['pending', 'unknown', 'duplicate'].includes(active?.state) || state.unconfirmed ? 'Check the existing booking before starting another one.' : 'Keep working on your current booking in the summary.';
    $('review-link').setAttribute('aria-disabled', String(state.busy));
    $('main').setAttribute('aria-busy', String(state.busy));
  }
  function safeReviewUrl(value, draftId) {
    if (!value) return null;
    try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin && url.pathname === `/review/${encodeURIComponent(draftId)}` && url.searchParams.has('token') ? url.href : null; } catch { return null; }
  }
  function acceptDraft(data) {
    if (data.state === 'none' && !data.draft_id) { state.active = null; state.reviewUrl = null; state.unconfirmed = false; renderActive(); return; }
    if (!data.draft_id || !data.summary || !statusLabels[data.state]) throw new Error('The booking result could not be read. Check the current status before continuing.');
    if (data.verified === true && data.state !== 'verified' || data.state === 'verified' && data.verified !== true) throw new Error('The result did not include a consistent verification signal. Check the current booking again.');
    if (state.active?.draft_id !== data.draft_id) state.reviewUrl = null;
    state.active = data; state.unconfirmed = false;
    if (data.review_url) state.reviewUrl = safeReviewUrl(data.review_url, data.draft_id);
    if (data.state !== 'draft') state.reviewUrl = null;
    renderActive(); announce(statusLabels[data.state]);
  }
  function renderActive() {
    const data = state.active; const visible = !!data;
    $('empty-draft').hidden = visible; $('active-draft').hidden = !visible;
    const current = !data || closedStates.has(data.state) && data.state !== 'verified' ? 'choose' : data.state === 'draft' ? 'review' : 'verify';
    for (const step of ['choose', 'review', 'verify']) { const el = $(`step-${step}`); el.removeAttribute('aria-current'); el.classList.toggle('done', (step === 'choose' && !!data) || (step === 'review' && data && !['draft', 'cancelled', 'expired'].includes(data.state))); if (step === current) el.setAttribute('aria-current', 'step'); }
    if (!data) { renderControls(); return; }
    const summary = data.summary;
    $('booking-status').textContent = state.unconfirmed ? 'Latest status needs checking' : statusLabels[data.state];
    $('booking-status').className = `status-pill${data.state === 'verified' && !state.unconfirmed ? ' verified' : ['unknown', 'pending', 'duplicate', 'changed', 'conflict', 'expired'].includes(data.state) || state.unconfirmed ? ' warning' : ''}`;
    $('service-title').textContent = summary.service;
    $('booking-summary').replaceChildren();
    for (const [label, value, note] of [['With', summary.provider], ['Date', friendlyDate(summary.date)], ['Time', summary.time, summary.timezone], ['Length', `${summary.duration_minutes} minutes`], ['Price', price(summary)]]) {
      const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value;
      if (note) { const span = document.createElement('span'); span.className = 'summary-note'; span.textContent = note; dd.append(span); }
      $('booking-summary').append(dt, dd);
    }
    const verified = data.state === 'verified' && data.verified === true;
    $('receipt').hidden = !verified; $('receipt-id').textContent = verified ? `Booking reference: ${data.booking_id || 'See original booking service'}` : '';
    $('next-action').textContent = state.unconfirmed ? 'The last request did not return a confirmed status. Check this existing booking before continuing. Do not start another booking to retry.' : nextSteps[data.state];
    $('review-link').hidden = data.state !== 'draft' || !state.reviewUrl || state.unconfirmed;
    $('review-link').href = state.reviewUrl || '#';
    $('review-unavailable').hidden = data.state !== 'draft' || !!state.reviewUrl || state.unconfirmed;
    $('complete-booking').hidden = data.state !== 'approved' || state.unconfirmed;
    $('verify-booking').hidden = !['pending', 'unknown', 'duplicate'].includes(data.state);
    $('verify-booking').textContent = data.state === 'duplicate' ? 'Resume existing booking' : 'Check existing booking';
    $('refresh-status').hidden = ['verified', 'cancelled'].includes(data.state);
    $('refresh-status').textContent = data.state === 'draft' ? 'Check approval / status' : 'Refresh status';
    $('discard-draft').hidden = !['draft', 'approved'].includes(data.state) || state.unconfirmed;
    $('new-booking').hidden = !closedStates.has(data.state) || state.unconfirmed;
    $('new-booking').textContent = verified ? 'Book another time' : 'Choose another time';
    $('draft-id').textContent = `Draft reference: ${data.draft_id}`;
    renderControls();
  }
  async function act(fn, options = {}) {
    if (state.busy) return;
    state.busy = true; clearNotice(); renderControls();
    try { await fn(); }
    catch (error) { if (options.uncertainOnError && state.active) state.unconfirmed = true; $('source-error').hidden = false; notice(error.message || 'The request could not be completed. Check your current booking before continuing.', true); }
    finally { state.busy = false; renderActive(); }
  }
  async function loadCatalog() {
    try {
      const catalog = await tool('list_services');
      if (!Array.isArray(catalog.services) || !Array.isArray(catalog.providers)) throw new Error('The booking service returned an unreadable catalog.');
      state.catalog = catalog;
      $('service').replaceChildren(...catalog.services.map(service => new Option(service.name, service.id)));
      if (!catalog.services.length) $('service').append(new Option('No services are available', ''));
      renderProviders(); $('source-error').hidden = true;
      $('connection-status').textContent = 'Source connected'; $('connection-detail').textContent = 'Live source reads through MCP'; $('connection-indicator').className = 'connection-dot ready';
      $('source-help').textContent = catalog.services.length ? 'Services and times come from the connected booking service.' : 'The booking service currently lists no services. Retry after it is configured.';
    } catch (error) {
      state.catalog = null; $('source-error').hidden = false; $('connection-status').textContent = 'Source needs attention'; $('connection-detail').textContent = 'Start the source, then retry'; $('connection-indicator').className = 'connection-dot error';
      $('service').replaceChildren(new Option('Waiting for booking service', '')); throw error;
    }
  }
  async function resume() {
    const data = await tool('resume_booking'); acceptDraft(data);
    if (data.state === 'draft' && data.review_url) notice('Your unfinished draft is ready. Use the fresh review link below; an older review tab may no longer be valid.');
    else if (data.draft_id) announce(`Resumed your booking. ${statusLabels[data.state] || ''}`);
  }
  async function connect() {
    const response = await fetch('/simulator/api/session', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('The local simulator is unavailable. Start the EasyLayer bridge and reload this page.');
    const session = await response.json();
    if (!session.csrf_token || session.mode !== 'native_http' || session.alexa_runtime_verified !== false) throw new Error('This page requires the native-source simulator host. It will not display fixture data as a live booking.');
    state.csrf = session.csrf_token;
  }
  async function searchTimes() {
    if (!state.catalog || locksChoices()) { notice('Finish or discard the current unsubmitted draft before choosing another time.'); return; }
    if (!$('search-form').reportValidity()) return;
    const service = chosenService(); const provider = chosenProvider();
    resetTimes();
    const data = await tool('find_available_times', { service_id: service.id, provider_id: provider.id, date: $('date').value, period: $('period').value });
    if (!Array.isArray(data.available_times)) throw new Error('The booking service returned unreadable times. Please check again.');
    state.times = data; state.selectedTime = null; $('times-section').hidden = false; $('times').replaceChildren();
    $('times-note').textContent = data.available_times.length ? `${friendlyDate(data.date)} · ${data.timezone}. Availability is checked again before booking.` : 'No times match this day and time of day. Try another choice.';
    for (const hour of data.available_times) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'time-choice'; button.textContent = hour; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => { state.selectedTime = hour; document.querySelectorAll('.time-choice').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button))); renderControls(); announce(`${hour} selected. Review the selected time to continue.`); }); $('times').append(button);
    }
    $('times-heading').focus(); announce(`${data.available_times.length} available times found.`);
  }
  async function checkStatus() {
    if (!state.active) { await resume(); if (!state.active) notice('There is no unfinished booking for this demo identity. Choose a time to begin.'); return; }
    acceptDraft(await tool('get_booking_status', { draft_id: state.active.draft_id }));
  }
  function readSummary() {
    if (!state.active) { notice('Choose a time first. Your booking summary will appear here.'); return; }
    const data = state.active; const s = data.summary;
    const text = `${s.service}, with ${s.provider}. ${friendlyDate(s.date)}, at ${s.time}, ${s.timezone}. ${s.duration_minutes} minutes. ${price(s)}. ${state.unconfirmed ? 'Latest status needs checking.' : statusLabels[data.state]}. ${state.unconfirmed ? 'Check the current booking before continuing.' : nextSteps[data.state]}`;
    announce(text);
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { notice('Read-aloud is unavailable in this browser. The same details are visible in your booking summary.'); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 0.92;
    utterance.onstart = () => { $('stop-speaking').hidden = false; }; utterance.onend = utterance.onerror = () => { $('stop-speaking').hidden = true; }; window.speechSynthesis.speak(utterance);
  }
  function adjacentTime(direction) {
    if (locksChoices()) { notice('Your current draft is already selected. Finish or discard the unsubmitted draft before choosing another time.'); return; }
    const hours = state.times?.available_times;
    if (!hours?.length || !state.selectedTime) { notice('Find available times and select one first. “Earlier” and “later” then move to the adjacent available time.'); return; }
    const index = hours.indexOf(state.selectedTime) + direction;
    if (index < 0 || index >= hours.length) { notice(`There is no ${direction < 0 ? 'earlier' : 'later'} available time in these results. Choose another day or time of day to search again.`); return; }
    state.selectedTime = hours[index];
    document.querySelectorAll('.time-choice').forEach(button => button.setAttribute('aria-pressed', String(button.textContent === state.selectedTime)));
    renderControls(); announce(`${state.selectedTime} selected. Review selected time to create a draft. No booking has been made.`);
  }

  $('service').addEventListener('change', renderProviders);
  $('provider').addEventListener('change', refreshChoiceDetails);
  for (const id of ['date', 'period']) $(id).addEventListener('change', () => { resetTimes(); renderControls(); });
  $('search-form').addEventListener('submit', event => { event.preventDefault(); if ($('search-form').reportValidity()) act(searchTimes); });
  $('create-draft').addEventListener('click', () => act(async () => {
    if (!state.times || !state.selectedTime || locksChoices()) return;
    acceptDraft(await tool('create_booking_draft', { service_id: state.times.service_id, provider_id: state.times.provider_id, date: state.times.date, time: state.selectedTime }));
    $('booking-heading').setAttribute('tabindex', '-1'); $('booking-heading').focus();
  }));
  $('review-link').addEventListener('click', event => { if (state.busy || !state.reviewUrl) event.preventDefault(); else { state.reviewOpened = true; announce('A separate review page opens. Return here after approving.'); } });
  $('refresh-status').addEventListener('click', () => act(checkStatus, { uncertainOnError: true }));
  $('complete-booking').addEventListener('click', () => act(async () => { if (state.active?.state !== 'approved' || state.unconfirmed) return; acceptDraft(await tool('complete_booking', { draft_id: state.active.draft_id })); }, { uncertainOnError: true }));
  $('verify-booking').addEventListener('click', () => act(async () => { if (!state.active) return; if (state.active.state === 'duplicate' && state.active.related_draft_id) acceptDraft(await tool('get_booking_status', { draft_id: state.active.related_draft_id })); else if (state.active.state === 'duplicate') await resume(); else acceptDraft(await tool('verify_booking', { draft_id: state.active.draft_id })); }, { uncertainOnError: true }));
  $('discard-draft').addEventListener('click', () => act(async () => { if (!['draft', 'approved'].includes(state.active?.state) || state.unconfirmed) return; acceptDraft(await tool('cancel_booking_draft', { draft_id: state.active.draft_id })); }, { uncertainOnError: true }));
  $('new-booking').addEventListener('click', () => { if (!closedStates.has(state.active?.state) || state.unconfirmed) return; state.active = null; state.reviewUrl = null; state.reviewOpened = false; resetTimes(); clearNotice(); renderActive(); $('service').focus(); });
  $('retry-connection').addEventListener('click', () => act(async () => { await connect(); await resume(); await loadCatalog(); }, { uncertainOnError: true }));
  $('command-form').addEventListener('submit', event => {
    event.preventDefault(); if (state.busy) return;
    const command = $('command').value.toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ').trim();
    if (['find times', 'find available times', 'show times'].includes(command)) { if ($('search-form').reportValidity()) act(searchTimes); }
    else if (['read summary', 'read my summary', 'read booking'].includes(command)) { clearNotice(); readSummary(); }
    else if (['check status', 'check booking', 'check approval'].includes(command)) act(checkStatus, { uncertainOnError: true });
    else if (command === 'resume booking') act(resume, { uncertainOnError: true });
    else if (command === 'earlier' || command === 'later') { clearNotice(); adjacentTime(command === 'earlier' ? -1 : 1); }
    else notice('Use “find times”, “earlier”, “later”, “resume booking”, “read summary”, or “check status”. Approve or send a booking with the clearly labeled review and booking controls.');
  });
  $('stop-speaking').addEventListener('click', () => { window.speechSynthesis?.cancel(); $('stop-speaking').hidden = true; });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  if (SpeechRecognition) {
    $('voice-help').textContent = 'Microphone input uses your browser’s speech service. Recognized words appear above for your review; nothing runs automatically.';
    $('listen').addEventListener('click', () => {
      if (recognition) { recognition.stop(); return; }
      recognition = new SpeechRecognition(); recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false;
      recognition.onstart = () => { $('listen').textContent = 'Stop listening'; $('voice-help').textContent = 'Listening… Say one command. You will review it before running it.'; };
      recognition.onresult = event => { $('command').value = event.results[0][0].transcript; $('command').focus(); $('voice-help').textContent = 'Check the recognized words. Choose Run when you are ready.'; };
      recognition.onerror = () => { $('voice-help').textContent = 'Voice input was unavailable or not permitted. Type a supported command instead.'; };
      recognition.onend = () => { recognition = null; $('listen').textContent = 'Use microphone'; };
      try { recognition.start(); } catch { recognition = null; $('voice-help').textContent = 'Voice input could not start. Type a supported command instead.'; }
    });
  } else { $('listen').textContent = 'Microphone unavailable'; $('voice-help').textContent = 'Voice recognition is unavailable in this browser. Type one of the six supported commands instead.'; }
  window.addEventListener('focus', () => { if (state.reviewOpened && state.active?.state === 'draft' && !state.busy) { state.reviewOpened = false; act(checkStatus, { uncertainOnError: true }); } });
  window.addEventListener('pagehide', () => { window.speechSynthesis?.cancel(); recognition?.stop(); });

  act(async () => {
    await connect();
    // Restore the server-owned draft even when the booking source is temporarily down.
    await resume();
    await loadCatalog();
  }).then(() => { if (!state.csrf) { $('source-error').hidden = false; $('connection-status').textContent = 'Simulator needs attention'; $('connection-detail').textContent = 'Start the bridge, then retry'; $('connection-indicator').className = 'connection-dot error'; } });
})();
