"""NativeSource + Engine over loopback HTTP; this is NOT the PHP source runtime.

The fixture uses the documented bundled controller wire shape. Fault injection is
intentional and is not evidence that Easy!Appointments itself behaves that way.
No SDK, source-adapter, urllib or engine methods are mocked.
"""
from contextlib import redirect_stdout
import importlib.util
import io
from datetime import date, timedelta
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import socket
import tempfile
import threading
import unittest
from urllib.parse import parse_qs, urlsplit, unquote

from bridge.core import BookingError, Engine, Store
from bridge.source import NativeSource, SourceError


class SourceFixture:
    """Small source-shaped HTTP server with visible request/record evidence."""
    def __init__(self):
        self.price = '10.00'
        self.hours = ['10:00', '11:00']
        self.unsupported = False
        self.bad_catalog = False
        self.bad_hours = False
        self.fail_preflight = False
        self.drop_after_commit = False
        self.reject_registration = False
        self.bad_receipt = False
        self.receipt_overrides = {}
        self.receipt_omissions = set()
        self.receipt_http_error = False
        self.session_count = 0
        self.sessions = {}
        self.requests = []
        self.records = {}
        self.register_count = 0
        self.httpd = None

    def start(self):
        fixture = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def reply(self, value, status=200, content_type='application/json', cookie=None):
                payload = value.encode() if isinstance(value, str) else json.dumps(value).encode()
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(payload)))
                if cookie:
                    self.send_header('Set-Cookie', cookie)
                self.end_headers()
                self.wfile.write(payload)

            def do_GET(self):
                fixture.requests.append({'method': 'GET', 'path': self.path})
                base = '/index.php/booking'
                if self.path == base:
                    if fixture.fail_preflight:
                        return self.reply({'error': 'temporarily unavailable'}, 503)
                    fixture.session_count += 1
                    sid = str(fixture.session_count)
                    token = 'html-token-' + sid
                    fixture.sessions[sid] = token
                    # Deliberately different values test that HTML, not cookies,
                    # supplies the POST CSRF token. Both cookies are HttpOnly.
                    values = {'csrf_token': token,
                              'available_services': [{'id': 7, 'name': 'Photography Introduction',
                                  'price': fixture.price, 'currency': 'USD', 'duration': 30,
                                  'description': 'Synthetic HTTP contract service'}],
                              'available_providers': [{'id': 3, 'first_name': 'Test',
                                  'last_name': 'Teacher', 'timezone': 'UTC', 'services': [7]}]}
                    if fixture.bad_catalog:
                        values.pop('available_services')
                    html = '<script>const vars = ' + json.dumps(values) + ';</script>'
                    html += '<input id="first-name" required maxlength="80">'
                    html += '<input id="last-name" class="required" maxlength="80">'
                    html += '<input id="email" required maxlength="120">'
                    html += '<input id="phone-number" maxlength="30">'
                    if fixture.unsupported:
                        html += '<input id="accept-to-privacy-policy" required>'
                    payload = html.encode()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', str(len(payload)))
                    self.send_header('Set-Cookie', 'fixture_session=' + sid + '; Path=/; HttpOnly')
                    self.send_header('Set-Cookie', 'csrf_cookie=cookie-decoy-' + sid + '; Path=/; HttpOnly')
                    self.end_headers()
                    return self.wfile.write(payload)
                if self.path.startswith(base + '/reschedule/'):
                    if fixture.receipt_http_error:
                        return self.reply({'error': 'receipt temporarily unavailable'}, 503)
                    receipt_hash = unquote(self.path[len(base + '/reschedule/'):])
                    record = fixture.records.get(receipt_hash)
                    if record and fixture.bad_receipt:
                        record = {**record, 'id_services': 999}
                    if record:
                        record = {**record, **fixture.receipt_overrides}
                        record = {key: value for key, value in record.items()
                                  if key not in fixture.receipt_omissions}
                    return self.reply('<script>const vars = ' + json.dumps({'appointment_data': record}) + ';</script>',
                                      content_type='text/html')
                self.reply({'error': 'not found'}, 404)

            def do_POST(self):
                data = {key: value[0] for key, value in
                        parse_qs(self.rfile.read(int(self.headers.get('Content-Length', '0'))).decode(),
                                 keep_blank_values=True).items()}
                cookie = SimpleCookie(self.headers.get('Cookie', ''))
                sid = cookie.get('fixture_session')
                expected = fixture.sessions.get(sid.value if sid else '')
                csrf_valid = bool(expected and data.get('csrf_token') == expected)
                fixture.requests.append({'method': 'POST', 'path': self.path,
                                         'data': data, 'csrf_valid': csrf_valid,
                                         'has_cookie': bool(sid)})
                if not csrf_valid:
                    return self.reply({'error': 'invalid session or CSRF'}, 403)
                if self.path.endswith('/get_available_hours'):
                    if data.get('service_id') != '7' or data.get('provider_id') != '3' or data.get('manage_mode') != 'false':
                        return self.reply({'error': 'wrong request contract'}, 400)
                    return self.reply(['24:90'] if fixture.bad_hours else fixture.hours)
                if self.path.endswith('/register'):
                    fixture.register_count += 1
                    if fixture.reject_registration:
                        return self.reply({'message': 'requested hour unavailable'})
                    prefix = 'post_data[appointment]'
                    start = data.get(prefix + '[start_datetime]', '')
                    if data.get('post_data[manage_mode]') != 'false' or start[11:16] not in fixture.hours:
                        return self.reply({'message': 'requested hour unavailable'})
                    receipt_hash = 'synthetic/receipt+' + str(fixture.register_count)
                    record = {'id': 200 + fixture.register_count,
                              'id_services': int(data[prefix + '[id_services]']),
                              'id_users_provider': int(data[prefix + '[id_users_provider]']),
                              'start_datetime': start,
                              'end_datetime': data[prefix + '[end_datetime]']}
                    fixture.records[receipt_hash] = record
                    if fixture.drop_after_commit:
                        self.close_connection = True
                        self.connection.shutdown(socket.SHUT_RDWR)
                        self.connection.close()
                        return
                    return self.reply({'appointment_id': record['id'], 'appointment_hash': receipt_hash})
                self.reply({'error': 'not found'}, 404)

        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)
        self.thread.start()
        return 'http://127.0.0.1:' + str(self.httpd.server_port)

    def close(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)


