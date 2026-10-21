"""Exercise the actual NativeSource adapter against an owned loopback instance.

Default: read catalog/availability only. --book-fixture creates ONE synthetic
booking and reads its source record back. This is an operator-run source gate,
not an Alexa, model, UI, authorization-server or browser test.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import secrets
import sys
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from bridge.core import Engine, Store
from bridge.source import NativeSource


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='http://127.0.0.1:8080',
                        help='Owned loopback Easy!Appointments instance only')
    parser.add_argument('--service', default='Photography Introduction')
    parser.add_argument('--days', type=int, default=14, help='Look ahead 1–30 days')
    parser.add_argument('--book-fixture', action='store_true',
                        help='Create one synthetic booking in the owned test source; not a dry run')
    args = parser.parse_args(argv)
    source_url = urlsplit(args.source)
    if source_url.scheme != 'http' or source_url.hostname not in {'127.0.0.1', 'localhost'} or source_url.username or source_url.password or source_url.path not in {'', '/'} or source_url.query or source_url.fragment:
        parser.error('--source must be an owned http://localhost:port or http://127.0.0.1:port origin')
    if not 1 <= args.days <= 30:
        parser.error('--days must be between 1 and 30')
    base = args.source.rstrip('/')
    evidence = ROOT / 'evidence'
    evidence.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    report = {'executed_at': datetime.now(timezone.utc).isoformat(),
              'mode': 'synthetic_booking' if args.book_fixture else 'read_only',
              'source_origin': base,
              'evidence_scope': 'Actual NativeSource HTTP adapter and booking engine against an operator-run loopback source; source runtime identity must be verified separately.',
              'not_tested': ['Alexa runtime', 'LLM orchestration', 'browser UI',
                             'human approval interaction', 'database row count', 'OAuth account linking'],
              'checks': []}
    store = Store(ROOT / '.local' / 'live-adapter-probe.sqlite3')
    engine = Engine(store, lambda: NativeSource(base), 'http://127.0.0.1:8092')
    owner = 'local-synthetic-adapter-probe'
    try:
        catalog = engine.services()
        service = next((s for s in catalog['services'] if s['name'] == args.service), None)
        if not service:
            raise RuntimeError('Requested seeded service not found; run the owned demo setup first')
        provider = next((p for p in catalog['providers'] if service['id'] in p['services']), None)
        if not provider:
            raise RuntimeError('No eligible provider found')
        report['checks'].append({'check': 'native_catalog_parsed', 'passed': True,
                                 'service_id': service['id'], 'provider_id': provider['id']})
        available = None
        today = datetime.now(ZoneInfo(provider['timezone'])).date()
        for offset in range(1, args.days + 1):
            day = (today + timedelta(days=offset)).isoformat()
            times = engine.times(service['id'], day, provider['id'])
            if times['available_times']:
                available = (day, times['available_times'][0])
                break
        if not available:
            raise RuntimeError('No available slot in configured look-ahead window')
        report['checks'].append({'check': 'native_availability_parsed', 'passed': True,
                                 'date': available[0], 'time': available[1], 'timezone': provider['timezone']})
        if args.book_fixture:
            # A dropped register response may already have committed a booking.
            # Never silently start another run while this probe has unresolved work.
            with store.transaction() as connection:
                unresolved = connection.execute(
                    "SELECT id,state FROM drafts WHERE owner=? AND state IN ('pending','unknown') LIMIT 1",
                    (owner,)).fetchone()
            if unresolved:
                raise RuntimeError('A prior probe has an unresolved outcome; reconcile its original source booking before running another booking probe')
            draft = engine.create(owner, service['id'], provider['id'], *available)
            report['draft_id'] = draft['draft_id']
            token = parse_qs(urlsplit(draft['review_url']).query)['token'][0]
            # Synthetic programmatic approval deliberately does not claim a human
            # touched the companion review page. Contacts never enter the report.
            fields = {'first_name': 'Synthetic', 'last_name': 'AdapterProbe',
                      'email': 'adapter-' + secrets.token_hex(6) + '@example.invalid',
                      'phone_number': '0000000000', 'address': 'Synthetic test address',
                      'city': 'Test City', 'zip_code': '00000',
                      'notes': 'EasyLayer owned-instance integration probe'}
            engine.approve(draft['draft_id'], token, draft['revision'], fields)
            result = engine.complete(draft['draft_id'], owner)
            report['result'] = {'state': result['state'], 'booking_id': result['booking_id'],
                                'verified': result['verified']}
            report['checks'].append({'check': 'source_record_read_back_and_matched',
                                     'passed': result['state'] == 'verified'})
            if result['state'] != 'verified':
                raise RuntimeError('Booking was not verified; preserve the probe database and reconcile the existing result; do not blindly retry')
            second = engine.complete(draft['draft_id'], owner)
            report['checks'].append({'check': 'same_draft_returns_same_verified_receipt',
                                     'passed': second['state'] == 'verified' and second['booking_id'] == result['booking_id']})
        report['passed'] = all(check['passed'] for check in report['checks'])
    except Exception as exc:
        report['passed'] = False
        report['error'] = str(exc)
    name = 'native-adapter-live-' + ('booking-' if args.book_fixture else 'read-') + stamp + '.json'
    output = evidence / name
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('Evidence: ' + str(output))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
