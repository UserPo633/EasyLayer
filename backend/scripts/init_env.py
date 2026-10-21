from pathlib import Path
import secrets
p=Path(__file__).resolve().parent.parent/'.env'
if p.exists():
 print('Existing environment preserved.')
else:
 p.write_text('DB_ROOT_PASSWORD='+secrets.token_hex(24)+'\nDB_PASSWORD='+secrets.token_hex(24)+'\n')
 p.chmod(0o600)
 print('Local credentials generated; values are not printed.')
