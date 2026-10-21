// DOM event tests with a mocked MCP host, not Alexa or a real browser.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('bridge/app/src/app.js','utf8').replace("import { App } from '@modelcontextprotocol/ext-apps';",'const App=window.MockApp;');
const data={draft_id:'fixture',state:'draft',verified:false,review_url:'https://example.invalid/review/fixture?token=synthetic',summary:{service:'Photo <img src=x onerror=alert(1)>',provider:'Demo Teacher',date:'2026-10-01',time:'10:00',timezone:'UTC',duration_minutes:60,price:35,currency:'USD'},next_action:'Review first.'};
function setup(){
 const dom=new JSDOM(fs.readFileSync('bridge/app/src/booking.html','utf8'),{runScripts:'outside-only'});
 const calls=[];let next={...data,state:'approved'};
 dom.window.MockApp=class{constructor(){dom.window.client=this;}connect(){return Promise.resolve();}async callServerTool(x){calls.push(x);return {structuredContent:next};}async openLink(x){calls.push({open:x.url});return {};}};
 dom.window.eval(source);dom.window.client.ontoolresult({structuredContent:data});
 return {dom,calls,setNext:x=>next=x,el:id=>dom.window.document.getElementById(id)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('MCP view shows current facts as text and hides unapproved execution',()=>{
 const {dom,el}=setup();assert.equal(el('title').textContent,data.summary.service);assert.equal(dom.window.document.querySelectorAll('img').length,0);assert.equal(el('complete').hidden,true);assert.equal(el('review').hidden,false);dom.window.close();
});
test('MCP view refresh uses server state and only executes the approved draft',async()=>{
 const {dom,el,calls,setNext}=setup();el('refresh').click();await tick();assert.equal(el('complete').hidden,false);assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'get_booking_status',arguments:{draft_id:'fixture'}});
 setNext({...data,state:'verified',verified:true});el('complete').click();el('complete').click();await tick();assert.equal(calls.filter(x=>x.name==='complete_booking').length,1);assert.equal(el('status').textContent,'Booking verified');dom.window.close();
});
test('MCP view opens review through host and error does not show success',async()=>{
 const {dom,el,calls}=setup();el('review').click();await tick();assert.equal(calls[0].open,data.review_url);dom.window.client.ontoolresult({isError:true});assert.notEqual(el('status').textContent,'Booking verified');assert.match(el('message').textContent,/Unable/);dom.window.close();
});
test('MCP view invalidates stale approved controls after an error and clears an empty resume',async()=>{
 const {dom,el}=setup();dom.window.client.ontoolresult({structuredContent:{...data,state:'approved'}});assert.equal(el('complete').hidden,false);
 dom.window.client.ontoolresult({isError:true});assert.equal(el('complete').hidden,true);assert.equal(el('status').textContent,'Status needs refreshing');
 dom.window.client.ontoolresult({structuredContent:{state:'none',draft_id:null}});assert.equal(el('summary').children.length,0);assert.equal(el('status').textContent,'No active draft');dom.window.close();
});
