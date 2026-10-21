"""Persistent booking drafts shared by MCP and a separate person-review surface."""
from contextlib import contextmanager
from datetime import date,datetime,timezone
from zoneinfo import ZoneInfo
import hashlib
import hmac
import json
import math
from pathlib import Path
import re
import secrets
import sqlite3
import time
from urllib.parse import quote

class BookingError(ValueError): pass


def digest(value): return hashlib.sha256(value.encode()).hexdigest()

def public_summary(data):
    s,p=data['service'],data['provider']
    return {'service_id':s['id'],'service':s['name'],'provider_id':p['id'],'provider':' '.join([p.get('first_name',''),p.get('last_name','')]).strip(),'date':data['date'],'time':data['hour'],'timezone':p['timezone'],'price':s['price'],'currency':s['currency'],'duration_minutes':s['duration']}


def condition(data):
    return {**public_summary(data),'inputs':data['inputs']}


def booking_target(data):
    # A person cannot bypass an unresolved write with a new draft for this slot.
    return (data['service']['id'],data['provider']['id'],data['date'],data['hour'])


class Store:
    def __init__(self,path):
        self.path=Path(path);self.path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with self.transaction() as c:
            c.execute('CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, capability TEXT NOT NULL, revision INTEGER NOT NULL, state TEXT NOT NULL, expires INTEGER NOT NULL, data TEXT NOT NULL)')
            c.execute('CREATE INDEX IF NOT EXISTS drafts_owner_state ON drafts(owner,state)')
        self.path.chmod(0o600)
    def connect(self):
        c=sqlite3.connect(self.path,timeout=20,isolation_level=None);c.row_factory=sqlite3.Row;return c
    @contextmanager
    def transaction(self):
        c=self.connect()
        try: c.execute('BEGIN IMMEDIATE');yield c;c.commit()
        except: c.rollback();raise
        finally: c.close()
    def load(self,c,draft_id,owner=None,token=None):
        row=c.execute('SELECT * FROM drafts WHERE id=?',(draft_id,)).fetchone()
        if not row or (owner is not None and not hmac.compare_digest(row['owner'],owner)) or (token is not None and not hmac.compare_digest(row['capability'],digest(token))): raise BookingError('Draft not found or not authorized')
        if owner is None and token is None: raise BookingError('Identity required')
        d=dict(row);d['data']=json.loads(d['data']);return d
    def update(self,c,d):
        c.execute('UPDATE drafts SET revision=?,state=?,data=? WHERE id=?',(d['revision'],d['state'],json.dumps(d['data']),d['id']))


