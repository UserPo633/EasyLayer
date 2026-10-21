import asyncio
from types import SimpleNamespace
import time
import unittest
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from bridge.server import Settings,Verifier,SCOPE,USER_SCOPE,SERVICE_SCOPE
from bridge.source import variables,Fields,SourceError

class AuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    def setUp(self):
        self.cfg=Settings(public_url='https://mcp.example.invalid',auth_mode='oauth',issuer='https://auth.example.invalid',jwks_url='https://auth.example.invalid/keys')
        self.verifier=Verifier(self.cfg)
        self.verifier.keys=SimpleNamespace(get_signing_key_from_jwt=lambda token:SimpleNamespace(key=self.key.public_key()))
        self.claims={'iss':self.cfg.issuer,'aud':self.cfg.public_url+'/mcp','sub':'synthetic-person','client_id':'test','exp':int(time.time())+60,'scope':USER_SCOPE+' '+SCOPE}
    def verify(self,claims):return asyncio.run(self.verifier.verify_token(jwt.encode(claims,self.key,algorithm='RS256')))
    def test_jwt_signature_audience_expiry_and_scope(self):
        self.assertIsNotNone(self.verify(self.claims))
        for extra in [{'aud':'other-resource'},{'exp':0},{'scope':'unrelated'},{'iss':'https://wrong.example'},{'sub':''}]:self.assertIsNone(self.verify({**self.claims,**extra}))
        bad=jwt.encode(self.claims,'synthetic-wrong-secret-for-negative-test',algorithm='HS256')
        self.assertIsNone(asyncio.run(self.verifier.verify_token(bad)))
    def test_service_token_is_distinct_from_user(self):
        claims={**self.claims,'scope':SERVICE_SCOPE};claims.pop('sub')
        token=self.verify(claims);self.assertIsNotNone(token);self.assertIsNone(token.subject);self.assertNotIn(SCOPE,token.scopes)
    def test_local_mode_cannot_bind_publicly(self):
        with self.assertRaises(ValueError):Settings(local_token='a'*32,bind='0.0.0.0').validate()
        with self.assertRaises(ValueError):Settings(local_token='a'*32,public_url='https://public.example').validate()

class SourceContractTests(unittest.TestCase):
    def test_csrf_comes_from_html_not_readable_cookie(self):
        self.assertEqual(variables('<script>const vars = {"csrf_token":"test-fixture"};</script>')['csrf_token'],'test-fixture')
        with self.assertRaises(SourceError):variables('<html>No upstream contract</html>')
    def test_required_fields_and_unsupported_consent(self):
        f=Fields();f.feed('<input id="first-name" class="required" maxlength="80"><input id="email" required><input id="custom-field-1" required>')
        self.assertTrue(f.unsupported);self.assertEqual(f.fields[0],{'key':'first_name','required':True,'maxLength':80})
        f=Fields();f.feed('<input id="accept-to-privacy-policy">');self.assertTrue(f.unsupported)

if __name__=='__main__':unittest.main()
