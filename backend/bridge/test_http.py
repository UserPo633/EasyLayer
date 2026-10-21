"""Actual loopback HTTP + MCP SDK server. Source remains a synthetic fixture."""
import asyncio
from contextlib import contextmanager
import json
from pathlib import Path
import secrets
import socket
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from mcp.server.auth.provider import AccessToken
from bridge.server import Verifier,SERVICE_SCOPE
from urllib.error import HTTPError
from urllib.parse import urlsplit,urlencode
from urllib.request import Request,urlopen
import uvicorn
from bridge.server import Settings,create_app,UI_URI
from bridge.test_core import SourceFixture,DAY,CONTACT

@contextmanager
def serve(source):
    with tempfile.TemporaryDirectory() as temp:
        sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        cfg=Settings(public_url=f'http://127.0.0.1:{port}',database=str(Path(temp)/'drafts.sqlite3'),local_token=secrets.token_urlsafe(32),port=port)
        server=uvicorn.Server(uvicorn.Config(create_app(cfg,lambda:source),host='127.0.0.1',port=port,log_level='critical',access_log=False))
        thread=threading.Thread(target=server.run,kwargs={'sockets':[sock]},daemon=True);thread.start()
        deadline=time.monotonic()+5
        while not server.started and thread.is_alive() and time.monotonic()<deadline:threading.Event().wait(.01)
        if not server.started:raise RuntimeError('Test server did not start')
        try:yield cfg
        finally:server.should_exit=True;thread.join(5);sock.close()

