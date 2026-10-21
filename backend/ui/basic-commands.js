/* Explicit, limited, offline commands; never represented as AI. */
(function(root){
  'use strict';
  function parse(text,context,catalog){
    let s=text.trim().toLowerCase().replace(/[.!?。！？]+$/,'');
    if(/^(read (it|that|summary)( again)?|repeat|다시 읽어줘|다시 읽어 주세요|선택 내용 읽어줘)$/.test(s))return {action:'read_summary'};
    if(/^(review( booking)?|확인|예약 내용 확인)$/.test(s))return {action:'review'};
    const ordinal=/^(?:the )?(first|second|third|1|2|3)(?: one| option| time)?(?: please)?$/.exec(s)||/^(첫 번째|첫번째|두 번째|두번째|세 번째|세번째|1번|2번|3번)(?:로|로 해줘|로 할게)?$/.exec(s);
    if(ordinal){const i={'first':1,'second':2,'third':3,'첫 번째':1,'첫번째':1,'두 번째':2,'두번째':2,'세 번째':3,'세번째':3,'1번':1,'2번':2,'3번':3}[ordinal[1]]||Number(ordinal[1]);return {action:'update',choice_index:i};}
    // Exact source label is also a useful deterministic service command.
    const service=catalog.find(x=>x.name.toLowerCase()===s);
    if(service)return {action:'update',service_id:service.id};
    const time=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
    if(time)return {action:'update',time:s};
    let period;
    if(/\b(morning|afternoon|evening|any time)\b|오전|오후|저녁|아무 시간/.test(s)){
      period=/morning|오전/.test(s)?'morning':/afternoon|오후/.test(s)?'afternoon':/evening|저녁/.test(s)?'evening':'any';
    }
    const names=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const korean=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
    const weekdays=names.map((n,i)=>new RegExp('\\b'+n+'\\b').test(s)||s.includes(korean[i])?i:-1).filter(i=>i>=0);
    const dates=s.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[];
    // Refuse compound, negated, or unsupported requests instead of partially applying them.
    if(/\b(not|except|before|after|or|cancel)\b|말고|제외|취소|이전|이후/.test(s)||weekdays.length>1||dates.length>1)return null;
    let remainder=s;
    for(const n of [...names,...korean])remainder=remainder.replaceAll(n,' ');
    remainder=remainder.replace(/\d{4}-\d{2}-\d{2}|\b(next week|this week|next|this|today|tomorrow|morning|afternoon|evening|any time|change|move|to|on|in|the|instead|please)\b|다음 주|이번 주|내일|오늘|오전|오후|저녁|아무 시간|으로|로|바꿔줘|해줘|할게|주세요/g,' ').trim();
    if(remainder)return null;
    let date=dates[0];
    const base=new Date(context.today+'T00:00:00Z');
    if(!date&&weekdays.length){
      const target=weekdays[0];
      if(/next week|다음 주/.test(s)){const monday=new Date(base);monday.setUTCDate(base.getUTCDate()-((base.getUTCDay()+6)%7)+7);monday.setUTCDate(monday.getUTCDate()+((target+6)%7));date=monday.toISOString().slice(0,10);}
      else if(/this week|이번 주/.test(s)){const monday=new Date(base);monday.setUTCDate(base.getUTCDate()-((base.getUTCDay()+6)%7));monday.setUTCDate(monday.getUTCDate()+((target+6)%7));date=monday.toISOString().slice(0,10);}
      else if(/\bnext\b/.test(s))return null; // 'next Tuesday' is intentionally left to clarification/AI.
      else{base.setUTCDate(base.getUTCDate()+(target-base.getUTCDay()+7)%7);date=base.toISOString().slice(0,10);}
    } else if(!date&&/tomorrow|내일/.test(s)){base.setUTCDate(base.getUTCDate()+1);date=base.toISOString().slice(0,10);}
    else if(!date&&/today|오늘/.test(s))date=context.today;
    if(!date&&!period)return null;
    return {action:'update',...(date?{date}:{}),...(period?{period}:{})};
  }
  const api={parse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EasyCommands=api;
})(globalThis);
