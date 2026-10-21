"""EasyLayer MCP bridge. MCP integration candidate; Alexa runtime not verified.
Run from repository root: python -m bridge.server
"""
from dataclasses import dataclass
import asyncio
import hmac
import html
import json
import os
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import jwt
from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations, CallToolResult, TextContent
from pydantic import AnyHttpUrl
from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from .core import Engine, Store, BookingError
from .source import NativeSource
from .simulator_host import install_simulator

SCOPE='easylayer:booking'
SERVICE_SCOPE='mcp:service'
USER_SCOPE='mcp:tools'
UI_URI='ui://easylayer/booking.html'
ROOT=Path(__file__).resolve().parent.parent

@dataclass
class Settings:
    public_url: str='http://127.0.0.1:8092'
    source_url: str='http://127.0.0.1:8080'
    database: str=str(ROOT/'.local/bridge.sqlite3')
    auth_mode: str='local'
    local_token: str=''
    issuer: str=''
    jwks_url: str=''
    bind: str='127.0.0.1'
    port: int=8092
    @classmethod
    def from_env(cls):
        return cls(public_url=os.getenv('EASYLAYER_PUBLIC_URL',cls.public_url).rstrip('/'),source_url=os.getenv('EASYLAYER_SOURCE_URL',cls.source_url).rstrip('/'),database=os.getenv('EASYLAYER_DATABASE',cls.database),auth_mode=os.getenv('EASYLAYER_AUTH_MODE','local'),local_token=os.getenv('EASYLAYER_LOCAL_TOKEN',''),issuer=os.getenv('EASYLAYER_OAUTH_ISSUER',''),jwks_url=os.getenv('EASYLAYER_OAUTH_JWKS_URL',''),bind=os.getenv('EASYLAYER_BIND','127.0.0.1'),port=int(os.getenv('EASYLAYER_PORT','8092')))
    def validate(self):
        url=urlsplit(self.public_url)
        if url.path not in {'','/'} or url.query or url.fragment or url.username or not url.hostname:raise ValueError('Public URL must be an origin, not a path or credential URL')
        if self.auth_mode=='local':
            if url.scheme!='http' or url.hostname not in {'localhost','127.0.0.1'} or self.bind not in {'localhost','127.0.0.1'}:raise ValueError('Local-token mode only supports loopback. Configure an OAuth authorization server for a deployed endpoint.')
            if len(self.local_token)<32:raise ValueError('Set EASYLAYER_LOCAL_TOKEN to a random secret of at least 32 characters')
        elif self.auth_mode=='oauth':
            if url.scheme!='https' or not self.issuer.startswith('https://') or not self.jwks_url.startswith('https://'):raise ValueError('OAuth mode requires HTTPS public origin, issuer and JWKS URL')
        else:raise ValueError('Unsupported auth mode')
        source=urlsplit(self.source_url)
        if source.scheme not in {'http','https'} or not source.hostname or source.query or source.fragment:raise ValueError('Invalid configured source origin')

class Verifier:
    def __init__(self,cfg):
        self.cfg=cfg;self.resource=cfg.public_url+'/mcp'
        self.keys=jwt.PyJWKClient(cfg.jwks_url,timeout=5) if cfg.auth_mode=='oauth' else None
    async def verify_token(self,token):
        if self.cfg.auth_mode=='local':
            if not hmac.compare_digest(token,self.cfg.local_token):return None
            return AccessToken(token=token,client_id='local-developer',subject='local-demo-person',scopes=[SCOPE,USER_SCOPE],resource=self.resource)
        try:
            key=await asyncio.to_thread(self.keys.get_signing_key_from_jwt,token)
            claims=jwt.decode(token,key.key,algorithms=['RS256'],audience=self.resource,issuer=self.cfg.issuer,options={'require':['exp','iss','aud']})
            scopes=claims.get('scope','').split()
            if SERVICE_SCOPE not in scopes and not {SCOPE,USER_SCOPE}.issubset(scopes):return None
            subject=claims.get('sub')
            if {SCOPE,USER_SCOPE}.issubset(scopes) and (not isinstance(subject,str) or not subject):return None
            client_id=claims.get('client_id') or claims.get('azp') or subject
            if not isinstance(client_id,str) or not client_id:return None
            return AccessToken(token=token,client_id=client_id,subject=subject if isinstance(subject,str) else None,scopes=scopes,expires_at=int(claims['exp']),resource=self.resource)
        except Exception:return None