class MCPHTTPTests(unittest.TestCase):
    def setUp(self):
        self.source=SourceFixture();self.server_context=serve(self.source);self.cfg=self.server_context.__enter__();self.rpc_id=0
    def tearDown(self):self.server_context.__exit__(None,None,None)
    def request(self,path='/mcp',body=None,headers=None,authenticated=True):
        h={'Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'}
        if authenticated:h['Authorization']='Bearer '+self.cfg.local_token
        if isinstance(body,dict):body=json.dumps(body).encode();h['Content-Type']='application/json'
        h.update(headers or {})
        try:r=urlopen(Request(self.cfg.public_url+path,data=body,headers=h),timeout=5)
        except HTTPError as exc:r=exc
        with r:return r.status,r.headers,r.read().decode()
    def rpc(self,method,params):
        self.rpc_id+=1
        status,_,text=self.request(body={'jsonrpc':'2.0','id':self.rpc_id,'method':method,'params':params})
        self.assertEqual(status,200,text)
        data=json.loads(text);self.assertNotIn('error',data,text);return data['result']
    def initialize(self):
        result=self.rpc('initialize',{'protocolVersion':'2025-11-25','capabilities':{'extensions':{'io.modelcontextprotocol/ui':{'mimeTypes':['text/html;profile=mcp-app']}}},'clientInfo':{'name':'EasyLayer-test-client','version':'0.3.0'}})
        self.assertEqual(result['protocolVersion'],'2025-11-25')
        status,_,_=self.request(body={'jsonrpc':'2.0','method':'notifications/initialized'})
        self.assertEqual(status,202)
    def call(self,name,args=None):return self.rpc('tools/call',{'name':name,'arguments':args or {}})
    def draft(self):return self.call('create_booking_draft',{'service_id':'1','provider_id':'7','date':DAY,'time':'10:00'})
    def test_unauthenticated_and_invalid_token_rejected(self):
        for h in [{},{'Authorization':'Bearer invalid'}]:
            code,headers,_=self.request(body={'jsonrpc':'2.0','id':1,'method':'tools/list'},headers=h,authenticated=False)
            self.assertEqual(code,401);self.assertIsNone(headers.get('WWW-Authenticate'))
    def test_untrusted_origin_rejected(self):
        code,_,_=self.request(body={'jsonrpc':'2.0','id':1,'method':'tools/list'},headers={'Origin':'https://untrusted.example'})
        self.assertEqual(code,403)
    def test_real_handshake_tools_and_resource(self):
        self.initialize();listing=self.rpc('tools/list',{})['tools'];names={t['name'] for t in listing}
        self.assertEqual(names,{'list_services','find_available_times','create_booking_draft','get_booking_status','complete_booking','verify_booking','resume_booking','cancel_booking_draft'})
        draft_tool=next(t for t in listing if t['name']=='create_booking_draft')
        self.assertEqual(draft_tool['_meta']['ui']['resourceUri'],UI_URI)
        resource=self.rpc('resources/read',{'uri':UI_URI})['contents'][0]
        self.assertEqual(resource['mimeType'],'text/html;profile=mcp-app')
        self.assertIn('Your booking, clearly.',resource['text'])
        self.assertEqual(resource['_meta']['ui']['csp']['connectDomains'],[])
    def test_complete_flow_and_repeat_without_repost(self):
        self.initialize();created=self.draft();d=created['structuredContent'];id=d['draft_id']
        self.assertEqual(created['_meta']['ui']['resourceUri'],UI_URI)
        self.assertTrue(self.call('complete_booking',{'draft_id':id})['isError']);self.assertEqual(self.source.posts,0)
        url=urlsplit(d['review_url']);path=url.path+'?'+url.query
        code,headers,page=self.request(path,authenticated=False)
        self.assertEqual(code,200);self.assertEqual(headers['Cache-Control'],'no-store');self.assertIn('contact_email',page)
        form=urlencode({'revision':1,'approve':'yes',**{'contact_'+k:v for k,v in CONTACT.items()}}).encode()
        self.assertEqual(self.request(path,form,{'Origin':self.cfg.public_url,'Content-Type':'application/x-www-form-urlencoded'},False)[0],200)
        result=self.call('complete_booking',{'draft_id':id})['structuredContent']
        self.assertTrue(result['verified']);self.call('complete_booking',{'draft_id':id});self.assertEqual(self.source.posts,1)
        self.assertNotIn(CONTACT['email'],json.dumps(result));self.assertNotIn('private-management-key',json.dumps(result))
    def test_review_requires_origin_capability_checkbox(self):
        self.initialize();d=self.draft()['structuredContent'];u=urlsplit(d['review_url']);path=u.path+'?'+u.query
        form=urlencode({'revision':1,'approve':'yes',**{'contact_'+k:v for k,v in CONTACT.items()}}).encode()
        for invalid in [(path,{},form),(u.path+'?token=wrong',{'Origin':self.cfg.public_url},form),(path,{'Origin':self.cfg.public_url},urlencode({'revision':1}).encode())]:
            self.assertEqual(self.request(invalid[0],invalid[2],invalid[1],False)[0],400)
        self.assertEqual(self.source.posts,0)
    def test_metadata_and_health_do_not_claim_alexa_verification(self):
        code,_,data=self.request('/.well-known/oauth-protected-resource/mcp',authenticated=False)
        self.assertEqual(code,200);self.assertEqual(json.loads(data)['resource'],self.cfg.public_url+'/mcp')
        self.assertEqual(json.loads(data)['authorization_servers'],[])
        _,_,data=self.request('/healthz',authenticated=False);self.assertFalse(json.loads(data)['alexa_runtime_verified'])
    def test_service_token_cannot_access_personal_draft(self):
        async def service_token(verifier,token):
            return AccessToken(token=token,client_id='synthetic-service',subject=None,scopes=[SERVICE_SCOPE],resource=self.cfg.public_url+'/mcp')
        with patch.object(Verifier,'verify_token',service_token):
            self.initialize()
            self.assertFalse(self.call('list_services')['isError'])
            self.assertTrue(self.draft()['isError'])
            self.assertTrue(self.call('get_booking_status',{'draft_id':'any'})['isError'])
        self.assertEqual(self.source.posts,0)
    def test_source_failure_surfaces_error(self):
        self.source.fail_load=True;self.initialize()
        self.assertTrue(self.call('list_services')['isError'])

if __name__=='__main__':unittest.main()
