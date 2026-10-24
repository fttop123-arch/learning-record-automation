// 단위가 명확한 값만 사용하며 빈 개인시간을 공통값으로 대체하지 않는다.
export function parseDuration(value,unit=''){
 const raw=String(value??'').trim();if(!raw)return null;
 let total;
 if(/^\d+(?:\.\d+)?$/.test(raw)&&unit)total=Number(raw)*(unit==='hours'?60:1);
 else {const m=raw.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?$/);if(!m||(!m[1]&&!m[2])||Number(m[2]||0)>59)return null;total=Number(m[1]||0)*60+Number(m[2]||0);}
 return Number.isSafeInteger(total)&&total>0?{hours:Math.floor(total/60),minutes:total%60}:null;
}
export function rosterDurationColumns(row){
 const labels=row.map(v=>String(v??'').replace(/\s/g,''));
 const find=kind=>labels.flatMap((label,index)=>new RegExp('^'+kind+'(?:\\((?:시간|분)\\))?$').test(label)?[{index,label,unit:label.endsWith('(시간)')?'hours':label.endsWith('(분)')?'minutes':''}]:[]);
 const credit=find('인정시간'),training=find('교육시간');return credit.length?credit:training;
}
export function personDuration(person,notice){
 if(person.duration_pending)return {hours:null,minutes:null,source:'수정한 시간 적용 필요',valid:false};
 if(person.duration_override)return {...person.duration_override,source:'사용자 확인',valid:true};
 if(person.duration_input){const input=person.duration_input,value=input.ambiguous?null:parseDuration(input.raw,input.unit);return value?{...value,source:input.label+' · 명단',valid:true}:{hours:null,minutes:null,source:input.ambiguous?'시간 컬럼 중복: 파일 수정 필요':input.label+' · 빈칸/단위/형식 확인 필요',valid:false};}
 const value=Number.isInteger(notice.hours)&&Number.isInteger(notice.minutes)&&notice.hours>=0&&notice.minutes>=0&&notice.minutes<60&&notice.hours*60+notice.minutes>0;
 return {hours:notice.hours,minutes:notice.minutes,source:'공문 공통값',valid:!!value};
}
