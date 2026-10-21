"""Single-user, loopback-only simulator host. Every action crosses real MCP HTTP.

This is a guided Alexa+ simulation, not an Alexa client or a multi-user login.
No approval or source-registration endpoint is exposed to the simulator client.
"""
import asyncio
import hmac
import json
from pathlib import Path
import secrets
import time
from urllib.parse import urlsplit

import httpx2 as httpx
from starlette.responses import FileResponse, JSONResponse, RedirectResponse

ASSETS = Path(__file__).parent / 'simulator'
TOOLS = frozenset({'list_services', 'find_available_times', 'create_booking_draft',
                   'get_booking_status', 'complete_booking', 'verify_booking',
                   'resume_booking', 'cancel_booking_draft'})
PROTOCOL = '2025-11-25'
COOKIE = 'easylayer_simulator'
TTL = 8 * 60 * 60
HEADERS = {
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
}


class MCPGateway:
    """Use a fixed configured destination; browser input never supplies a URL/token."""
    def __init__(self, cfg):
        self.url = cfg.public_url + '/mcp'
        self.token = cfg.local_token
        self.limit = asyncio.Semaphore(8)

    async def call(self, name, arguments):
        headers = {'Authorization': 'Bearer ' + self.token,
                   'Accept': 'application/json, text/event-stream',
                   'MCP-Protocol-Version': PROTOCOL}
        async with self.limit, httpx.AsyncClient(
                timeout=httpx.Timeout(90, connect=3), trust_env=False,
                follow_redirects=False, headers=headers) as client:
            response = await client.post(self.url, json={
                'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
                    'protocolVersion': PROTOCOL, 'capabilities': {},
                    'clientInfo': {'name': 'EasyLayer local simulator', 'version': '0.4.0'}}})
            response.raise_for_status()
            initialized = response.json().get('result', {})
            if initialized.get('protocolVersion') != PROTOCOL:
                raise RuntimeError('MCP protocol negotiation failed')
            notification = await client.post(self.url, json={
                'jsonrpc': '2.0', 'method': 'notifications/initialized'})
            notification.raise_for_status()
            response = await client.post(self.url, json={
                'jsonrpc': '2.0', 'id': 2, 'method': 'tools/call',
                'params': {'name': name, 'arguments': arguments}})
            response.raise_for_status()
            envelope = response.json()
            if 'error' in envelope or not isinstance(envelope.get('result'), dict):
                raise RuntimeError('MCP call failed')
            return envelope['result']


def install_simulator(mcp, cfg):
    """Never enable the developer simulator against the production OAuth server."""
    if cfg.auth_mode != 'local':
        return
    gateway = MCPGateway(cfg)
    sessions = {}
    expected_host = urlsplit(cfg.public_url).netloc

    def trusted(request):
        origin = request.headers.get('origin')
        return (request.headers.get('host') == expected_host and
                (not origin or origin == cfg.public_url) and
                request.headers.get('sec-fetch-site', 'same-origin') not in {'cross-site'})

    def response(data, status=200):
        return JSONResponse(data, status_code=status, headers=HEADERS)

    def session(request):
        key = request.cookies.get(COOKIE, '')
        value = sessions.get(key)
        return value if value and value['expires'] > time.time() else None

    @mcp.custom_route('/simulator/api/session', methods=['GET'])
    async def start_session(request):
        if not trusted(request):
            return response({'error': 'Open the simulator at its configured local URL.'}, 403)
        now = time.time()
        for key in list(sessions):
            if sessions[key]['expires'] <= now:
                del sessions[key]
        value = session(request)
        key = request.cookies.get(COOKIE, '')
        if not value:
            # Bound process memory; all sessions still share the local demo owner.
            if len(sessions) >= 128:
                return response({'error': 'Too many local sessions. Restart the bridge.'}, 429)
            key = secrets.token_urlsafe(32)
            value = {'csrf': secrets.token_urlsafe(32), 'expires': now + TTL}
            sessions[key] = value
        result = response({'csrf_token': value['csrf'], 'mode': 'native_http',
                           'planner_mode': 'guided', 'single_user': True,
                           'alexa_runtime_verified': False, 'version': '0.4.0'})
        result.set_cookie(COOKIE, key, max_age=max(0, int(value['expires'] - now)),
                          httponly=True, samesite='strict', path='/simulator')
        return result

    @mcp.custom_route('/simulator/api/tool', methods=['POST'])
    async def call_tool(request):
        value = session(request)
        if (not trusted(request) or request.headers.get('origin') != cfg.public_url or
                not value or not hmac.compare_digest(
                    request.headers.get('x-easylayer-csrf', ''), value['csrf'])):
            return response({'error': 'Session expired or request rejected. Reload this page.'}, 403)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return response({'error': 'JSON required.'}, 415)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 8192:
                return response({'error': 'Request too large.'}, 413)
        try:
            data = json.loads(body)
            name, arguments = data['name'], data.get('arguments', {})
            if name not in TOOLS or not isinstance(arguments, dict):
                raise ValueError()
            if set(data) - {'name', 'arguments'}:
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            return response({'error': 'Choose an available booking action.'}, 400)
        try:
            result = await gateway.call(name, arguments)
            return response(result)
        except Exception:
            # Neither private tokens nor upstream responses should leak through errors.
            # A transport timeout is ambiguous for a write: never retry automatically.
            return response({'error': 'Connection interrupted. Check the existing booking status before trying another action.',
                             'retry_automatically': False}, 502)

    @mcp.custom_route('/simulator', methods=['GET'])
    async def redirect(request):
        if not trusted(request):
            return response({'error': 'Untrusted host.'}, 403)
        return RedirectResponse('/simulator/', headers=HEADERS)

    @mcp.custom_route('/simulator/{asset:path}', methods=['GET'])
    async def asset(request):
        if not trusted(request):
            return response({'error': 'Untrusted host.'}, 403)
        name = request.path_params['asset'] or 'index.html'
        if name not in {'index.html', 'app.js', 'styles.css'}:
            return response({'error': 'Not found.'}, 404)
        return FileResponse(ASSETS / name, headers=HEADERS)
