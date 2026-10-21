(function(root){
'use strict';
const services=[{id:'photo',name:'사진 기초 수업',price:10,duration:30},{id:'phone',name:'스마트폰 기초 수업',price:0,duration:30},{id:'garden',name:'원예 기초 수업',price:8,duration:30}];
function slots(){const a=[];for(let i=1;i<=3;i++){const d=new Date();d.setDate(d.getDate()+i);const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');for(const hour of ['14:00','15:00'])a.push({id:date+'T'+hour,label:d.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})+' '+hour});}return a;}
class Flow{
 constructor(){this.service=null;this.slot=null;this.contact={name:'',phone:'',email:''};this.revision=0;this.busy=false;this.unknown=false;this.receipt=null;this.ledger=new Map();this.key=null;this.counter=0;this.blocked=new Set();}
 change(field,value){if(this.busy||this.unknown||this.receipt)return false;if(field==='service'){this.service=value;this.slot=null;}else if(field==='slot')this.slot=value;else if(field==='contact')this.contact={...value};else throw Error('Unknown field');this.revision++;this.key=null;return true;}
 errors(c=this.contact){const e={};if(!c.name.trim())e.name='이름을 입력해 주세요.';if(!/^[+\d ()-]{7,20}$/.test(c.phone)||c.phone.replace(/\D/g,'').length<7)e.phone='전화번호를 확인해 주세요. 예: 010-1234-5678';if(c.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))e.email='이메일을 확인하거나 비워 주세요.';return e;}
 async submit(approvedRevision,scenario='success',pause=()=>new Promise(r=>setTimeout(r,1100))){
 if(this.busy||this.unknown||this.receipt)return {kind:'blocked'};
 if(approvedRevision!==this.revision)return {kind:'changed'};
 if(!this.service||!this.slot||Object.keys(this.errors()).length)return {kind:'invalid'};
 this.busy=true;this.key=this.key||'demo-'+Date.now()+'-'+(++this.counter);
 try{await pause();if(scenario==='full'||this.blocked.has(this.slot.id)){this.blocked.add(this.slot.id);this.slot=null;this.revision++;this.key=null;return {kind:'full'};}
 const receipt={id:'DEMO-'+String(this.counter).padStart(4,'0'),service:this.service.name,slot:this.slot.label,price:this.service.price,place:'체험용 배움센터 · 2층',demo:true};this.ledger.set(this.key,receipt);
 if(scenario==='lost'){this.unknown=true;return {kind:'unknown'};}
 this.receipt=this.ledger.get(this.key);return {kind:'verified',receipt:this.receipt};
 }finally{this.busy=false;}}
 async verify(pause=()=>new Promise(r=>setTimeout(r,800))){if(this.busy)return {kind:'blocked'};this.busy=true;try{await pause();const r=this.ledger.get(this.key);if(!r)return {kind:'unknown'};this.receipt=r;this.unknown=false;return {kind:'verified',receipt:r};}finally{this.busy=false;}}
}
const api={Flow,services,slots};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EasyFlow=api;
})(typeof globalThis==='undefined'?this:globalThis);
