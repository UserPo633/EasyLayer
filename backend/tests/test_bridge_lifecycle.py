"""v0.4 lifecycle regressions. SourceFixture is synthetic, never a live source."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import parse_qs, urlsplit

from bridge.core import BookingError, Engine, Store
from bridge.test_core import CONTACT, DAY, SourceFixture


def token_of(draft):
    return parse_qs(urlsplit(draft['review_url']).query)['token'][0]


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'lifecycle.sqlite3'
        self.source = SourceFixture()
        self.engine = Engine(Store(self.path), lambda: self.source, 'http://127.0.0.1:8092')

    def tearDown(self):
        self.temp.cleanup()

    def draft(self, owner='person-a', hour='10:00', approve=False):
        d = self.engine.create(owner, '1', '7', DAY, hour)
        if approve:
            self.engine.approve(d['draft_id'], token_of(d), d['revision'], CONTACT)
        return d

    def stored(self, d, owner='person-a'):
        with self.engine.store.transaction() as c:
            return self.engine.store.load(c, d['draft_id'], owner=owner)

    def test_resume_is_owner_bound_and_rotates_only_unapproved_review(self):
        d = self.draft()
        self.assertEqual(self.engine.resume('other-person')['state'], 'none')
        resumed = self.engine.resume('person-a')
        self.assertEqual(resumed['draft_id'], d['draft_id'])
        self.assertEqual(resumed['revision'], 2)
        self.assertEqual(resumed['expires_at'], d['expires_at'])
        self.assertEqual(resumed['summary'], d['summary'])
        self.assertNotEqual(token_of(resumed), token_of(d))
        with self.assertRaises(BookingError):
            self.engine.approve(d['draft_id'], token_of(d), 1, CONTACT)
        self.engine.approve(d['draft_id'], token_of(resumed), 2, CONTACT)
        approved = self.engine.resume('person-a')
        self.assertEqual(approved['state'], 'approved')
        self.assertEqual(approved['revision'], 2)
        self.assertNotIn('review_url', approved)
        self.assertNotIn(CONTACT['email'], json.dumps(approved))
        self.assertEqual(self.source.posts, 0)

    def test_read_only_get_does_not_rotate_capability(self):
        d = self.draft()
        self.engine.get(d['draft_id'], 'person-a')
        self.engine.get(d['draft_id'], 'person-a')
        self.assertEqual(self.engine.approve(d['draft_id'], token_of(d), 1, CONTACT)['state'], 'approved')

    def test_unresolved_write_is_resumed_before_newer_draft_after_restart(self):
        old = self.draft(approve=True)
        self.source.fail_post = True
        self.assertEqual(self.engine.complete(old['draft_id'], 'person-a')['state'], 'unknown')
        self.draft(hour='14:00')
        restarted = Engine(Store(self.path), lambda: self.source, 'http://127.0.0.1:8092')
        resumed = restarted.resume('person-a')
        self.assertEqual(resumed['draft_id'], old['draft_id'])
        self.assertEqual(resumed['state'], 'unknown')
        self.assertNotIn('review_url', resumed)
        self.assertEqual(self.source.posts, 1)

    def test_cancel_is_owner_bound_clears_contact_and_cannot_later_submit(self):
        d = self.draft(approve=True)
        with self.assertRaises(BookingError):
            self.engine.cancel(d['draft_id'], 'other-person')
        self.assertEqual(self.engine.cancel(d['draft_id'], 'person-a')['state'], 'cancelled')
        self.assertEqual(self.stored(d)['data']['contact'], {})
        self.assertEqual(self.engine.cancel(d['draft_id'], 'person-a')['state'], 'cancelled')
        self.assertEqual(self.engine.complete(d['draft_id'], 'person-a')['state'], 'cancelled')
        self.assertEqual(self.engine.resume('person-a')['state'], 'none')
        with self.assertRaises(BookingError):
            self.engine.approve(d['draft_id'], token_of(d), 1, CONTACT)
        self.assertEqual(self.source.posts, 0)

    def test_expiry_persists_and_scrubs_even_when_approval_is_rejected(self):
        d = self.draft(approve=True)
        with self.engine.store.transaction() as c:
            c.execute('UPDATE drafts SET expires=0 WHERE id=?', (d['draft_id'],))
        with self.assertRaises(BookingError):
            self.engine.approve(d['draft_id'], token_of(d), 1, CONTACT)
        self.assertEqual(self.stored(d)['state'], 'expired')
        self.assertEqual(self.stored(d)['data']['contact'], {})
        self.assertEqual(self.engine.complete(d['draft_id'], 'person-a')['state'], 'expired')
        self.assertEqual(self.source.posts, 0)

    def test_pending_record_has_no_contact_and_cannot_be_cancelled(self):
        d = self.draft(approve=True)
        self.source.release = threading.Event()
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(self.engine.complete, d['draft_id'], 'person-a')
            try:
                self.assertTrue(self.source.entered.wait(2))
                self.assertEqual(self.stored(d)['state'], 'pending')
                self.assertEqual(self.stored(d)['data']['contact'], {})
                with self.assertRaises(BookingError):
                    self.engine.cancel(d['draft_id'], 'person-a')
            finally:
                self.source.release.set()
            self.assertEqual(future.result(2)['state'], 'verified')

    def test_two_concurrent_drafts_for_same_slot_make_one_source_post(self):
        first = self.draft(approve=True)
        second = self.draft(approve=True)
        self.source.release = threading.Event()
        with ThreadPoolExecutor(max_workers=2) as pool:
            future = pool.submit(self.engine.complete, first['draft_id'], 'person-a')
            try:
                self.assertTrue(self.source.entered.wait(2))
                blocked = pool.submit(self.engine.complete, second['draft_id'], 'person-a').result(2)
                self.assertEqual(blocked['state'], 'duplicate')
                self.assertEqual(blocked['related_draft_id'], first['draft_id'])
                self.assertEqual(self.stored(second)['data']['contact'], {})
            finally:
                self.source.release.set()
            self.assertEqual(future.result(2)['state'], 'verified')
        self.assertEqual(self.source.posts, 1)

    def test_unknown_blocks_fresh_draft_after_restart_without_hash(self):
        original = self.draft(approve=True)
        self.source.fail_post = True
        self.engine.complete(original['draft_id'], 'person-a')
        other = self.draft(approve=True)
        restarted = Engine(Store(self.path), lambda: self.source, 'http://127.0.0.1:8092')
        result = restarted.complete(other['draft_id'], 'person-a')
        self.assertEqual(result['state'], 'duplicate')
        self.assertEqual(result['related_draft_id'], original['draft_id'])
        self.assertEqual(restarted.verify(original['draft_id'], 'person-a')['state'], 'unknown')
        self.assertEqual(self.source.posts, 1)

    def test_verified_slot_blocks_duplicate_but_other_slots_and_owners_are_independent(self):
        original = self.draft(approve=True)
        self.engine.complete(original['draft_id'], 'person-a')
        duplicate = self.draft(approve=True)
        self.assertEqual(self.engine.complete(duplicate['draft_id'], 'person-a')['state'], 'duplicate')
        later = self.draft(hour='14:00', approve=True)
        self.assertEqual(self.engine.complete(later['draft_id'], 'person-a')['state'], 'verified')
        other = self.draft(owner='person-b', approve=True)
        self.assertEqual(self.engine.complete(other['draft_id'], 'person-b')['state'], 'verified')
        self.assertEqual(self.source.posts, 3)

    def test_pre_post_failure_releases_slot_for_another_reviewed_draft(self):
        first = self.draft(approve=True)
        second = self.draft(approve=True)
        self.source.fail_load = True
        self.assertEqual(self.engine.complete(first['draft_id'], 'person-a')['state'], 'approved')
        self.assertEqual(self.stored(first)['data']['contact'], CONTACT)
        self.source.fail_load = False
        self.assertEqual(self.engine.complete(second['draft_id'], 'person-a')['state'], 'verified')
        self.assertEqual(self.engine.complete(first['draft_id'], 'person-a')['state'], 'duplicate')
        self.assertEqual(self.source.posts, 1)

    def test_source_factory_failure_is_before_post_and_can_retry(self):
        d = self.draft(approve=True)
        def unavailable_factory():
            raise ConnectionError('Synthetic setup failure')
        broken = Engine(Store(self.path), unavailable_factory, 'http://127.0.0.1:8092')
        self.assertEqual(broken.complete(d['draft_id'], 'person-a')['state'], 'approved')
        self.assertEqual(self.stored(d)['data']['contact'], CONTACT)
        self.assertEqual(self.engine.complete(d['draft_id'], 'person-a')['state'], 'verified')
        self.assertEqual(self.source.posts, 1)

    def test_upgrade_scrubs_contact_from_old_pending_record_without_reopening_it(self):
        d = self.draft(approve=True)
        with self.engine.store.transaction() as c:
            c.execute("UPDATE drafts SET state='pending' WHERE id=?", (d['draft_id'],))
        restarted = Engine(Store(self.path), lambda: self.source, 'http://127.0.0.1:8092')
        self.assertEqual(self.stored(d)['data']['contact'], {})
        self.assertEqual(restarted.complete(d['draft_id'], 'person-a')['state'], 'pending')
        self.assertEqual(self.source.posts, 0)


if __name__ == '__main__':
    unittest.main()
