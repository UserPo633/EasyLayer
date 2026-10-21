export const slots = ['10:00 AM', '11:30 AM', '2:00 PM'];
export const scenarios = {normal:'Smooth booking',lost:'Lost response',changed:'Time no longer available'};
export function initial(scenario='normal') { return {version:1,scenario,status:'choose',slot:0,approved:false,records:[],events:['Demo ready. All appointments are fictional.'],attempts:0}; }
export function transition(state,action) {
  if(action==='reset') return initial(state.scenario);
  const s=structuredClone(state); const log=x=>s.events.push(x);
  if(action==='later' && ['choose','draft','conflict'].includes(s.status)){s.slot=(s.slot+1)%slots.length;s.approved=false;if(s.status==='conflict')s.status='choose';log('Selected '+slots[s.slot]+'. Review is required.');}
  if(action==='earlier' && ['choose','draft','conflict'].includes(s.status)){s.slot=(s.slot+slots.length-1)%slots.length;s.approved=false;if(s.status==='conflict')s.status='choose';log('Selected '+slots[s.slot]+'. Review is required.');}
  if(action==='draft' && ['choose','conflict'].includes(s.status)){if(s.status==='conflict'){s.slot=(s.slot+1)%slots.length;}s.status='draft';s.approved=false;log('Draft saved locally. No booking has been made.');}
  if(action==='pause' && s.status==='draft'){s.status='paused';s.approved=false;log('Paused. The draft is ready to resume.');}
  if(action==='resume' && s.status==='paused'){s.status='draft';log('Restored the same draft and time.');}
  if(action==='approve' && s.status==='draft'){s.approved=!s.approved;log(s.approved?'You approved this exact draft.':'Approval removed.');}
  if(action==='discard' && ['choose','draft','paused','conflict'].includes(s.status))return initial(s.scenario);
  if(action==='submit'){
    if(s.status==='unknown'||s.status==='verified'){log('Duplicate attempt blocked. No additional record was created.');return s;}
    if(s.status!=='draft'||!s.approved){log('Review and explicit approval are required.');return s;}
    s.attempts++;
    if(s.scenario==='changed'&&!s.conflictHandled){s.conflictHandled=true;s.status='conflict';s.approved=false;log('Availability changed before writing. No record was created.');return s;}
    if(!s.records.length)s.records.push({id:'DEMO-1042',time:slots[s.slot],contact:'Alex Demo',service:'Pottery for beginners'});
    s.status=s.scenario==='lost'?'unknown':'verified';
    log(s.status==='unknown'?'Submission response lost. Outcome unknown; check the existing record.':'Sample record read back and matched. Booking verified in the simulator.');
  }
  if(action==='verify'&&s.status==='unknown'){
    const r=s.records[0];
    if(r&&r.time===slots[s.slot]&&r.contact==='Alex Demo'){s.status='verified';log('Existing sample record matched. Verified without another write.');}
    else log('No matching record found. Still unverified.');
  }
  return s;
}
export function describe(s){return ({choose:'Choose an available time',draft:s.approved?'Ready to submit':'Review your draft',paused:'Your progress is saved',unknown:'We need to check the result',verified:'Verified in the simulator',conflict:'That time just became unavailable'})[s.status];}
export function nextStep(s){return ({choose:'Select a time, then save your draft.',draft:s.approved?'Submit the approved sample appointment.':'Confirm the details before you approve.',paused:'Resume whenever you are ready.',unknown:'Check the existing record before doing anything else.',verified:'The sample record matches your approved details.',conflict:'Choose another time and review the new details.'})[s.status];}
