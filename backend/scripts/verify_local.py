"""Local gates; record executed commands, return codes and observed test counts."""
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
(ROOT/'evidence').mkdir(exist_ok=True)
checks=[]
counts={}
def run(name, command, test_kind=None):
    result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True)
    output=result.stdout+result.stderr
    checks.append({'name':name,'command':command,'passed':result.returncode==0,'returncode':result.returncode})
    (ROOT/'evidence'/('local-'+name+'.txt')).write_text(output)
    if test_kind:
        pattern=r'(?:#|ℹ) tests (\d+)' if test_kind=='javascript' else r'Ran (\d+) tests?'
        match=re.search(pattern,output)
        counts[name]=int(match.group(1)) if match else None
    print(name, 'PASS' if result.returncode==0 else 'FAIL',flush=True)
run('javascript',['npm','test'],'javascript')
run('bridge_python',[sys.executable,'-m','unittest','discover','-s','bridge','-p','test_*.py','-v'],'python')
run('lifecycle_python',[sys.executable,'-m','unittest','discover','-s','tests','-p','test_bridge_lifecycle.py','-v'],'python')
run('source_http_python',[sys.executable,'-m','unittest','discover','-s','tests','-p','test_source_http_contract.py','-v'],'python')
run('mcp-app-build',['npm','--prefix','bridge/app','run','build'])
run('planner_python',[sys.executable,'-m','unittest','discover','-s','planner','-p','test_*.py'],'python')
for name in ['connected','booking-session','basic-commands','source']:
    run('syntax-'+name,['node','--check','ui/'+name+'.js'])
run('syntax-simulator',['node','--check','bridge/simulator/app.js'])
run('syntax-live-e2e',['node','--check','tests/live-e2e.cjs'])
run('syntax-python',[sys.executable,'-m','py_compile','planner/server.py','scripts/check_source.py','scripts/start_demo.py','scripts/preflight.py','scripts/benchmark_bedrock.py','bridge/server.py','bridge/core.py','bridge/source.py','bridge/simulator_host.py','scripts/start_bridge.py','scripts/probe_mcp.py','scripts/verify_source_live.py'])
upstream=hashlib.sha256((ROOT/'upstream.zip').read_bytes()).hexdigest()
checks.append({'name':'unchanged_upstream_sha256','passed':upstream=='299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60','sha256':upstream})
checks.append({'name':'test_counts_observed','passed':all(n is not None for n in counts.values())})
report={'version':'0.4.0','executed_at':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':checks,'local_gates_passed':all(c['passed'] for c in checks),
        'evidence_scope':'Real loopback simulator host -> official MCP SDK HTTP -> Engine -> NativeSource -> source-shaped HTTP fixture; lifecycle/JWT/ownership checks; jsdom state tests; fake-client planner tests; MCP Apps bundle build. No real PHP source or browser.',
        'test_counts':counts,'total_tests':sum(n for n in counts.values() if n is not None),
        'alexa_runtime':'not_run: native Alexa is outside the hackathon simulation path',
        'oauth_account_linking':'not_run: external authorization server not configured',
        'mcp_protocol':'2025-11-25 initialize, tools/list, tools/call, resources/read exercised by actual HTTP tests',
        'mcp_apps_host_rendering':'not_run: bundle and resource protocol tested, host rendering not verified',
        'live_docker_booking':'not_run: docker/PHP/MariaDB absent in this workspace',
        'live_bedrock':'not_run: guided v0.4 simulator does not call Bedrock; older planner fake-client tests only',
        'browser_visual_and_speech':'not_run: no real browser render or speech test in this execution',
        'user_research':'not_run: intended-user hypothesis only',
        'github_workflow':'written_not_run','public_deployment':'not_performed','submission_video':'not_recorded'}
(ROOT/'evidence/release-checks.json').write_text(json.dumps(report,indent=2)+'\n')
sys.exit(0 if report['local_gates_passed'] else 1)
