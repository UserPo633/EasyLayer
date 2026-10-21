const test=require('node:test'),assert=require('node:assert/strict');const {variables,Source}=require('./source.js');
test('parses nested JSON with escaped quotes without executing following code',()=>{const v={available_services:[{id:19,name:'quote " } ;'}],available_providers:[]};assert.deepEqual(variables('const vars = '+JSON.stringify(v)+'; throw Error("never run")'),v);});
test('changed source contract fails closed',()=>{assert.throws(()=>variables('const other = {};'));assert.throws(()=>variables('const vars = {"a":'));});
test('HTTP requests use original IDs, session token and latest availability',async()=>{const calls=[];const s=new Source('/index.php/booking',async(u,o)=>{calls.push([u,o]);return {ok:true,text:async()=>JSON.stringify(['09:30'])};},()=> 'csrf_cookie=abc');assert.deepEqual(await s.hours({id:'99'},{id:7},'2026-10-01'),['09:30']);const [u,o]=calls[0];assert.equal(u,'/index.php/booking/get_available_hours');assert.equal(o.body.get('service_id'),'99');assert.equal(o.body.get('csrf_token'),'abc');assert.equal(o.credentials,'same-origin');});
test('missing CSRF prevents request',async()=>{let called=false;const s=new Source('',async()=>{called=true},()=> '');await assert.rejects(s.hours({id:1},{id:2},'2026-10-01'));assert.equal(called,false);});
test('registration uses source duration and excludes unknown customer fields',async()=>{let form;const s=new Source('',async(u,o)=>{form=o.body;return {ok:true,text:async()=>JSON.stringify({appointment_id:91,appointment_hash:'private-test-token'})}},()=> 'csrf_cookie=test');await s.register({id:'9',duration:60},{id:7},'2026-10-01','23:30',{first_name:'Test',email:'test@example.invalid',admin:true});assert.equal(form.get('post_data[appointment][end_datetime]'),'2026-10-02 00:30:00');assert.equal(form.get('post_data[customer][admin]'),null);});
test('server acknowledgment alone is not verification',async()=>{const s=new Source('',async()=>({ok:true,text:async()=> 'const vars = '+JSON.stringify({appointment_data:{id:1,id_services:9,id_users_provider:7,start_datetime:'wrong'}})+';'}));assert.equal(await s.verify({id:'1',hash:'private',start:'2026-10-01 09:30:00'},{id:'9'},{id:7}),false);});

test('uses the page CSRF token when the source cookie is HttpOnly', async()=>{
 const requests=[];
 const source=new Source('/booking',async(url,opts)=>{requests.push({url,opts});return {ok:true,text:async()=>opts.method==='GET'?'const vars = {"csrf_token":"page-token"};':'["09:00"]'};},()=> '');
 await source.read();await source.hours({id:'1'},{id:'2'},'2026-09-22');
 assert.equal(requests[1].opts.body.get('csrf_token'),'page-token');
});