def create_app(cfg,source_factory=None):
    cfg.validate()
    engine=Engine(Store(cfg.database),source_factory or (lambda:NativeSource(cfg.source_url)),cfg.public_url)
    verifier=Verifier(cfg)
    mcp=MCPServer('EasyLayer',version='0.4.0',description='Booking tools for a conversational assistant. Not an Alexa runtime.',
        instructions='Read source choices to the person. Never infer booking success from tool submission alone. A booking draft requires the separate person-review page before complete_booking may execute. Keep review URLs private. A conflict or changed condition requires a new draft and review. Never claim actual Alexa integration merely because this MCP server is reachable.',
        token_verifier=verifier,auth=AuthSettings(issuer_url=AnyHttpUrl(cfg.issuer or cfg.public_url+'/local-auth-not-an-oauth-provider'),resource_server_url=AnyHttpUrl(cfg.public_url+'/mcp'),required_scopes=[],validate_token_resource=True),log_level='WARNING')
    def owner():
        token=get_access_token()
        if not token or not token.subject or not {SCOPE,USER_SCOPE}.issubset(token.scopes):raise ToolError('User account linking with booking permission is required')
        return (cfg.issuer or 'local')+'|'+token.subject
    readonly=ToolAnnotations(readOnlyHint=True,destructiveHint=False,idempotentHint=True,openWorldHint=True)
    draft_only=ToolAnnotations(readOnlyHint=False,destructiveHint=False,idempotentHint=False,openWorldHint=False)
    write=ToolAnnotations(readOnlyHint=False,destructiveHint=True,idempotentHint=True,openWorldHint=True)
    async def invoke(fn,*args):
        try:return await asyncio.to_thread(fn,*args)
        except BookingError as exc:raise ToolError(str(exc)) from exc
        except Exception as exc:raise ToolError('Source unavailable; do not claim a booking succeeded') from exc
    @mcp.tool(annotations=readonly)
    async def list_services()->CallToolResult:
        """Read classes, prices and eligible teachers from the real booking source."""
        return result(await invoke(engine.services))
    @mcp.tool(annotations=readonly)
    async def find_available_times(service_id:str,date:str,provider_id:str|None=None,period:str='any')->CallToolResult:
        """Read actual free times. Date is YYYY-MM-DD in the returned provider timezone. Period: any, morning, afternoon, evening."""
        return result(await invoke(engine.times,service_id,date,provider_id,period))
    def result(data):
        return CallToolResult(content=[TextContent(type='text',text=json.dumps(data))],structuredContent=data)
    def display(data):
        return CallToolResult(content=[TextContent(type='text',text=json.dumps(data))],structuredContent=data,_meta={'ui':{'resourceUri':UI_URI}})

    @mcp.resource(UI_URI,name='EasyLayer booking',mime_type='text/html;profile=mcp-app',meta={'ui':{'prefersBorder':True,'csp':{'connectDomains':[],'resourceDomains':[]}}})
    def booking_view()->str:
        return (ROOT/'bridge/app/dist/booking.html').read_text()

    @mcp.tool(annotations=draft_only,meta={'ui':{'resourceUri':UI_URI}})
    async def create_booking_draft(service_id:str,provider_id:str,date:str,time:str)->CallToolResult:
        """Create a persistent draft only. Present the private review_url to the person for contact entry and approval. Never fetch or approve it yourself. No contact data belongs in this tool."""
        return display(await invoke(engine.create,owner(),service_id,provider_id,date,time))
    @mcp.tool(annotations=readonly,meta={'ui':{'resourceUri':UI_URI}})
    async def get_booking_status(draft_id:str)->CallToolResult:
        """Read only this signed-in person's draft status. verified=true is the sole success signal."""
        return display(await invoke(engine.get,draft_id,owner()))
    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False,destructiveHint=False,idempotentHint=False,openWorldHint=False),meta={'ui':{'resourceUri':UI_URI}})
    async def resume_booking()->CallToolResult:
        """Resume this person's persisted booking. Prioritize unresolved submissions. An unapproved draft gets a fresh private review link and invalidates its previous link. Does not approve or submit."""
        return display(await invoke(engine.resume,owner()))
    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False,destructiveHint=False,idempotentHint=True,openWorldHint=False),meta={'ui':{'resourceUri':UI_URI}})
    async def cancel_booking_draft(draft_id:str)->CallToolResult:
        """Discard only an unsubmitted draft and clear its contact details. This never cancels an actual source reservation. Pending, unknown and verified bookings must not be discarded."""
        return display(await invoke(engine.cancel,draft_id,owner()))
    @mcp.tool(annotations=write)
    async def complete_booking(draft_id:str)->CallToolResult:
        """After separate person review, execute once and verify the original record. Cannot approve a draft. Repeated calls never resend a pending/unknown/verified booking."""
        return display(await invoke(engine.complete,draft_id,owner()))
    @mcp.tool(annotations=ToolAnnotations(readOnlyHint=False,destructiveHint=False,idempotentHint=True,openWorldHint=True))
    async def verify_booking(draft_id:str)->CallToolResult:
        """Re-read an existing record and update its verification status. Never creates a reservation. Do not retry submission when the outcome is unknown."""
        return display(await invoke(engine.verify,draft_id,owner()))

    @mcp.custom_route('/healthz',methods=['GET'])
    async def health(request:Request):
        return JSONResponse({'ok':True,'version':'0.4.0','transport':'MCP Streamable HTTP','alexa_runtime_verified':False,'source_status':'configured_not_verified','auth_mode':cfg.auth_mode})

    @mcp.custom_route('/review/{draft_id}',methods=['GET','POST'])
    async def review(request:Request):
        headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff'}
        token=request.query_params.get('token','');draft_id=request.path_params['draft_id']
        try:
            if request.method=='POST':
                if request.headers.get('origin')!=cfg.public_url:raise BookingError('Review must be submitted from its own page')
                body=await request.body()
                if len(body)>16000:raise BookingError('Form too large')
                values=parse_qs(body.decode(),keep_blank_values=True)
                if values.get('approve')!=['yes']:raise BookingError('Explicit review checkbox is required')
                contact={k[8:]:v[0] for k,v in values.items() if k.startswith('contact_')}
                info=await asyncio.to_thread(engine.approve,draft_id,token,int(values.get('revision',['0'])[0]),contact)
                message='Approved. Return to the simulator, check approval, then complete this booking. The booking has not been made yet.'
            else:
                info=await asyncio.to_thread(engine.review,draft_id,token);message='Review the details. Contact information is sent to the booking service, not through the assistant tool.'
            esc=lambda value:html.escape(str(value),quote=True)
            summary=''.join('<dt>'+esc(k.replace('_',' '))+'</dt><dd>'+esc(v)+'</dd>' for k,v in info['summary'].items() if not k.endswith('_id'))
            form=''
            if info['state']=='draft':
                fields=''.join('<label>'+esc(f['key'].replace('_',' ').title())+(' *' if f['required'] else '')+'<input name="contact_'+esc(f['key'])+'" maxlength="'+str(f['maxLength'])+'" type="'+('email' if f['key']=='email' else 'text')+'" '+('required' if f['required'] else '')+'></label>' for f in info['inputs'])
                form='<form method="post"><input type="hidden" name="revision" value="'+str(info['revision'])+'">'+fields+'<p>Check cancellation terms on the original site before approval. This adapter does not extract them.</p><label class="check"><input name="approve" value="yes" type="checkbox" required>I reviewed this booking and authorize my assistant to complete it.</label><button>Approve these details</button></form>'
            back='<p><a href="/simulator/">Return to EasyLayer</a></p>' if cfg.auth_mode=='local' else ''
            page='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EasyLayer · Review booking</title><style>body{font:18px/1.5 system-ui;color:#173a2b;background:#f4f6ef;margin:0;padding:24px}main{max-width:650px;background:white;border:1px solid #d6e1d5;padding:32px;border-radius:20px;margin:auto}h1{font-size:30px}dl{display:grid;grid-template-columns:1fr 2fr;gap:9px;padding:18px;background:#f2f5e8}dt{color:#596d5e}dd{margin:0;overflow-wrap:anywhere}label{display:block;margin:16px 0}input{box-sizing:border-box;display:block;width:100%;padding:12px;font:inherit;border:1px solid #607b60;border-radius:8px}input[type=checkbox]{display:inline;width:auto;margin-right:10px}button{font:inherit;background:#205d40;color:white;border:0;padding:14px 22px;border-radius:10px;cursor:pointer}a{color:#205d40}:focus-visible{outline:3px solid #b37100;outline-offset:3px}</style><main><p>EasyLayer · Companion review</p><h1>Review your booking</h1><p>'+esc(message)+'</p><p>Status: <strong>'+esc(info['state'])+'</strong></p><dl>'+summary+'</dl>'+form+back+'</main></html>'
            return HTMLResponse(page,headers=headers)
        except (BookingError,ValueError,TypeError):return HTMLResponse('Review unavailable, expired or invalid. Ask your assistant for a new draft.',status_code=400,headers=headers)

    install_simulator(mcp,cfg)
    # SDK implements initialize, notifications, tools/list, tools/call and protocol versions.
    origin=urlsplit(cfg.public_url)
    allowed_hosts=[origin.netloc,'127.0.0.1:*','localhost:*'] if cfg.auth_mode=='local' else [origin.netloc]
    app=mcp.streamable_http_app(json_response=True,stateless_http=True,host=cfg.bind,max_request_body_size=65536,transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=True,allowed_hosts=allowed_hosts,allowed_origins=[cfg.public_url]))

    # Alexa currently does not consume WWW-Authenticate. Keep the 401 and
    # publish explicit resource metadata; this wrapper never grants access.
    class AlexaCompatibility:
        async def __call__(self,scope,receive,send):
            if scope['type']=='http' and scope['path'] in {'/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'}:
                if scope['method']!='GET':
                    await JSONResponse({'error':'method_not_allowed'},status_code=405)(scope,receive,send)
                    return
                meta={'resource':cfg.public_url+'/mcp','authorization_servers':[cfg.issuer] if cfg.auth_mode=='oauth' else [],'scopes_supported':[SERVICE_SCOPE,USER_SCOPE,SCOPE],'bearer_methods_supported':['header']}
                await JSONResponse(meta)(scope,receive,send)
                return
            async def compatible_send(message):
                if message['type']=='http.response.start' and message['status']==401:
                    message={**message,'headers':[(k,v) for k,v in message.get('headers',[]) if k.lower()!=b'www-authenticate']}
                await send(message)
            await app(scope,receive,compatible_send)
    return AlexaCompatibility()


def main():
    import uvicorn
    cfg=Settings.from_env();app=create_app(cfg)
    uvicorn.run(app,host=cfg.bind,port=cfg.port,access_log=False,log_level='warning')

if __name__=='__main__':main()
