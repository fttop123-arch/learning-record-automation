export function isoDate(y,m,d){
 const t=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));
 return Number(y)>=1900&&Number(y)<=9999&&t.getUTCFullYear()===Number(y)&&t.getUTCMonth()===Number(m)-1&&t.getUTCDate()===Number(d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;
}
export function readDate(value,date1904=false){
 if(typeof value==='number'){if(!Number.isInteger(value)||value<1||value>2958465||(!date1904&&value===60))return null;const t=new Date((value+(date1904?1462:0)-25569)*86400000);return Number.isNaN(t.getTime())?null:isoDate(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate());}
 const m=String(value??'').trim().match(/^(\d{4})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})\s*[.일]?$/);return m?isoDate(...m.slice(1)):null;
}
export function readPeriod(value){
 const raw=String(value??'').trim();const parts=raw.split(/\s*(?:~|～|〜|부터)\s*/);
 if(parts.length===1){const single=readDate(raw);return single?{start:single,end:single}:null;}
 if(parts.length!==2)return null;
 const start=readDate(parts[0].replace(/\([^)]*\)/g,''));if(!start)return null;
 const [y,m]=start.split('-');let endText=parts[1].replace(/까지\s*$/,'').replace(/\([^)]*\)/g,'').trim();
 let end=readDate(endText);
 if(!end){const short=endText.match(/^(\d{1,2})\s*[.월/-]\s*(\d{1,2})\s*[.일]?$/),day=endText.match(/^(\d{1,2})\s*일?\.?$/);end=short?isoDate(y,...short.slice(1)):day?isoDate(y,m,day[1]):null;}
 return end&&start<=end?{start,end}:null;
}
export function dateHeaderKind(value){
 const key=String(value??'').replace(/\s/g,'');
 if(/^(교육|학습)(시작|개시)(일|일자|일시)?$/.test(key))return 'start';
 if(/^(교육|학습)(종료|종료일|종료일자|종료일시|완료일)$/.test(key))return 'end';
 if(/^(교육|학습)기간$/.test(key))return 'period';
 if(/^(교육|학습|참석)(일|일자)$/.test(key))return 'single';
 return null;
}
export function dateColumns(row){return row.flatMap((v,index)=>{const kind=dateHeaderKind(v);return kind?[{kind,index,label:String(v)}]:[];});}
export function noticePeriod(text,fallback){
 const entries={start:[],end:[],period:[]};let present=false;
 for(const line of text.split(/\r?\n/)){const m=line.match(/^\s*(?:\d+[.)]\s*)?([^:：]{1,35})[:：]\s*(.*)$/);if(!m)continue;const kind=dateHeaderKind(m[1]);
 if(kind&&kind!=='single'){present=true;entries[kind].push({raw:m[2],evidence:line.trim()});}
 // 교육일시의 명시된 날짜 범위도 기간으로 처리한다.
 else if(/^(교육|학습|참석)(일시|일|일자)$/.test(m[1].replace(/\s/g,''))&&/[~～〜]|부터/.test(m[2])&&readPeriod(m[2])){present=true;entries.period.push({raw:m[2],evidence:line.trim()});}
 }
 if(!present)return {start:fallback,end:fallback,evidence:[]};
 const p=entries.period.length===1?readPeriod(entries.period[0].raw):null;
 const get=k=>entries[k].length===1?readDate(entries[k][0].raw):null;
 let start=get('start'),end=get('end');
 const ambiguous=Object.values(entries).some(v=>v.length>1)||(entries.period.length&&!p)||(entries.start.length&&!start)||(entries.end.length&&!end);
 if(ambiguous)return {start:null,end:null,evidence:Object.values(entries).flat()};
 if(p){if((start&&start!==p.start)||(end&&end!==p.end))return {start:null,end:null,evidence:Object.values(entries).flat()};start=p.start;end=p.end;}
 if(!entries.start.length&&!p)start=end;if(!entries.end.length&&!p)end=start;
 return {start,end,evidence:Object.values(entries).flat()};
}
export function personDates(person,notice){
 if(person.date_pending)return {valid:false,source:'수정한 날짜 적용 필요'};
 if(person.date_override){const {start,end}=person.date_override;return {start,end,valid:!!readDate(start)&&!!readDate(end)&&start<=end,source:'사용자 확인 날짜'};}
 if(person.date_input){const {fields,date1904=false}=person.date_input;if(new Set(fields.map(f=>f.kind)).size!==fields.length)return {valid:false,source:'날짜 컬럼 중복: 파일 수정 필요'};
 const values={};for(const f of fields){const value=f.kind==='period'?readPeriod(f.raw):readDate(f.raw,date1904);if(!value)return {valid:false,source:`${f.label}: 날짜 빈칸/형식 확인 필요`};values[f.kind]=value;}
 const single=values.single,period=values.period;const start=values.start||period?.start||single||values.end,end=values.end||period?.end||single||values.start;
 const conflict=(single&&((start&&start!==single)||(end&&end!==single)))||(period&&((values.start&&values.start!==period.start)||(values.end&&values.end!==period.end)));
 return {start,end,valid:!!start&&!!end&&start<=end&&!conflict,source:conflict?'명단 날짜 컬럼 값 충돌':start>end?'종료일이 시작일보다 빠름':'명단 개인별 날짜'};
 }
 const start=notice.start_date===undefined?notice.date:notice.start_date,end=notice.end_date===undefined?notice.date:notice.end_date;
 return {start,end,valid:!!readDate(start)&&!!readDate(end)&&start<=end,source:start>end?'공문 종료일이 시작일보다 빠름':(!!readDate(start)&&!!readDate(end)?'공문 공통 날짜':'공문 공통 날짜 확인 필요')};
}
