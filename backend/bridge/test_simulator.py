"""Real browser-host HTTP -> MCP HTTP -> engine; synthetic source, no browser."""
from http.cookiejar import CookieJar
import json
from pathlib import Path
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlencode
from urllib.request import Request, build_opener, HTTPCookieProcessor

from bridge.test_core import SourceFixture, DAY, CONTACT
from bridge.test_http import serve
from bridge.server import Settings, create_app
from starlette.testclient import TestClient


class SimulatorHTTPTests(unittest.TestCase):
    def setUp(self):
        self.source = SourceFixture()
        self.context = serve(self.source)
        self.cfg = self.context.__enter__()
        self.client = build_opener(HTTPCookieProcessor(CookieJar()))
        self.csrf = None

    def tearDown(self):
        self.context.__exit__(None, None, None)

    def request(self, path, data=None, headers=None):
        values = headers or {}
        if isinstance(data, dict):
            data = json.dumps(data).encode()
            values = {'Content-Type': 'application/json', **values}
        try:
            r = self.client.open(Request(self.cfg.public_url + path, data=data, headers=values), timeout=10)
        except HTTPError as error:
            r = error
        with r:
            return r.status, r.headers, r.read().decode()

    def session(self):
        status, headers, body = self.request('/simulator/api/session')
        self.assertEqual(status, 200, body)
        self.assertIn('HttpOnly', headers.get('Set-Cookie', ''))
        self.assertIn('SameSite=strict', headers.get('Set-Cookie', ''))
        data = json.loads(body)
        self.csrf = data['csrf_token']
        self.assertFalse(data['alexa_runtime_verified'])
        self.assertTrue(data['single_user'])
        self.assertNotIn(self.cfg.local_token, body)

    def call(self, name, arguments=None):
        status, _, body = self.request('/simulator/api/tool',
            {'name': name, 'arguments': arguments or {}},
            {'Origin': self.cfg.public_url, 'X-EasyLayer-CSRF': self.csrf})
        self.assertEqual(status, 200, body)
        result = json.loads(body)
        self.assertFalse(result.get('isError'), body)
        self.assertNotIn(self.cfg.local_token, body)
        return result['structuredContent']

    def draft(self):
        return self.call('create_booking_draft', {'service_id': '1', 'provider_id': '7', 'date': DAY, 'time': '10:00'})

    def review(self, draft):
        url = urlsplit(draft['review_url'])
        data = urlencode({'revision': draft['revision'], 'approve': 'yes',
                          **{'contact_' + k: v for k, v in CONTACT.items()}}).encode()
        return self.request(url.path + '?' + url.query, data,
            {'Origin': self.cfg.public_url, 'Content-Type': 'application/x-www-form-urlencoded'})

    def test_actions_use_mcp_shared_state_and_no_duplicate_submission(self):
        self.session()
        self.assertEqual(self.call('resume_booking')['state'], 'none')
        self.assertTrue(self.call('list_services')['services'])
        draft = self.draft()
        resumed = self.call('resume_booking')
        self.assertEqual(resumed['draft_id'], draft['draft_id'])
        self.assertGreater(resumed['revision'], draft['revision'])
        self.assertEqual(self.review(draft)[0], 400)  # Old capability revoked.
        self.assertEqual(self.review(resumed)[0], 200)
        state = self.call('get_booking_status', {'draft_id': draft['draft_id']})
        self.assertEqual(state['state'], 'approved')
        receipt = self.call('complete_booking', {'draft_id': draft['draft_id']})
        self.assertTrue(receipt['verified'])
        self.call('complete_booking', {'draft_id': draft['draft_id']})
        self.assertEqual(self.source.posts, 1)
        self.assertNotIn(CONTACT['email'], json.dumps(receipt))

    def test_session_and_origin_and_csrf_all_required(self):
        payload = {'name': 'list_services', 'arguments': {}}
        self.assertEqual(self.request('/simulator/api/tool', payload)[0], 403)
        self.session()
        for headers in ({'Origin': self.cfg.public_url},
                        {'Origin': 'https://attacker.example', 'X-EasyLayer-CSRF': self.csrf},
                        {'X-EasyLayer-CSRF': self.csrf},
                        {'Origin': self.cfg.public_url, 'X-EasyLayer-CSRF': 'wrong'}):
            self.assertEqual(self.request('/simulator/api/tool', payload, headers)[0], 403)
        self.assertEqual(self.request('/simulator/api/session', headers={'Host': 'attacker.example'})[0], 403)
        self.assertEqual(self.request('/simulator/api/session', headers={'Origin': 'https://attacker.example'})[0], 403)
        self.assertEqual(self.source.posts, 0)

    def test_cannot_proxy_arbitrary_tools_or_approval(self):
        self.session()
        headers = {'Origin': self.cfg.public_url, 'X-EasyLayer-CSRF': self.csrf}
        for name in ['approve', 'register', 'resources/read', 'http_request']:
            self.assertEqual(self.request('/simulator/api/tool', {'name': name}, headers)[0], 400)
        self.assertEqual(self.request('/simulator/api/tool', {'name': 'list_services', 'url': 'http://example.invalid'}, headers)[0], 400)
        self.assertEqual(self.request('/simulator/api/tool', {'name': 'list_services', 'arguments': {'large': 'x' * 9000}}, headers)[0], 413)
        self.assertEqual(self.source.posts, 0)

    def test_discard_never_creates_source_booking(self):
        self.session()
        draft = self.draft()
        result = self.call('cancel_booking_draft', {'draft_id': draft['draft_id']})
        self.assertEqual(result['state'], 'cancelled')
        self.assertEqual(self.call('resume_booking')['state'], 'none')
        self.assertEqual(self.source.posts, 0)

    def test_assets_are_local_no_cache_and_no_private_token(self):
        for path in ['/simulator/', '/simulator/app.js', '/simulator/styles.css']:
            status, headers, body = self.request(path)
            self.assertEqual(status, 200)
            self.assertEqual(headers['Cache-Control'], 'no-store')
            self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
            self.assertNotIn(self.cfg.local_token, body)
        self.assertEqual(self.request('/simulator/requirements.txt')[0], 404)

    def test_production_oauth_mode_has_no_developer_simulator(self):
        with tempfile.TemporaryDirectory() as folder:
            cfg = Settings(public_url='https://bridge.example', auth_mode='oauth',
                           issuer='https://issuer.example', jwks_url='https://issuer.example/jwks',
                           database=str(Path(folder) / 'production.sqlite3'))
            with TestClient(create_app(cfg, lambda: self.source), base_url=cfg.public_url) as client:
                self.assertEqual(client.get('/simulator/').status_code, 404)
                self.assertEqual(client.get('/simulator/api/session').status_code, 404)
                self.assertEqual(client.post('/simulator/api/tool', json={'name': 'list_services'}).status_code, 404)


if __name__ == '__main__':
    unittest.main()
