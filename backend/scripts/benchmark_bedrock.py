"""Explicit opt-in real Bedrock probe. Synthetic prompts only, no booking writes."""
import datetime as dt, json, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'planner'))
from server import interpret

def main():
    if '--run' not in sys.argv:
        print('No request made. Configure AWS and run: python scripts/benchmark_bedrock.py --run');return 2
    report={'executed_at':dt.datetime.now(dt.timezone.utc).isoformat(),'kind':'real Bedrock Converse; synthetic prompts; no bookings','cases':[],'passed':False}
    try:
        import boto3
        from botocore.config import Config
        model=os.environ['BEDROCK_MODEL_ID']
        client=boto3.client('bedrock-runtime',region_name=os.getenv('AWS_REGION','ap-northeast-2'),config=Config(connect_timeout=5,read_timeout=20,retries={'total_max_attempts':1}))
        cases=[('Find a photography introduction class.',{'action':'update','service_id':'1'}),('Thursday morning instead.',{'action':'update','date':'2026-10-01','period':'morning'}),('The second one.',{'action':'update','choice_index':2})]
        for text, expected in cases:
            payload={'text':text,'catalog':[{'id':'1','name':'Photography Introduction'},{'id':'2','name':'Photo Editing'}], 'providers':[{'id':'7','name':'Synthetic Teacher','services':['1','2']}], 'context':{'today':'2026-09-28','timezone':'America/Los_Angeles','phase':'time','service_id':'1','date':'2026-09-29','visible_choices':['09:00','10:00']}}
            result=interpret(payload,client,model)
            passed=all(result.get(k)==v for k,v in expected.items())
            report['cases'].append({'synthetic_request':text,'expected':expected,'result':result,'passed':passed})
        report['passed']=all(c['passed'] for c in report['cases'])
    except Exception as exc:
        # Exception messages may contain account IDs. Keep only the class.
        report['error_type']=type(exc).__name__
    (ROOT/'evidence/bedrock-live.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2));return 0 if report['passed'] else 1
if __name__=='__main__':sys.exit(main())
