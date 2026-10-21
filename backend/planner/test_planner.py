import unittest,json
from server import interpret
class Fake:
 def __init__(self,result):self.result=result
 def converse(self,**kwargs):self.kwargs=kwargs;return {'output':{'message':{'content':[{'text':json.dumps(self.result)}]}}}
class Tests(unittest.TestCase):
 def test_valid(self):
  c=Fake({'action':'select_service','service_id':'91'});r=interpret({'text':'photos','catalog':[{'id':'91','name':'Photography'}]},c,'test-model');self.assertEqual(r['service_id'],'91');self.assertEqual(c.kwargs['modelId'],'test-model')
 def test_invented(self):
  with self.assertRaises(ValueError):interpret({'text':'photos','catalog':[{'id':'91','name':'Photography'}]},Fake({'action':'select_service','service_id':'wrong'}),'test-model')
 def test_submission_forbidden(self):
  with self.assertRaises(ValueError):interpret({'text':'book','catalog':[{'id':'91','name':'Photography'}]},Fake({'action':'submit','service_id':'91'}),'test-model')
 def test_clarify(self):
  self.assertEqual(interpret({'text':'something','catalog':[{'id':'91','name':'Photography'}]},Fake({'action':'clarify','service_id':None}),'test-model')['action'],'clarify')
if __name__=='__main__':unittest.main()
