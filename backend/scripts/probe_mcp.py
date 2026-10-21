"""Read-only MCP 2025-11-25 handshake, tools, UI resource, optional source catalog."""
import argparse
from datetime import datetime,timezone
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8092/mcp');parser.add_argument('--source',action='store_true',help='Also call the read-only list_services tool')
args=parser.parse_args();url=urlsplit(args.url)
if url.query or url.fragment or url.username or (url.scheme!='https' and url.hostname not in {'localhost','127.0.0.1'}):parser.error('Use an HTTPS endpoint or a loopback HTTP endpoint, without credentials or query strings')
token=os.getenv('EASYLAYER_ACCESS_TOKEN') or os.getenv('EASYLAYER_LOCAL_TOKEN')
if not token and url.hostname in {'localhost','127.0.0.1'} and (ROOT/'.local/mcp-token').exists():token=(ROOT/'.local/mcp-token').read_text().strip()
if not token:parser.error('Provide EASYLAYER_ACCESS_TOKEN privately, or run scripts/start_bridge.py locally')
sequence=0
def rpc(method,params=None,notification=False):
    global sequence
    sequence+=1;body={'jsonrpc':'2.0','method':method}
    if not notification:body['id']=sequence
    if params is not None:body['params']=params
    headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token,'MCP-Protocol-Version':'2025-11-25'}
    with urlopen(Request(args.url,data=json.dumps(body).encode(),headers=headers),timeout=30) as response:
        if notification:return None
        result=json.loads(response.read())
    if 'error' in result or result.get('result',{}).get('isError'):raise RuntimeError('MCP returned an error. Check the server and source configuration.')
    return result['result']
try:
    init=rpc('initialize',{'protocolVersion':'2025-11-25','clientInfo':{'name':'EasyLayer read-only probe','version':'0.4.0'},'capabilities':{}})
    rpc('notifications/initialized',notification=True)
    listing=rpc('tools/list',{})['tools'];resource=rpc('resources/read',{'uri':'ui://easylayer/booking.html'})['contents'][0]
    report={'executed_at':datetime.now(timezone.utc).isoformat(),'protocol_version':init['protocolVersion'],'tools':[t['name'] for t in listing],'ui_mime_type':resource['mimeType'],'source_catalog':'not_requested','alexa_runtime_verified':False,'reservation_created':False}
    if args.source:
        catalog=rpc('tools/call',{'name':'list_services','arguments':{}})['structuredContent']
        report['source_catalog']={'services':len(catalog['services']),'providers':len(catalog['providers'])}
    (ROOT/'evidence/mcp-probe.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
except Exception:
    print('Probe failed. No reservation was requested. Check server configuration and private server logs.',file=sys.stderr);sys.exit(1)
