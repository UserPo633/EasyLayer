/* Shared task state for text, touch and voice. Model output never submits. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  function todayIn(timezone='UTC', now=new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
  }
  function filterHours(hours, period) {
    return hours.filter(h => period==='any' || (period==='morning' && h<'12:00') || (period==='afternoon' && h>='12:00' && h<'18:00') || (period==='evening' && h>='18:00'));
  }
  class BookingSession {
    constructor(source, storage=null, clock=()=>new Date()) {
      this.source=source; this.storage=storage; this.clock=clock; this.key='easylayer.pending.v2.'+(source.simulation?'simulation':'connected');
      this.data=null; this.service=null; this.provider=null; this.date=''; this.hour=''; this.period='any';
      this.contact={}; this.choices=[]; this.visibleChoices=[]; this.phase='start'; this.revision=0;
      this.busy=false; this.result=null; this.message=''; this.storageFailed=false;
      try {
        const saved=JSON.parse(storage?.getItem(this.key)||'null');
        if(saved){ Object.assign(this,{service:saved.service,provider:saved.provider,date:saved.date,hour:saved.hour,result:saved.result||null}); this.phase='unknown'; this.message='restored'; }
      } catch { this.phase='unknown'; this.message='storage'; this.storageFailed=true; }
    }
    get locked(){ return this.busy || ['unknown','done'].includes(this.phase); }
    get timezone(){ return this.provider?.timezone || this.data?.timezone || 'UTC'; }
    today(){ return todayIn(this.timezone,this.clock()); }
    changed(){ this.revision++; this.result=null; }
    availableProviders(id=this.service?.id){ return (this.data?.providers||[]).filter(p=>p.services.map(String).includes(String(id))); }
    async run(fn){ if(this.busy)return false; this.busy=true; try{return await fn();}finally{this.busy=false;} }
    async connect(){
      if(this.locked)return;
      return this.run(async()=>{
        const data=await this.source.load();
        if(data.unsupported)throw Error('unsupported');
        if(data.services.some(s=>!Number.isFinite(s.price)||!Number.isFinite(s.duration)||s.duration<=0))throw Error('catalog');
        this.data=data; this.phase='service'; this.message=data.services.length?'welcome':'empty'; this.changed();
      });
    }
    selectService(id){
      const service=this.data?.services.find(s=>s.id===String(id));
      if(this.locked||!service)return false;
      this.service=service; this.provider=null; this.hour=''; this.date=''; this.choices=[]; this.visibleChoices=[];
      const providers=this.availableProviders();
      if(providers.length===1)this.provider=providers[0];
      this.phase=this.provider?'date':'provider'; this.changed(); this.message=''; return true;
    }
    selectProvider(id){
      const p=this.availableProviders().find(p=>String(p.id)===String(id));
      if(this.locked||!p)return false;
      this.provider=p; this.hour=''; this.date=''; this.choices=[]; this.visibleChoices=[]; this.phase='date'; this.changed(); return true;
    }
    async fetchHours(){
      this.choices=filterHours(await this.source.hours(this.service,this.provider,this.date),this.period);
      this.visibleChoices=this.choices.slice(0,2); this.phase=this.choices.length?'time':'date';
      this.message=this.choices.length?'choose-time':'no-times';
    }
    async chooseDate(date,period=this.period){
      if(this.locked||!this.service||!this.provider)return false;
      if(!validDate(date)||date<this.today())throw Error('date');
      if(!['any','morning','afternoon','evening'].includes(period))throw Error('period');
      this.date=date; this.period=period; this.hour=''; this.choices=[]; this.visibleChoices=[]; this.phase='date'; this.changed();
      return this.run(()=>this.fetchHours());
    }
    chooseHour(hour){
      if(this.locked||!this.choices.includes(hour))return false;
      this.hour=hour; this.phase=this.contactValid()?'review':'contact'; this.changed(); this.message=''; return true;
    }
    edit(kind){
      if(this.locked)return false;
      this.changed(); this.message='';
      if(kind==='service')this.phase='service';
      else if(kind==='date'){this.hour='';this.phase=this.provider?'date':'provider';}
      else if(kind==='contact'&&this.hour)this.phase='contact';
      return true;
    }
    setContact(values){
      if(this.locked)return false;
      const allowed=new Set(this.data.inputs.map(f=>f.key));
      const next=Object.fromEntries(Object.entries(values).filter(([k])=>allowed.has(k)).map(([k,v])=>[k,String(v)]));
      if(JSON.stringify(next)!==JSON.stringify(this.contact)){this.contact=next;this.changed();}
      return true;
    }
    contactValid(){
      return !!this.data && this.data.inputs.every(f=>{
        const value=(this.contact[f.key]||'').trim();
        return (!f.required||!!value) && value.length<=f.maxLength && (f.key!=='email'||!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      });
    }
    review(){
      if(this.locked||!this.hour||!this.contactValid())return false;
      this.phase='review'; this.message='review'; this.changed(); return true;
    }
    context(){
      // Deliberately omit contact fields and prior free-form utterances.
      return {phase:this.phase,today:this.today(),timezone:this.timezone,service_id:this.service?.id||null,
        provider_id:this.provider?String(this.provider.id):null,date:this.date||null,period:this.period,
        hour:this.hour||null,visible_choices:this.phase==='time'?this.visibleChoices:[],revision:this.revision};
    }
    async applyPlan(plan, expectedRevision){
      if(this.locked||expectedRevision!==this.revision)return false;
      if(plan.action==='clarify'){this.message='clarify'; return false;}
      if(plan.action==='read_summary'){this.message='summary';return true;}
      if(plan.action==='review')return this.review();
      if(plan.action!=='update')throw Error('plan');
      const allowed=new Set(['action','service_id','provider_id','date','period','time','choice_index','provider','latency_ms','model','usage']);
      if(Object.keys(plan).some(k=>!allowed.has(k)))throw Error('plan');
      const service=plan.service_id?this.data.services.find(s=>s.id===String(plan.service_id)):this.service;
      if(plan.service_id&&!service)throw Error('plan');
      const eligible=service?this.availableProviders(service.id):[];
      if(plan.provider_id&&!eligible.some(p=>String(p.id)===String(plan.provider_id)))throw Error('plan');
      if(plan.date&&(!validDate(plan.date)||plan.date<this.today()))throw Error('date');
      if(plan.period&&!['any','morning','afternoon','evening'].includes(plan.period))throw Error('period');
      if(plan.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.time))throw Error('plan');
      if(plan.choice_index!==undefined && (this.phase!=='time'||!Number.isInteger(plan.choice_index)||plan.choice_index<1||plan.choice_index>this.visibleChoices.length||plan.date||plan.period||plan.service_id||plan.provider_id||plan.time))throw Error('choice');
      const selectedByIndex=plan.choice_index===undefined?null:this.visibleChoices[plan.choice_index-1];
      const oldDate=this.date, oldPeriod=this.period;
      if(plan.service_id&&this.service?.id!==String(plan.service_id))this.selectService(plan.service_id);
      if(plan.provider_id&&String(this.provider?.id)!==String(plan.provider_id))this.selectProvider(plan.provider_id);
      if(plan.period)this.period=plan.period;
      const date=plan.date||this.date||oldDate;
      if(date&&this.provider&&(plan.date||plan.period||plan.service_id||plan.provider_id))await this.chooseDate(date,plan.period||oldPeriod);
      if(selectedByIndex)return this.chooseHour(selectedByIndex);
      if(plan.time){if(!this.choices.includes(plan.time)){this.message='time-unavailable';return false;}return this.chooseHour(plan.time);}
      return true;
    }
    persist(){
      if(!this.storage)throw Error('storage');
      this.storage.setItem(this.key,JSON.stringify({service:this.service,provider:this.provider,date:this.date,hour:this.hour,result:this.result}));
    }
    async confirm(approvedRevision){
      if(this.locked||this.phase!=='review'||approvedRevision!==this.revision||!this.contactValid()||!this.hour)return false;
      return this.run(async()=>{
        const latest=await this.source.load();
        if(latest.unsupported)throw Error('unsupported');
        const current=latest.services.find(s=>s.id===this.service.id);
        const provider=latest.providers.find(p=>String(p.id)===String(this.provider.id)&&p.services.map(String).includes(this.service.id));
        const serviceChanged=!current||['name','price','currency','duration'].some(k=>current[k]!==this.service[k]);
        const providerChanged=!provider||['timezone','first_name','last_name'].some(k=>provider[k]!==this.provider[k]);
        if(serviceChanged||providerChanged||JSON.stringify(latest.inputs)!==JSON.stringify(this.data.inputs)){
          this.data=latest;this.service=current||null;this.provider=provider||null;this.hour='';this.choices=[];this.visibleChoices=[];this.changed();
          this.phase=!current?'service':!provider?'provider':'date';this.message='changed';return false;
        }
        if(approvedRevision!==this.revision)return false;
        const hours=await this.source.hours(this.service,this.provider,this.date);
        if(!hours.includes(this.hour)){
          this.hour='';this.changed();this.choices=filterHours(hours,this.period);this.visibleChoices=this.choices.slice(0,2);
          this.phase=this.choices.length?'time':'date';this.message='conflict';return false;
        }
        // Write the tab-local pending marker before the only mutating request.
        this.persist();this.phase='unknown';this.message='unknown';
        try{
          this.result=await this.source.register(this.service,this.provider,this.date,this.hour,this.contact);
          this.persist();
          if(await this.source.verify(this.result,this.service,this.provider)){
            this.phase='done';this.message='verified';return true;
          }
        }catch{ /* Unknown after POST: never retry blindly, even after reload. */ }
        return false;
      });
    }
    async verify(){
      if(this.busy||this.phase!=='unknown'||!this.result)return false;
      return this.run(async()=>{
        if(await this.source.verify(this.result,this.service,this.provider)){this.phase='done';this.message='verified';return true;}
        this.message='unknown';return false;
      });
    }
  }
  const api={BookingSession,validDate,todayIn,filterHours};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EasyBooking=api;
})(globalThis);
