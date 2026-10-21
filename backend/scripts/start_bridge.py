"""Start the local MCP server. Does not deploy, book, or call an AI model."""
import os
from pathlib import Path
import secrets
import subprocess
import sys
ROOT=Path(__file__).resolve().parent.parent
local=ROOT/'.local';local.mkdir(mode=0o700,exist_ok=True)
env=os.environ.copy()
if env.get('EASYLAYER_AUTH_MODE','local')=='local' and not env.get('EASYLAYER_LOCAL_TOKEN'):
    path=local/'mcp-token'
    if not path.exists():
        descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w') as f:f.write(secrets.token_urlsafe(48))
    env['EASYLAYER_LOCAL_TOKEN']=path.read_text().strip()
print('Starting MCP bridge. Open http://127.0.0.1:8092/simulator/ in your browser.',flush=True)
print('Local credential: .local/mcp-token (keep private). Source must be running separately.',flush=True)
try:sys.exit(subprocess.call([sys.executable,'-m','bridge.server'],cwd=ROOT,env=env))
except KeyboardInterrupt:sys.exit(130)