class Engine:
    def __init__(self,store,source_factory,public_url):
        self.store=store;self.source_factory=source_factory;self.public_url=public_url.rstrip('/')
        self.cleanup()
    def cleanup(self):
        # Commit expiry/PII cleanup independently of a later rejected operation.
        # Also removes PII left by v0.3 terminal/pending records on upgrade.
        with self.store.transaction() as c:
            rows=c.execute('SELECT * FROM drafts').fetchall()
            for row in rows:
                d=dict(row);d['data']=json.loads(d['data']);changed=False
                if d['state'] in {'draft','approved'} and d['expires']<time.time():
                    d['state']='expired';d['revision']+=1;changed=True
                if d['state']!='approved' and d['data'].get('contact'):
                    d['data']['contact']={};changed=True
                if changed:self.store.update(c,d)
    def lookup(self,source,service_id,provider_id,day):
        catalog=source.load()
        if catalog['unsupported']: raise BookingError('Original site requires an unsupported consent, verification or field')
        service=next((s for s in catalog['services'] if s['id']==service_id),None)
        if not service: raise BookingError('Unknown service')
        if not math.isfinite(service['price']) or service['duration']<=0:raise BookingError('Invalid catalog')
        providers=[p for p in catalog['providers'] if service_id in p['services']]
        provider=next((p for p in providers if p['id']==provider_id),None) if provider_id else providers[0] if len(providers)==1 else None
        if not provider: raise BookingError('Select one of the service providers first')
        try:
            parsed=date.fromisoformat(day)
            if parsed.isoformat()!=day or parsed<datetime.now(ZoneInfo(provider['timezone'])).date():raise ValueError()
        except (ValueError,TypeError): raise BookingError('Choose a valid date in the provider timezone, today or later')
        return {'service':service,'provider':provider,'date':day,'hour':'','inputs':catalog['inputs']}
    def services(self):
        catalog=self.source_factory().load()
        if catalog['unsupported']: raise BookingError('Continue on the original site for its required consent or verification')
        return {'services':catalog['services'],'providers':catalog['providers'],'source':'Easy!Appointments 1.6.0','source_mode':'native_http'}
    def times(self,service_id,day,provider_id=None,period='any'):
        if period not in ['any','morning','afternoon','evening']:raise BookingError('Invalid period')
        source=self.source_factory();data=self.lookup(source,service_id,provider_id,day)
        hours=source.hours(data['service'],data['provider'],day)
        hours=[h for h in hours if period=='any' or period=='morning' and h<'12:00' or period=='afternoon' and '12:00'<=h<'18:00' or period=='evening' and h>='18:00']
        return {'service_id':service_id,'provider_id':data['provider']['id'],'date':day,'timezone':data['provider']['timezone'],'available_times':hours,'period':period,'as_of':datetime.now(timezone.utc).isoformat()}
    def create(self,owner,service_id,provider_id,day,hour):
        self.cleanup()
        source=self.source_factory();data=self.lookup(source,service_id,provider_id,day)
        if hour not in source.hours(data['service'],data['provider'],day):raise BookingError('Time unavailable; fetch alternatives')
        data['hour']=hour;data['contact']={};data['result']=None
        draft_id=secrets.token_urlsafe(18);token=secrets.token_urlsafe(32);expires=int(time.time())+1800
        with self.store.transaction() as c:
            c.execute('INSERT INTO drafts VALUES (?,?,?,?,?,?,?)',(draft_id,owner,digest(token),1,'draft',expires,json.dumps(data)))
        return {'draft_id':draft_id,'revision':1,'state':'draft','summary':public_summary(data),'review_url':self.public_url+'/review/'+draft_id+'?token='+quote(token),'expires_at':expires,'next_action':'Ask the person to open review_url, enter their contact details and approve. Then call complete_booking. No booking has been made.'}
    def get(self,draft_id,owner=None,token=None):
        self.cleanup()
        with self.store.transaction() as c:d=self.store.load(c,draft_id,owner,token)
        return self.output(d)
    def resume(self,owner):
        self.cleanup()
        with self.store.transaction() as c:
            # Unresolved writes cannot be hidden behind a newer unsubmitted draft.
            row=c.execute("SELECT id FROM drafts WHERE owner=? AND state IN ('pending','unknown','draft','approved','verified') ORDER BY CASE WHEN state IN ('pending','unknown') THEN 0 ELSE 1 END, rowid DESC LIMIT 1",(owner,)).fetchone()
            if not row:return {'state':'none','draft_id':None,'next_action':'Choose a service and available time to start a booking.'}
            d=self.store.load(c,row['id'],owner=owner);token=None
            if d['state']=='draft':
                token=secrets.token_urlsafe(32);d['revision']+=1
                c.execute('UPDATE drafts SET capability=?,revision=? WHERE id=?',(digest(token),d['revision'],d['id']))
            out=self.output(d)
            if token:
                out['review_url']=self.public_url+'/review/'+d['id']+'?token='+quote(token)
                out['next_action']='Open this fresh review link. Previous review links no longer work. Review and approve before completion.'
            return out
    def cancel(self,draft_id,owner):
        self.cleanup()
        with self.store.transaction() as c:
            d=self.store.load(c,draft_id,owner=owner)
            if d['state'] in {'cancelled','expired'}:return self.output(d)
            if d['state'] not in {'draft','approved'}:raise BookingError('Only an unsubmitted draft can be cancelled. Check the existing booking on the original site.')
            d['state']='cancelled';d['revision']+=1;d['data']['contact']={};self.store.update(c,d)
            return self.output(d)
    def output(self,d):
        data=d['data'];result=data.get('result');state=d['state']
        if d['expires']<time.time() and state in {'draft','approved'}:state='expired'
        return {'draft_id':d['id'],'revision':d['revision'],'state':state,'summary':public_summary(data),'booking_id':result.get('id') if result else None,'verified':state=='verified','expires_at':d['expires'],'related_draft_id':data.get('related_draft_id'),'next_action':{'draft':'Open the review link and approve the current details.','approved':'Ready for complete_booking.','pending':'Do not resubmit. Check the existing result.','unknown':'Do not resubmit. Verify the existing result or check the original site.','conflict':'Fetch new times and create a new draft for fresh review.','changed':'Source details changed. Fetch details and create a new draft for fresh review.','expired':'Create a new draft and ask for fresh review.','verified':'Read the verified result to the person.','cancelled':'This unsubmitted draft was cancelled. No existing booking was cancelled.','duplicate':'Resume the existing draft. Do not create or submit another booking for this slot.'}.get(state,'Check original site.')}
    def review(self,draft_id,token):
        self.cleanup()
        with self.store.transaction() as c:d=self.store.load(c,draft_id,token=token)
        out=self.output(d);out['inputs']=d['data']['inputs'];return out
    def approve(self,draft_id,token,revision,contact):
        self.cleanup()
        with self.store.transaction() as c:
            d=self.store.load(c,draft_id,token=token)
            if d['expires']<time.time() or d['state']!='draft' or revision!=d['revision']:raise BookingError('This review is no longer current')
            cleaned={}
            for field in d['data']['inputs']:
                value=str(contact.get(field['key'],'')).strip()
                if field['required'] and not value or len(value)>field['maxLength']:raise BookingError('Check the required contact fields')
                if field['key']=='email' and value and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value):raise BookingError('Invalid email')
                cleaned[field['key']]=value
            d['data']['contact']=cleaned;d['state']='approved';self.store.update(c,d)
        return self.output(d)
    def complete(self,draft_id,owner):
        self.cleanup()
        # Atomically claim before any network operation. Every other caller sees pending.
        with self.store.transaction() as c:
            d=self.store.load(c,draft_id,owner=owner)
            if d['state'] in {'verified','pending','unknown','conflict','changed','duplicate','cancelled','expired'}:return self.output(d)
            if d['expires']<time.time() or d['state']!='approved':raise BookingError('Human review is required before booking')
            # The same SQLite write lock covers both deduplication and claiming.
            # It is released before any source/network request.
            for row in c.execute("SELECT id,data FROM drafts WHERE owner=? AND id!=? AND state IN ('pending','unknown','verified')",(owner,draft_id)):
                if booking_target(json.loads(row['data']))==booking_target(d['data']):
                    d['state']='duplicate';d['data']['related_draft_id']=row['id'];d['data']['contact']={};self.store.update(c,d)
                    return self.output(d)
            contact=dict(d['data'].get('contact') or {})
            d['data']['contact']={};d['state']='pending';self.store.update(c,d)
        data=d['data'];post_started=False
        try:
            source=self.source_factory()
            current=self.lookup(source,data['service']['id'],data['provider']['id'],data['date']);current['hour']=data['hour']
            if condition(current)!=condition(data):
                d['state']='changed';d['revision']+=1
            elif data['hour'] not in source.hours(current['service'],current['provider'],data['date']):
                d['state']='conflict';d['revision']+=1
            else:
                post_started=True
                data['result']=source.register(data['service'],data['provider'],data['date'],data['hour'],contact)
                # Save the management result before verification, so crashes can recover.
                with self.store.transaction() as c:self.store.update(c,d)
                d['state']='verified' if source.verify(data['result'],data['service'],data['provider']) else 'unknown'
        except Exception:
            # Before-POST errors permit retry of the already-approved draft. After POST never do.
            d['state']='unknown' if post_started else 'approved'
            if not post_started:data['contact']=contact
        if d['state']=='approved' and d['expires']<time.time():d['state']='expired'
        if d['state'] in {'verified','unknown','conflict','changed','expired'}:data['contact']={}
        with self.store.transaction() as c:
            # A concurrent read-back may already have established success.
            latest=self.store.load(c,draft_id,owner=owner)
            if latest['state']=='verified':d=latest
            else:self.store.update(c,d)
        return self.output(d)
    def verify(self,draft_id,owner):
        self.cleanup()
        with self.store.transaction() as c:d=self.store.load(c,draft_id,owner=owner)
        if d['state']=='verified':return self.output(d)
        if d['state'] not in {'pending','unknown'} or not d['data'].get('result'):return self.output(d)
        data=d['data'];source=self.source_factory()
        try:
            if source.verify(data['result'],data['service'],data['provider']):
                with self.store.transaction() as c:
                    # May race another verification, but never create a second source write.
                    latest=self.store.load(c,draft_id,owner=owner)
                    if latest['state'] in {'pending','unknown'}:
                        latest['state']='verified';latest['data']['contact']={};self.store.update(c,latest)
                    d=latest
        except Exception:pass
        return self.output(d)
