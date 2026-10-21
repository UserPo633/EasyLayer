"""Start and seed the owned local Docker demo. No AWS call is made without --ai."""
import argparse, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--ai',action='store_true');args=parser.parse_args()
def run(command):subprocess.run(command,cwd=ROOT,check=True)
try:
    run([sys.executable,'scripts/preflight.py'])
    run([sys.executable,'scripts/init_env.py'])
    command=['docker','compose']+(['--profile','ai'] if args.ai else [])+['up','-d','--build']
    run(command)
    for attempt in range(60):
        try:
            with urllib.request.urlopen('http://localhost:8080/index.php/installation',timeout=3) as response:
                if response.status==200:break
        except (OSError,urllib.error.URLError):pass
        time.sleep(2)
    else:raise RuntimeError('Source did not become ready. Inspect docker compose logs app db.')
    run([sys.executable,'scripts/check_source.py','install'])
    print('Open http://localhost:8080/easylayer-demo/connected.html')
    print('Use fictional contacts. Real source E2E: npm ci && npm run test:live')
except (subprocess.CalledProcessError,RuntimeError) as exc:
    print(str(exc));sys.exit(1)
