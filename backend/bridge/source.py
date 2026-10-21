"""Server-side adapter for the bundled Easy!Appointments 1.6.0 source.
No browser, Alexa SDK, model, or synthetic data is used in this module.
"""
from datetime import datetime, timedelta
from html.parser import HTMLParser
import http.cookiejar
import json
import math
import re
from urllib.parse import urlencode, quote
from urllib.request import build_opener, HTTPCookieProcessor, Request

FIELDS={'first-name':'first_name','last-name':'last_name','email':'email','phone-number':'phone_number','address':'address','city':'city','zip-code':'zip_code','notes':'notes'}
class SourceError(RuntimeError): pass


def variables(html):
    match=re.search(r'const vars\s*=\s*',html)
    if not match: raise SourceError('Source data contract unavailable')
    try: value=json.JSONDecoder().raw_decode(html[match.end():])[0]
    except (ValueError,TypeError) as exc: raise SourceError('Invalid source data') from exc
    if not isinstance(value,dict): raise SourceError('Invalid source data')
    return value


class Fields(HTMLParser):
    def __init__(self): super().__init__(); self.fields=[]; self.unsupported=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs); identifier=a.get('id','')
        if identifier in {'captcha-text','altcha-widget','accept-to-terms-and-conditions','accept-to-privacy-policy'}: self.unsupported=True
        if tag not in {'input','textarea','select'}: return
        required='required' in a or 'required' in a.get('class','').split()
        if identifier.startswith('custom-field') and required: self.unsupported=True
        if identifier in FIELDS:
            try: size=int(a.get('maxlength','500'))
            except ValueError: size=500
            self.fields.append({'key':FIELDS[identifier],'required':required,'maxLength':min(max(size,1),500)})


class NativeSource:
    def __init__(self,base):
        self.base=base.rstrip('/')+'/index.php/booking'
        self.jar=http.cookiejar.CookieJar()
        self.client=build_opener(HTTPCookieProcessor(self.jar))
        self.csrf=None
    def read(self,path='',data=None):
        if data is not None:
            if not self.csrf: raise SourceError('Load source session before submitting')
            body=urlencode({**data,'csrf_token':self.csrf}).encode()
        else: body=None
        try:
            with self.client.open(Request(self.base+path,data=body),timeout=20) as r:
                if r.status!=200: raise SourceError('Source HTTP failure')
                text=r.read(4_000_000).decode()
        except Exception as exc: raise SourceError('Source unavailable or outcome unknown') from exc
        if data is None:
            try: self.csrf=variables(text).get('csrf_token')
            except SourceError: self.csrf=None
        return text
    def load(self):
        html=self.read();v=variables(html);f=Fields();f.feed(html)
        services=[]
        for s in v.get('available_services',[]):
            service={k:s.get(k) for k in ['name','currency','description']}
            service.update(id=str(s['id']),price=float(s['price']),duration=int(s['duration']))
            if service['duration']<=0 or not math.isfinite(service['price']) or service['price']<0: raise SourceError('Invalid catalog')
            services.append(service)
        providers=[{'id':str(p['id']),'first_name':p.get('first_name',''),'last_name':p.get('last_name',''),'timezone':p.get('timezone') or v.get('default_timezone') or 'UTC','services':[str(x) for x in p.get('services',[])]} for p in v.get('available_providers',[])]
        if not isinstance(v.get('available_services'),list) or not isinstance(v.get('available_providers'),list): raise SourceError('Source catalog unavailable')
        return {'services':services,'providers':providers,'inputs':f.fields,'unsupported':f.unsupported}
    def hours(self,service,provider,day):
        result=json.loads(self.read('/get_available_hours',{'service_id':service['id'],'provider_id':provider['id'],'selected_date':day,'manage_mode':'false'}))
        if not isinstance(result,list) or not all(isinstance(h,str) and re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',h) for h in result): raise SourceError('Invalid availability')
        return result
    def register(self,service,provider,day,hour,contact):
        start=datetime.fromisoformat(day+'T'+hour)
        data={'post_data[manage_mode]':'false','post_data[appointment][id_services]':service['id'],'post_data[appointment][id_users_provider]':provider['id'],'post_data[appointment][start_datetime]':start.strftime('%Y-%m-%d %H:%M:%S'),'post_data[appointment][end_datetime]':(start+timedelta(minutes=service['duration'])).strftime('%Y-%m-%d %H:%M:%S')}
        for k,v in contact.items():
            if k in FIELDS.values(): data['post_data[customer]['+k+']']=v
        result=json.loads(self.read('/register',data))
        if not result.get('appointment_id') or not result.get('appointment_hash'): raise SourceError('Outcome unknown')
        return {'id':str(result['appointment_id']),'hash':result['appointment_hash'],'start':start.strftime('%Y-%m-%d %H:%M:%S')}
    def verify(self,result,service,provider):
        a=variables(self.read('/reschedule/'+quote(result['hash'],safe=''))).get('appointment_data') or {}
        return str(a.get('id'))==result['id'] and str(a.get('id_services'))==service['id'] and str(a.get('id_users_provider'))==provider['id'] and a.get('start_datetime')==result['start']
