"""Native HTTP integration probe. Does not test EasyLayer UI or Bedrock."""
import datetime as dt,http.cookiejar,json,re,secrets,subprocess,sys,urllib.request,urllib.parse,urllib.error
from zoneinfo import ZoneInfo
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
BASE='http://localhost:8080/index.php/'

def client():
 jar=http.cookiejar.CookieJar()
 return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)),jar

def req(c,path,data=None):
 request=urllib.request.Request(BASE+path,data=urllib.parse.urlencode(data).encode() if data is not None else None)
 try:
  with c.open(request,timeout=30) as r:return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()

def csrf(j):return next(x.value for x in j if x.name=='csrf_cookie')
def variables(html):
 m=re.search(r'const vars\s*=\s*',html)
 if not m:raise RuntimeError('Upstream vars contract changed')
 return json.JSONDecoder().raw_decode(html[m.end():])[0]
def docker_php(name):
 return subprocess.check_output(['docker','compose','exec','-T','app','php','/opt/easylayer/'+name],cwd=ROOT,text=True)

def install():
 c,j=client();status,body=req(c,'installation')
 if status!=200:raise RuntimeError(f'Installation page HTTP {status}')
 if 'id="install"' in body:
  password=secrets.token_urlsafe(24)
  d={'csrf_token':csrf(j),'admin[first_name]':'Demo','admin[last_name]':'Admin','admin[email]':'admin@example.invalid','admin[username]':'easylayer_admin','admin[password]':password,'admin[language]':'english','company[company_name]':'EasyLayer Demo','company[company_email]':'centre@example.invalid','company[company_link]':'https://example.invalid'}
  status,b=req(c,'installation/perform',d)
  if status!=200 or json.loads(b).get('success') is not True:raise RuntimeError('Native installation failed; inspect local server logs')
  p=ROOT/'.local-admin.json';p.write_text(json.dumps({'username':'easylayer_admin','password':password}));p.chmod(0o600)
 print(docker_php('seed.php').strip())

def verify():
 report={'kind':'native HTTP integration; not browser UI / agent test','executed_at':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':[]}
 try:
  c,j=client();status,html=req(c,'booking');assert status==200
  v=variables(html);services=v['available_services'];providers=v['available_providers']
  service=next(x for x in services if x['name']=='Photography Introduction')
  provider=next(p for p in providers if str(service['id']) in [str(i) for i in p['services']])
  report['checks'].append({'check':'service_price_exposed_in_original_page_data','passed':float(service['price'])==10,'currency':service['currency']})
  available=None
  for offset in range(1,15):
   day=(dt.datetime.now(ZoneInfo(provider.get('timezone','UTC'))).date()+dt.timedelta(days=offset)).isoformat()
   status,b=req(c,'booking/get_available_hours',{'csrf_token':csrf(j),'provider_id':provider['id'],'service_id':service['id'],'selected_date':day,'manage_mode':'false'})
   hours=json.loads(b)
   if isinstance(hours,list) and hours:available=(day,hours[0]);break
  if not available:raise RuntimeError('No available slot in next 14 days')
  day,hour=available;start=dt.datetime.fromisoformat(day+'T'+hour);end=start+dt.timedelta(minutes=int(service['duration']))
  data={'csrf_token':csrf(j),'post_data[manage_mode]':'false','post_data[appointment][id_services]':service['id'],'post_data[appointment][id_users_provider]':provider['id'],'post_data[appointment][start_datetime]':start.strftime('%Y-%m-%d %H:%M:%S'),'post_data[appointment][end_datetime]':end.strftime('%Y-%m-%d %H:%M:%S'),'post_data[customer][first_name]':'Synthetic','post_data[customer][last_name]':'Participant','post_data[customer][email]':'probe-'+secrets.token_hex(4)+'@example.invalid','post_data[customer][phone_number]':'0000000000'}
  status,b=req(c,'booking/register',data);first=json.loads(b)
  if not first.get('appointment_id'):raise RuntimeError('Original booking did not return appointment ID')
  report['checks'].append({'check':'native_booking_returned_id','passed':True,'appointment_id':first['appointment_id']})
  status,record_html=req(c,'booking/reschedule/'+urllib.parse.quote(first['appointment_hash'],safe=''))
  record=variables(record_html).get('appointment_data') or {}
  report['checks'].append({'check':'source_record_reloaded_and_matched','passed':status==200 and str(record.get('id'))==str(first['appointment_id']) and str(record.get('id_services'))==str(service['id']) and str(record.get('id_users_provider'))==str(provider['id']) and record.get('start_datetime')==start.strftime('%Y-%m-%d %H:%M:%S')})
  c2,j2=client();req(c2,'booking');data['csrf_token']=csrf(j2);data['post_data[customer][email]']='second-'+secrets.token_hex(4)+'@example.invalid'
  status,b=req(c2,'booking/register',data);second=json.loads(b)
  no_id=not bool(second.get('appointment_id'))
  report['checks'].append({'check':'same_slot_rejected_for_second_customer','passed':no_id,'http_status':status})
  db=json.loads(docker_php('inspect.php'))
  matching=[x for x in db['bookings'] if x['start_datetime']==start.strftime('%Y-%m-%d %H:%M:%S') and str(x['id_users_provider'])==str(provider['id'])]
  report['checks'].append({'check':'database_contains_exactly_one_matching_booking','passed':len(matching)==1 and str(matching[0]['id'])==str(first['appointment_id']),'count':len(matching)})
  report['all_passed']=all(x['passed'] for x in report['checks'])
 except Exception as e:
  report['all_passed']=False;report['error']=str(e)
 (ROOT/'evidence'/'native-check.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
 return report['all_passed']
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='install':install()
 else:sys.exit(0 if verify() else 1)
