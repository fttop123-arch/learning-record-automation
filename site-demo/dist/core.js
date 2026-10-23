/* 브라우저와 Node 테스트에서 함께 사용하는 순수 업무 규칙. */
export const trim = value => typeof value === 'string' ? value.trim() : '';
export const spaces = value => String(value ?? '').replace(/\s/g, '');
export const normalizeType = value => spaces(value).replace(/[ㆍ‧]/g, '·');
export function parseNotice(text) {
  function field(label) {
    const pattern = [...label].join('\\s*');
    const matches = [...text.matchAll(new RegExp('(?:^|\\n)\\s*\\d+\\.\\s*'+pattern+'\\s*[:：]\\s*([^\\n]+)', 'g'))];
    if (matches.length !== 1) throw Error(`공문에서 ${label} 항목을 하나로 확인할 수 없습니다.`);
    return matches[0][1].trim();
  }
  const schedule = field('교육일시');
  const m = schedule.match(/^(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})\s*[~～〜]\s*(\d{1,2}):(\d{2})$/);
  if (!m) throw Error('지원하지 않는 교육일시 형식입니다. 텍스트 공문 샘플 형식을 확인해주세요.');
  const [year, month, day, sh, sm, eh, em] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(year, month-1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month-1 || dt.getUTCDate() !== day || sh>23 || eh>23 || sm>59 || em>59 || eh*60+em<=sh*60+sm) throw Error('교육일시 확인이 필요합니다.');
  const duration = field('인정시간').match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?$/);
  if (!duration || (!duration[1] && !duration[2]) || Number(duration[2]||0)>59) throw Error('인정시간 확인이 필요합니다.');
  const pad = x => String(x).padStart(2,'0');
  return {name:field('교육명'),date:`${year}-${pad(month)}-${pad(day)}`,start:`${pad(sh)}:${pad(sm)}`,end:`${pad(eh)}:${pad(em)}`,place:field('교육장소'),method:field('학습방법'),type_raw:field('교육유형'),hours:Number(duration[1]||0),minutes:Number(duration[2]||0)};
}
export function filterAttendees(sheets, department) {
  department = trim(department);
  if (!department) throw Error('대상 부서를 입력해주세요.');
  const headers = [];
  for (const sheet of sheets) sheet.rows.forEach((row,index) => {
    const labels = row.map(spaces);
    if (['소속','직급','성명'].every(x=>labels.filter(l=>l===x).length===1)) headers.push({sheet,index,columns:['소속','직급','성명'].map(x=>labels.indexOf(x))});
  });
  if(headers.length!==1) throw Error('참석자 명단의 소속/직급/성명 헤더를 하나로 확인할 수 없습니다.');
  const {sheet,index,columns:[dc,rc,nc]} = headers[0];
  const attendees=[]; let total=0;
  sheet.rows.slice(index+1).forEach((r,i)=>{
    if(![r[dc],r[rc],r[nc]].some(v=>String(v??'').trim())) return;
    total++;
    if(spaces(r[dc])===spaces(department)) attendees.push({department,rank:trim(r[rc]),name:trim(r[nc]),row:index+i+2,status:'대상 부서 일치'});
  });
  for(const a of attendees) a.status=!a.name?'성명 누락: 사용자 확인 필요':attendees.filter(b=>spaces(a.name)===spaces(b.name)).length>1?'동명이인 확인 필요':!a.rank?'직급 누락: 사용자 확인 필요':'대상 부서 일치';
  const departments=[...new Set(sheet.rows.slice(index+1).map(r=>trim(r[dc])).filter(Boolean))];
  const suggestions=attendees.length?[]:departments.filter(d=>spaces(d).includes(spaces(department)));
  return {total,attendees,sheet:sheet.name,departments,suggestions};
}
export function employeeDirectory(sheets) {
  if(!sheets) return {mode:'no_file',records:[]};
  const headers=[];
  for(const sheet of sheets) sheet.rows.forEach((row,index)=>{
    const labels=row.map(trim), names=labels.flatMap((x,i)=>['성명','이름'].includes(x)?[i]:[]);
    if(!names.length||!labels.includes('개인식별번호')) return;
    if(names.length!==1||labels.filter(x=>x==='개인식별번호').length!==1||labels.filter(x=>x==='부서').length>1) throw Error('직원정보 헤더가 중복되어 확정할 수 없습니다.');
    headers.push({sheet,index,nc:names[0],dc:labels.indexOf('부서'),ic:labels.indexOf('개인식별번호')});
  });
  if(headers.length!==1) throw Error('직원정보의 이름/성명·개인식별번호 헤더를 하나로 확인할 수 없습니다.');
  const {sheet,index,nc,dc,ic}=headers[0];
  return {mode:dc<0?'name_only':'department_name',records:sheet.rows.slice(index+1).map((r,i)=>({name:trim(r[nc]),department:dc<0?null:trim(r[dc]),employee_id:trim(r[ic])||null,row:index+i+2})).filter(r=>r.name&&(dc<0||r.department))};
}
export function lookupEmployee(directory,department,name) {
  const base={department:trim(department),name:trim(name),employee_id:null,match_mode:directory.mode};
  if(directory.mode==='no_file') return {...base,status:'no_file',reason:'개인식별번호 파일 미첨부'};
  const matches=directory.records.filter(r=>r.name===base.name&&(directory.mode==='name_only'||r.department===base.department));
  if(matches.length>1) return {...base,status:'duplicate',reason:'동명이인 확인 필요',candidates:matches.map(r=>({row:r.row}))};
  if(!matches.length) return {...base,status:'not_found',reason:'직원정보 미발견'};
  if(!matches[0].employee_id) return {...base,status:'missing_id',reason:'개인식별번호 없음 또는 텍스트 상수 확인 필요'};
  return {...base,status:'matched',reason:directory.mode==='name_only'?'부서 선별 후 이름 정확히 일치':'부서+성명 정확히 일치',employee_id:matches[0].employee_id};
}
export function matchType(raw,names) {
  const matches=names.filter(n=>normalizeType(n)===normalizeType(raw));
  return {official:matches.length===1?matches[0]:null,matches,count:names.length};
}
export function demoData() {
  return {notice:{name:'2026년 경주시청 소방교육',date:'2026-09-21',start:'10:00',end:'12:00',place:'경주시청 대회의실',method:'집합교육',type_raw:'기관주관교육/직장교육/직무·시책·소양',hours:2,minutes:0},
    roster:{total:3,attendees:[{name:'김지현',rank:'전산9급',department:'디지털정책과',status:'대상 부서 일치'},{name:'문형식',rank:'전산6급',department:'디지털정책과',status:'대상 부서 일치'},{name:'가상직원',rank:'행정7급',department:'경제정책과',status:'대상 부서 일치'}]},
    directory:{mode:'department_name',records:[{name:'김지현',department:'디지털정책과',employee_id:'TEST001'},{name:'문형식',department:'디지털정책과',employee_id:'TEST002'}]}};
}
