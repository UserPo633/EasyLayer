"""Booking safety tests. Synthetic source injected in tests only."""
import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import date,timedelta
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import urlsplit,parse_qs
from bridge.core import Engine,Store,BookingError

DAY=(date.today()+timedelta(days=4)).isoformat()
CONTACT={'first_name':'Synthetic','last_name':'Tester','email':'fixture@example.invalid'}

class SourceFixture:
    def __init__(self):
        self.catalog={'services':[{'id':'1','name':'Photography introduction','price':35.0,'currency':'USD','duration':60}], 'providers':[{'id':'7','first_name':'Demo','last_name':'Teacher','timezone':'UTC','services':['1']}], 'inputs':[{'key':k,'required':True,'maxLength':100} for k in CONTACT], 'unsupported':False}
        self.slots=['10:00','14:00'];self.posts=0;self.readback=True;self.fail_post=False;self.fail_load=False
        self.entered=threading.Event();self.release=None
    def load(self):
        if self.fail_load:raise ConnectionError('Synthetic preflight failure')
        return copy.deepcopy(self.catalog)
    def hours(self,*args):return list(self.slots)
    def register(self,*args):
        self.posts+=1;self.entered.set()
        if self.release and not self.release.wait(3):raise TimeoutError()
        if self.fail_post:raise ConnectionError('Synthetic lost response')
        return {'id':'fixture-42','hash':'private-management-key','start':DAY+' 10:00:00'}
    def verify(self,*args):return self.readback

class BookingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'db.sqlite3'
        self.source=SourceFixture();self.engine=Engine(Store(self.path),lambda:self.source,'http://127.0.0.1:8092')
        self.draft=self.engine.create('person-a','1','7',DAY,'10:00');self.id=self.draft['draft_id'];self.token=parse_qs(urlsplit(self.draft['review_url']).query)['token'][0]
    def tearDown(self):self.temp.cleanup()
    def approve(self):return self.engine.approve(self.id,self.token,1,CONTACT)
    def test_unapproved_cannot_submit(self):
        with self.assertRaises(BookingError):self.engine.complete(self.id,'person-a')
        self.assertEqual(self.source.posts,0)
    def test_identity_isolation(self):
        for call in [lambda:self.engine.get(self.id,'person-b'),lambda:self.engine.complete(self.id,'person-b'),lambda:self.engine.review(self.id,'invalid')]:
            with self.assertRaises(BookingError):call()
    def test_stale_and_expired_review_rejected(self):
        with self.assertRaises(BookingError):self.engine.approve(self.id,self.token,2,CONTACT)
        with self.engine.store.transaction() as c:c.execute('UPDATE drafts SET expires=0 WHERE id=?',(self.id,))
        with self.assertRaises(BookingError):self.approve()
        self.assertEqual(self.engine.get(self.id,'person-a')['state'],'expired')
    def test_contact_validation(self):
        with self.assertRaises(BookingError):self.engine.approve(self.id,self.token,1,{})
        with self.assertRaises(BookingError):self.engine.approve(self.id,self.token,1,{**CONTACT,'email':'not-an-email'})
    def test_verified_once_and_receipt_excludes_contact(self):
        self.approve();result=self.engine.complete(self.id,'person-a')
        self.assertTrue(result['verified']);self.engine.complete(self.id,'person-a')
        self.assertEqual(self.source.posts,1)
        text=json.dumps(result)
        self.assertNotIn(CONTACT['email'],text);self.assertNotIn('private-management-key',text)
        with self.engine.store.transaction() as c:d=self.engine.store.load(c,self.id,owner='person-a')
        self.assertEqual(d['data']['contact'],{})
    def test_same_draft_survives_restart(self):
        self.approve();self.engine.complete(self.id,'person-a')
        other=Engine(Store(self.path),lambda:self.source,'http://127.0.0.1:8092')
        self.assertTrue(other.complete(self.id,'person-a')['verified']);self.assertEqual(self.source.posts,1)
    def test_unknown_lost_response_never_reposts(self):
        self.approve();self.source.fail_post=True
        self.assertEqual(self.engine.complete(self.id,'person-a')['state'],'unknown')
        other=Engine(Store(self.path),lambda:self.source,'http://127.0.0.1:8092')
        other.complete(self.id,'person-a');other.verify(self.id,'person-a')
        self.assertEqual(self.source.posts,1)
    def test_source_readback_required_for_success(self):
        self.approve();self.source.readback=False
        self.assertFalse(self.engine.complete(self.id,'person-a')['verified'])
        self.source.readback=True
        self.assertTrue(self.engine.verify(self.id,'person-a')['verified']);self.assertEqual(self.source.posts,1)
    def test_price_change_invalidates_approval(self):
        self.approve();self.source.catalog['services'][0]['price']=55
        self.assertEqual(self.engine.complete(self.id,'person-a')['state'],'changed');self.assertEqual(self.source.posts,0)
    def test_lost_slot_requires_new_review(self):
        self.approve();self.source.slots=['14:00']
        self.assertEqual(self.engine.complete(self.id,'person-a')['state'],'conflict');self.assertEqual(self.source.posts,0)
    def test_concurrent_complete_claims_once(self):
        self.approve();self.source.release=threading.Event()
        with ThreadPoolExecutor(max_workers=2) as pool:
            first=pool.submit(self.engine.complete,self.id,'person-a')
            self.assertTrue(self.source.entered.wait(2))
            second=pool.submit(self.engine.complete,self.id,'person-a')
            self.assertEqual(second.result(2)['state'],'pending')
            self.source.release.set();self.assertTrue(first.result(2)['verified'])
        self.assertEqual(self.source.posts,1)
    def test_verified_state_cannot_be_downgraded_by_race(self):
        self.approve();entered=threading.Event();release=threading.Event();count=0
        def racing_verify(*args):
            nonlocal count
            count+=1
            if count==1:
                entered.set();release.wait(3);return False
            return True
        self.source.verify=racing_verify
        with ThreadPoolExecutor(max_workers=1) as pool:
            first=pool.submit(self.engine.complete,self.id,'person-a')
            self.assertTrue(entered.wait(2))
            self.assertTrue(self.engine.verify(self.id,'person-a')['verified'])
            release.set();self.assertTrue(first.result(2)['verified'])
        self.assertEqual(self.source.posts,1)
    def test_preflight_network_failure_can_retry_without_prior_post(self):
        self.approve();self.source.fail_load=True
        self.assertEqual(self.engine.complete(self.id,'person-a')['state'],'approved');self.assertEqual(self.source.posts,0)
        self.source.fail_load=False;self.assertTrue(self.engine.complete(self.id,'person-a')['verified'])
    def test_period_filter_and_required_source_handoff(self):
        self.assertEqual(self.engine.times('1',DAY,'7','afternoon')['available_times'],['14:00'])
        self.source.catalog['unsupported']=True
        with self.assertRaises(BookingError):self.engine.services()

if __name__=='__main__':unittest.main()
