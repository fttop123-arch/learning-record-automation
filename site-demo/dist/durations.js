import {personDates} from './dates.js?v=20261024-period';
// 단위가 명확한 값만 사용하며 빈 개인시간을 공통값으로 대체하지 않는다.
export function parseDuration(value,unit='',allowZero=false){
 const raw=String(value??'').trim();if(!raw)return null;
 let total;
 if((allowZero&&/^0+(?:\.0+)?$/.test(raw))||(/^\d+(?:\.\d+)?$/.test(raw)&&unit))total=Number(raw)*(unit==='hours'?60:1);
 else {const m=raw.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?$/);if(!m||(!m[1]&&!m[2])||Number(m[2]||0)>59)return null;total=Number(m[1]||0)*60+Number(m[2]||0);}
 return Number.isSafeInteger(total)&&(allowZero?total>=0:total>0)?{hours:Math.floor(total/60),minutes:total%60}:null;
}
export function rosterDurationColumns(row){
 const labels=row.map(v=>String(v??'').replace(/\s/g,''));
 const find=kind=>labels.flatMap((label,index)=>new RegExp('^'+kind+'(?:\\((?:시간|분)\\))?$').test(label)?[{index,label,unit:label.endsWith('(분)')?'minutes':'hours'}]:[]);
 const credit=['인정시간','이수시간','인증시간'].flatMap(find).sort((a,b)=>a.index-b.index),training=find('교육시간');return credit.length?credit:training;
}
export function personDuration(person,notice){
 if(person.duration_pending)return {hours:null,minutes:null,source:'수정한 시간 적용 필요',valid:false};
 if(person.duration_override)return {...person.duration_override,source:'사용자 확인',valid:true};
 if(person.duration_input){const input=person.duration_input,value=input.ambiguous?null:parseDuration(input.raw,input.unit||'hours',true);return value?{...value,source:input.label+' · 명단'+(String(input.label||'').startsWith('인증시간')?' · 인정시간의 오타로 간주했습니다. 확인해주세요.':String(input.label||'').startsWith('교육시간')?' · 실적인정 시간으로 사용 가능한지 확인해주세요.':''),valid:true}:{hours:null,minutes:null,source:input.ambiguous?'시간 컬럼 중복: 파일 수정 필요':input.label+' · 빈칸/단위/형식 확인 필요',valid:false};}
 const value=Number.isInteger(notice.hours)&&Number.isInteger(notice.minutes)&&notice.hours>=0&&notice.minutes>=0&&notice.minutes<60&&notice.hours*60+notice.minutes>0;
 return {hours:notice.hours,minutes:notice.minutes,source:'공문 공통값',valid:!!value};
}

export function registrationPlan(attendees,notice){
 const included=[],excluded=[],issues=[];
 if(!attendees.length)issues.push('선택한 부서의 참석자가 없습니다. 부서와 명단을 확인해주세요.');
 for(const person of attendees){const duration=personDuration(person,notice),who=(person.name||'(성명 없음)')+(person.row?` (명단 ${person.row}행)`:'');
  if(!duration.valid){issues.push(`${who}: ${duration.source}. 개인별 인정시간을 확인·적용해주세요.`);continue;}
  if(duration.hours===0&&duration.minutes===0){excluded.push(person);continue;}
  const dates=personDates(person,notice);if(!dates.valid){issues.push(`${who}: ${dates.source}. 교육시작일·종료일을 확인해주세요.`);continue;}
  if(person.status!=='대상 부서 일치'){issues.push(`${who}: ${person.status}. 명단을 확인해주세요.`);continue;}
  included.push(person);
 }
 if(!issues.length&&!included.length)issues.push('모든 대상자의 인정시간이 0시간 0분이므로 생성할 데이터가 없습니다.');
 return {included,excluded,issues};
}
