"""Check capabilities without printing credentials or claiming a live integration."""
import json, os, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
report={'checked_at':datetime.now(timezone.utc).isoformat(),'checks':{},'live_booking_verified':False,'live_bedrock_verified':False}
for name in ['docker','node','python']:
    report['checks'][name]={'available':shutil.which(name) is not None}
if shutil.which('docker'):
    for key, command in [('compose',['docker','compose','version']),('docker_daemon',['docker','info','--format','{{.ServerVersion}}'])]:
        try:
            r=subprocess.run(command,capture_output=True,text=True,timeout=15)
            report['checks'][key]={'available':r.returncode==0}
        except (OSError,subprocess.TimeoutExpired):report['checks'][key]={'available':False}
report['checks']['aws_region']={'configured':bool(os.getenv('AWS_REGION'))}
report['checks']['bedrock_model']={'configured':bool(os.getenv('BEDROCK_MODEL_ID'))}
report['checks']['aws_auth']={'environment_keys_present':bool(os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY')),'note':'Host IAM/profile credentials may also be used by host-side benchmark; no live call made.'}
report['ready_for_docker']=all(report['checks'].get(k,{}).get('available',False) for k in ['docker','compose','docker_daemon'])
(ROOT/'evidence').mkdir(exist_ok=True)
(ROOT/'evidence/preflight.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
sys.exit(0 if report['ready_for_docker'] else 1)
