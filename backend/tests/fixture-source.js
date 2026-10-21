/* Browser-only interaction fixture. Never used by connected.html. */
(function(){
  const services=[{id:'1',name:'Photography Introduction',duration:30,price:10,currency:'USD'},{id:'2',name:'Photo Editing',duration:45,price:15,currency:'USD'},{id:'3',name:'Smartphone Basics',duration:30,price:0,currency:'USD'}];
  const providers=[{id:7,first_name:'Alex',last_name:'Morgan',timezone:'America/Los_Angeles',services:['1','2','3']}];
  class FixtureSource{
    constructor(){this.simulation=true;this.taken=new Set();this.lost=false;
      document.getElementById('fixture-conflict').addEventListener('click',()=>{this.taken.add('10:00');document.getElementById('fixture-status').textContent='Simulation: 10:00 is now unavailable. Other times remain available.';});
      document.getElementById('fixture-lost').addEventListener('click',()=>{this.lost=true;document.getElementById('fixture-status').textContent='Simulation: the next booking response will be lost.';});
    }
    async load(){return JSON.parse(JSON.stringify({services,providers,inputs:[{key:'first_name',required:true,maxLength:100},{key:'last_name',required:true,maxLength:120},{key:'email',required:true,maxLength:120},{key:'phone_number',required:false,maxLength:60}],unsupported:false,timezone:'America/Los_Angeles'}));}
    async hours(){return ['09:00','10:00','11:00','14:00','15:00','18:00'].filter(h=>!this.taken.has(h));}
    async register(service,provider,date,hour){
      if(this.taken.has(hour))throw Error('Simulated unavailable');this.taken.add(hour);
      const result={id:'DEMO-'+Date.now(),hash:'simulation-only',start:date+' '+hour+':00'};
      const record={...result,service:service.id,provider:provider.id};
      sessionStorage.setItem('easylayer.simulation.record',JSON.stringify(record));
      if(this.lost){this.lost=false;throw Error('Simulated lost response');}return result;
    }
    async verify(result,service,provider){const r=JSON.parse(sessionStorage.getItem('easylayer.simulation.record')||'null');return !!r&&r.id===result.id&&r.start===result.start&&r.service===service.id&&String(r.provider)===String(provider.id);}
  }
  EasySource.Source=FixtureSource;
})();