class NativeHTTPContractTests(unittest.TestCase):
    def setUp(self):
        self.fixture = SourceFixture()
        self.base = self.fixture.start()
        self.addCleanup(self.fixture.close)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Store(Path(self.temp.name) / 'drafts.sqlite3')
        self.engine = Engine(self.store, lambda: NativeSource(self.base), 'http://127.0.0.1:8092')
        self.day = (date.today() + timedelta(days=7)).isoformat()

    def approved(self):
        draft = self.engine.create('synthetic-owner', '7', '3', self.day, '10:00')
        token = parse_qs(urlsplit(draft['review_url']).query)['token'][0]
        self.engine.approve(draft['draft_id'], token, draft['revision'], {
            'first_name': 'Synthetic', 'last_name': 'Participant',
            'email': 'contract@example.invalid', 'phone_number': '0000000000'})
        return draft

    def test_real_adapter_cookie_html_csrf_form_encoding_and_readback(self):
        source = NativeSource(self.base)
        catalog = source.load()
        service, provider = catalog['services'][0], catalog['providers'][0]
        self.assertEqual((service['id'], service['price'], provider['id']), ('7', 10.0, '3'))
        self.assertEqual(source.hours(service, provider, self.day), ['10:00', '11:00'])
        result = source.register(service, provider, self.day, '10:00', {
            'first_name': '테스트 & Person', 'email': 'contract+plus@example.invalid',
            'unexpected': 'must not be sent'})
        self.assertTrue(source.verify(result, service, provider))
        posts = [r for r in self.fixture.requests if r['method'] == 'POST']
        self.assertTrue(all(r['csrf_valid'] and r['has_cookie'] for r in posts))
        data = posts[-1]['data']
        self.assertEqual(data['post_data[customer][first_name]'], '테스트 & Person')
        self.assertEqual(data['post_data[appointment][end_datetime]'], self.day + ' 10:30:00')
        self.assertNotIn('post_data[customer][unexpected]', data)
        self.assertTrue(any('%2F' in r['path'] and '%2B' in r['path'] for r in self.fixture.requests))

    def test_engine_full_http_path_verifies_and_repeats_without_post(self):
        draft = self.approved()
        result = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(result['state'], 'verified')
        repeated = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(repeated['booking_id'], result['booking_id'])
        self.assertEqual(self.fixture.register_count, 1)
        self.assertEqual(len(self.fixture.records), 1)
        self.assertNotIn('synthetic/receipt', json.dumps(result))

    def test_price_change_requires_fresh_review_without_register(self):
        draft = self.approved()
        self.fixture.price = '12.00'
        result = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(result['state'], 'changed')
        self.assertEqual(self.fixture.register_count, 0)

    def test_slot_disappearance_stops_before_register(self):
        draft = self.approved()
        self.fixture.hours = ['11:00']
        result = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(result['state'], 'conflict')
        self.assertEqual(self.fixture.register_count, 0)

    def test_response_lost_after_commit_does_not_create_second_booking(self):
        draft = self.approved()
        self.fixture.drop_after_commit = True
        first = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual((first['state'], first['booking_id']), ('unknown', None))
        restarted = Engine(Store(self.store.path), lambda: NativeSource(self.base), 'http://127.0.0.1:8092')
        self.assertEqual(restarted.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.assertEqual(restarted.verify(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.assertEqual((self.fixture.register_count, len(self.fixture.records)), (1, 1))

    def test_mismatched_receipt_never_claims_success_then_recovers_read_only(self):
        draft = self.approved()
        self.fixture.bad_receipt = True
        result = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(result['state'], 'unknown')
        self.assertIsNotNone(result['booking_id'])
        self.fixture.bad_receipt = False
        self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'verified')
        self.assertEqual(self.fixture.register_count, 1)

    def test_wrong_duration_stays_unknown_and_recovers_without_another_write(self):
        draft = self.approved()
        self.fixture.receipt_overrides = {'end_datetime': self.day + ' 10:10:00'}
        first = self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(first['state'], 'unknown')
        self.assertFalse(first['verified'])
        self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.fixture.receipt_overrides = {}
        self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'verified')
        self.assertEqual((self.fixture.register_count, len(self.fixture.records)), (1, 1))

    def test_missing_receipt_end_time_fails_closed_after_restart(self):
        draft = self.approved()
        self.fixture.receipt_omissions = {'end_datetime'}
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        restarted = Engine(Store(self.store.path), lambda: NativeSource(self.base), 'http://127.0.0.1:8092')
        self.assertEqual(restarted.verify(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.assertEqual(restarted.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.assertEqual(self.fixture.register_count, 1)

    def test_every_receipt_identity_and_time_field_is_required_and_must_match(self):
        draft = self.approved()
        self.fixture.receipt_http_error = True
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.fixture.receipt_http_error = False
        replacements = {'id': 999, 'id_services': 999, 'id_users_provider': 999,
                        'start_datetime': self.day + ' 11:00:00',
                        'end_datetime': self.day + ' 11:00:00'}
        for field, value in replacements.items():
            with self.subTest(field=field, fault='mismatch'):
                self.fixture.receipt_overrides = {field: value}
                self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
            with self.subTest(field=field, fault='missing'):
                self.fixture.receipt_overrides = {}
                self.fixture.receipt_omissions = {field}
                self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
                self.fixture.receipt_omissions = set()
        self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'verified')
        self.assertEqual(self.fixture.register_count, 1)

    def test_expected_end_time_handles_next_day_duration(self):
        source = NativeSource(self.base)
        catalog = source.load()
        service = {**catalog['services'][0], 'duration': 90}
        provider = catalog['providers'][0]
        self.fixture.hours = ['23:45']
        result = source.register(service, provider, self.day, '23:45', {'first_name': 'Synthetic'})
        next_day = (date.fromisoformat(self.day) + timedelta(days=1)).isoformat()
        record = self.fixture.records[result['hash']]
        self.assertEqual(record['end_datetime'], next_day + ' 01:15:00')
        self.assertTrue(source.verify(result, service, provider))
        self.fixture.receipt_overrides = {'end_datetime': self.day + ' 01:15:00'}
        self.assertFalse(source.verify(result, service, provider))

    def test_readback_http_error_recovers_with_receipt_without_resubmit(self):
        draft = self.approved()
        self.fixture.receipt_http_error = True
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.fixture.receipt_http_error = False
        self.assertEqual(self.engine.verify(draft['draft_id'], 'synthetic-owner')['state'], 'verified')
        self.assertEqual(self.fixture.register_count, 1)

    def test_prepost_http_failure_retains_approval_then_retries_once(self):
        draft = self.approved()
        self.fixture.fail_preflight = True
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'approved')
        self.assertEqual(self.fixture.register_count, 0)
        self.fixture.fail_preflight = False
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'verified')
        self.assertEqual(self.fixture.register_count, 1)

    def test_source_rejection_without_receipt_remains_unknown_and_is_not_retried(self):
        draft = self.approved()
        self.fixture.reject_registration = True
        self.assertEqual(self.engine.complete(draft['draft_id'], 'synthetic-owner')['state'], 'unknown')
        self.engine.complete(draft['draft_id'], 'synthetic-owner')
        self.assertEqual(self.fixture.register_count, 1)
        self.assertEqual(len(self.fixture.records), 0)

    def test_unsupported_consent_hands_off_before_creating_draft(self):
        self.fixture.unsupported = True
        with self.assertRaises(BookingError):
            self.engine.create('synthetic-owner', '7', '3', self.day, '10:00')
        self.assertEqual(self.fixture.register_count, 0)

    def test_malformed_availability_fails_closed(self):
        self.fixture.bad_hours = True
        with self.assertRaises(SourceError):
            self.engine.times('7', self.day, '3')
        self.assertEqual(self.fixture.register_count, 0)

    def test_simulator_mcp_native_adapter_full_http_chain(self):
        from http.cookiejar import CookieJar
        from urllib.parse import urlencode
        from urllib.request import Request, build_opener, HTTPCookieProcessor
        from bridge.test_http import serve

        with serve(NativeSource(self.base)) as cfg:
            client = build_opener(HTTPCookieProcessor(CookieJar()))

            def request(path, body=None, headers=None):
                with client.open(Request(cfg.public_url + path, data=body,
                                         headers=headers or {}), timeout=10) as response:
                    self.assertEqual(response.status, 200)
                    return response.read().decode()

            session = json.loads(request('/simulator/api/session'))

            def call(name, arguments=None):
                envelope = json.loads(request('/simulator/api/tool',
                    json.dumps({'name': name, 'arguments': arguments or {}}).encode(),
                    {'Origin': cfg.public_url, 'Content-Type': 'application/json',
                     'X-EasyLayer-CSRF': session['csrf_token']}))
                self.assertFalse(envelope.get('isError'), envelope)
                return envelope['structuredContent']

            self.assertEqual(call('list_services')['services'][0]['id'], '7')
            self.assertEqual(call('find_available_times', {'service_id': '7',
                'provider_id': '3', 'date': self.day})['available_times'], ['10:00', '11:00'])
            draft = call('create_booking_draft', {'service_id': '7', 'provider_id': '3',
                                                'date': self.day, 'time': '10:00'})
            url = urlsplit(draft['review_url'])
            request(url.path + '?' + url.query, urlencode({'revision': draft['revision'],
                    'approve': 'yes', 'contact_first_name': 'Synthetic',
                    'contact_last_name': 'HTTPChain', 'contact_email': 'chain@example.invalid',
                    'contact_phone_number': '0000000000'}).encode(),
                    {'Origin': cfg.public_url, 'Content-Type': 'application/x-www-form-urlencoded'})
            self.assertEqual(call('get_booking_status', {'draft_id': draft['draft_id']})['state'], 'approved')
            result = call('complete_booking', {'draft_id': draft['draft_id']})
            self.assertEqual(result['state'], 'verified')
            self.assertEqual(call('resume_booking')['draft_id'], draft['draft_id'])
            call('complete_booking', {'draft_id': draft['draft_id']})
            self.assertEqual((self.fixture.register_count, len(self.fixture.records)), (1, 1))
            self.assertNotIn('chain@example.invalid', json.dumps(result))
            self.assertNotIn('synthetic/receipt', json.dumps(result))

    def run_live_runner(self, *extra):
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'verify_source_live.py'
        spec = importlib.util.spec_from_file_location('source_live_gate', script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # Keep synthetic evidence out of release evidence. Runtime HTTP is real.
        module.ROOT = Path(self.temp.name)
        with redirect_stdout(io.StringIO()):
            code = module.main(['--source', self.base, *extra])
        reports = list((module.ROOT / 'evidence').glob('native-adapter-live-*.json'))
        return code, json.loads(reports[-1].read_text())

    def test_live_runner_defaults_to_read_only_on_http_fixture(self):
        code, report = self.run_live_runner()
        self.assertEqual(code, 0)
        self.assertEqual(report['mode'], 'read_only')
        self.assertEqual(self.fixture.register_count, 0)
        self.assertNotIn('result', report)

    def test_live_runner_explicit_fixture_booking_uses_real_adapter_once(self):
        code, report = self.run_live_runner('--book-fixture')
        self.assertEqual(code, 0)
        self.assertEqual(report['result']['state'], 'verified')
        self.assertEqual(self.fixture.register_count, 1)
        self.assertNotIn('appointment_hash', json.dumps(report))
        self.assertNotIn('@example.invalid', json.dumps(report))

    def test_missing_catalog_fails_closed(self):
        self.fixture.bad_catalog = True
        with self.assertRaises(SourceError):
            self.engine.services()


if __name__ == '__main__':
    unittest.main()
