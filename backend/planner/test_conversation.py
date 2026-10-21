import json
import unittest
from server import interpret, normalize_input
from test_planner import Fake

class ConversationTests(unittest.TestCase):
    def setUp(self):
        self.payload={'text':'Thursday morning instead','catalog':[{'id':'1','name':'Photography'}], 'providers':[{'id':'7','name':'Teacher','services':['1']}], 'context':{'phase':'time','today':'2026-09-21','timezone':'UTC','service_id':'1','visible_choices':['09:00','10:00']}}
    def call(self, plan):
        return interpret(self.payload, Fake(plan), 'fake-test-model')
    def test_date_edit(self):
        self.assertEqual(self.call({'action':'update','date':'2026-09-24','period':'morning'})['date'],'2026-09-24')
    def test_ordinal(self):
        self.assertEqual(self.call({'action':'update','choice_index':2})['choice_index'],2)
        for value in [0,3,True,'2']:
            with self.assertRaises(ValueError):self.call({'action':'update','choice_index':value})
    def test_reject_action_injection_and_bad_data(self):
        for plan in [{'action':'submit'}, {'action':'update','service_id':'unknown'}, {'action':'update','date':'2026-02-30'}, {'action':'update','date':'2026-09-20'}, {'action':'update','time':'25:00'}, {'action':'update','provider_id':'99'}, {'action':'update','date':'2026-09-24','execute':'book'}, {'action':'update','choice_index':1,'date':'2026-09-24'}]:
            with self.assertRaises(ValueError): self.call(plan)
    def test_clarification(self):
        self.assertEqual(self.call({'action':'clarify','question':'Photography or photo editing?'})['question'],'Photography or photo editing?')
    def test_privacy_allowlist(self):
        self.payload['context']['email']='private@example.invalid'
        self.payload['contact']={'first_name':'Private'}
        self.assertNotIn('private@example.invalid',json.dumps(normalize_input(self.payload)))
    def test_malformed_input(self):
        for payload in [None, [], {'text':4,'catalog':[]}, {**self.payload,'context':{'visible_choices':['99:99']}}, {**self.payload,'catalog':[{}]}]:
            with self.assertRaises(ValueError):normalize_input(payload)
