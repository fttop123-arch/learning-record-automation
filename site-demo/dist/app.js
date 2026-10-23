import {parseNotice,filterAttendees,employeeDirectory,lookupEmployee,matchType,demoData,spaces} from './core.js';
import {readWorkbook,loadReference,generateExcel} from './workbooks.js';
import {extractPdf} from './pdf-reader.js';
import {withDeadline} from './async-utils.js';
const $=s=>document.querySelector(s);
let analysis=null,busy=false,blobUrl=null,referencePromise=null,activeController=null,operationId=0;
function getReference(signal){
 if(!referencePromise){const controller=new AbortController();referencePromise=withDeadline(()=>loadReference({signal:controller.signal}),{label:'기준 양식 읽기',timeoutMs:15000,signal,onStop:()=>controller.abort()}).catch(error=>{referencePromise=null;throw error;});}
 return withDeadline(referencePromise,{label:'기준 양식 읽기',signal});
}
const statusLabels={matched:'정상 매칭',duplicate:'동명이인 확인 필요',not_found:'직원정보 미발견',no_file:'파일 미첨부',missing_id:'개인식별번호 없음'};
function alerts(messages=[]){$('#alert-list').replaceChildren(...messages.map(m=>{const li=document.createElement('li');li.textContent=m;return li;}));$('#alerts').hidden=!messages.length;}
function fields(selector,entries){$(selector).replaceChildren(...entries.map(([label,value,wide])=>{const div=document.createElement('div');if(wide)div.className='wide';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value??'확인 필요';div.append(dt,dd);return div;}));}
function clearResult(){if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;$('#download').removeAttribute('href');$('#completion').hidden=true;}
function sync(){for(const form of ['#upload-form','#generate-form'])for(const c of $(form).elements)c.disabled=busy;$('#sample-button').disabled=busy;$('#reset-button').disabled=false;$('#reset-button').textContent=busy?'분석 취소·초기화':'입력·결과 초기화';$('#generate-button').disabled=busy||!analysis?.can_generate||$('#welfare').value==='Y';$('#welfare-warning').hidden=$('#welfare').value!=='Y';}
function failed(messages){alerts(messages);$('#live-status').textContent='분석을 완료하지 못했습니다. 확인 필요 목록을 확인하고 다시 시도해주세요.';$('#alerts').scrollIntoView({behavior:'smooth',block:'center'});}
function invalidate(){analysis=null;clearResult();$('#analysis').hidden=true;alerts();$('#live-status').textContent='파일 또는 대상 부서가 변경되었습니다. 다시 분석해주세요.';sync();}
function finish(notice,roster,directory,reference,isSample=false){
 for(const a of roster.attendees)a.employee_lookup=lookupEmployee(directory,a.department,a.name);
 const matchedType=matchType(notice.type_raw,reference.names),method=spaces(notice.method)==='집합교육'?1:null,warnings=[];
 for(const a of roster.attendees){if(a.status!=='대상 부서 일치')warnings.push(`${a.name}: ${a.status}`);if(a.employee_lookup.status!=='matched')warnings.push(`${a.name}: ${statusLabels[a.employee_lookup.status]}`);}
 if(!roster.attendees.length)warnings.push(roster.suggestions?.length?`입력한 부서와 정확히 일치하는 참석자가 없습니다. 명단의 부서명: ${roster.suggestions.map(s=>'“'+s+'”').join(', ')}. 위 대상 부서를 수정한 후 다시 분석해주세요. (자동 변경하지 않습니다.)`:'대상 부서 참석자가 없습니다. 명단의 정확한 부서명을 확인해주세요.');
 if(!matchedType.official)warnings.push('교육유형 공식 목록과 단일 일치하지 않습니다.');
 if(method===null)warnings.push('지원하는 학습방법이 아닙니다. 확인이 필요합니다.');
 const can_generate=!!roster.attendees.length&&roster.attendees.every(a=>a.status==='대상 부서 일치')&&!!matchedType.official&&method!==null;
 analysis={notice,roster,reference:matchedType,method_code:method,warnings,can_generate,isSample};
 $('#department-options').replaceChildren(...(roster.departments||[]).map(name=>{const option=document.createElement('option');option.value=name;return option;}));
 $('#generate-form').reset();render();
}
function render(){
 const a=analysis,n=a.notice;
 fields('#education',[['교육명',n.name,true],['교육일',n.date],['시간',`${n.start} ~ ${n.end}`],['교육장소',n.place],['학습방법',`${n.method} / 코드 ${a.method_code??'미확정'}`],['교육유형 공식명',a.reference.official,true],['인정시간',`${n.hours}시간 ${n.minutes}분`]]);
 fields('#source-info',[['교육유형 원문',n.type_raw,true],['공식 목록 일치',`${a.reference.matches.length}개`],['교육시작일',n.date],['교육종료일',n.date],['제목',n.name],['내용',n.name,true]]);
 $('#attendee-count').textContent=a.roster.attendees.length+'명';
 $('#attendees').replaceChildren(...a.roster.attendees.map(person=>{const tr=document.createElement('tr');for(const value of [person.name||'(성명 없음)',person.rank||'(직급 없음)',person.department,person.employee_lookup.employee_id||'미입력']){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td'),span=document.createElement('span'),small=document.createElement('small');span.className='status'+(person.employee_lookup.status==='matched'?'':' review');span.textContent=statusLabels[person.employee_lookup.status];small.textContent=person.employee_lookup.reason;td.append(span,small);tr.append(td);return tr;}));
 alerts(a.warnings);$('#analysis').hidden=false;$('#live-status').textContent=(a.isSample?'가상 샘플 모드입니다. TEST001/TEST002는 시연용 번호입니다. ':'')+`분석이 완료되었습니다. 대상자 ${a.roster.attendees.length}명. `+(a.roster.attendees.length?'확인값을 검토해주세요.':'정확한 부서명을 확인한 후 다시 분석해주세요.');
 if(!a.roster.attendees.length)$('#alerts').scrollIntoView({behavior:'smooth',block:'center'});
 document.querySelectorAll('.steps span').forEach((s,i)=>s.classList.toggle('active',i===1));
}
$('#sample-button').addEventListener('click',async()=>{if(busy)return;invalidate();const id=++operationId;activeController=new AbortController();busy=true;sync();$('#live-status').textContent='가상 샘플과 기준 양식을 준비하고 있습니다…';try{const reference=await getReference(activeController.signal);if(id!==operationId)return;const demo=demoData(),department=$('#department').value.trim();if(!department)throw Error('대상 부서를 입력해주세요.');demo.roster.attendees=demo.roster.attendees.filter(a=>spaces(a.department)===spaces(department));finish(demo.notice,demo.roster,demo.directory,reference,true);}catch(e){if(id===operationId)failed([e.message]);}finally{if(id===operationId){busy=false;activeController=null;sync();}}});
$('#upload-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;invalidate();const data=new FormData(event.target),errors=[];
 for(const [name,label,extension]of [['notice','공문 PDF','.pdf'],['attendees','참석자 명단','.xlsx'],['employees','개인식별번호 명부','.xlsx']]){const file=data.get(name);if(!file?.name){if(name!=='employees')errors.push(`${label} 파일을 선택해주세요.`);continue;}if(!file.name.toLowerCase().endsWith(extension))errors.push(`${label}: ${extension} 파일만 선택할 수 있습니다.`);if(!file.size||file.size>20*1024*1024)errors.push(`${label}: 빈 파일 또는 20MB 초과 파일은 처리할 수 없습니다.`);}
 if(errors.length){failed(errors);return;}
 const id=++operationId;activeController=new AbortController();const signal=activeController.signal;
 busy=true;sync();$('#live-status').textContent='브라우저 안에서 파일을 분석하고 있습니다…';
 const stages=new Map();
 const progress=(name,status)=>{if(id!==operationId)return;stages.set(name,status);$('#live-status').textContent=[...stages].map(([n,s])=>`${n}: ${s}`).join(' / ');};
 const tracked=(name,job)=>{progress(name,'처리 중');return withDeadline(job,{label:name,timeoutMs:28000,signal}).then(value=>{progress(name,'완료');return value;},error=>{progress(name,'확인 필요');throw error;});};
 try{
  const jobs=await Promise.allSettled([tracked('공문 PDF',()=>extractPdf(data.get('notice'),{signal,progress:status=>progress('공문 PDF',status)})),tracked('참석자 명단',async()=>readWorkbook(await data.get('attendees').arrayBuffer())),tracked('번호 명부',async()=>data.get('employees')?.name?readWorkbook(await data.get('employees').arrayBuffer()):null),tracked('기준 양식',()=>getReference(signal))]);
  if(id!==operationId)return;
  jobs.forEach((job,i)=>{if(job.status==='rejected')errors.push(['공문 분석 실패','참석자 명단 분석 실패','개인식별번호 명부 분석 실패','기준 양식 로드 실패'][i]+': '+job.reason.message);});
  if(errors.length){failed(errors);return;}
  const [notice,rosterBook,employeeBook,reference]=jobs.map(j=>j.value);
  finish(notice,filterAttendees(rosterBook.sheets,data.get('department')),employeeDirectory(employeeBook?.sheets),reference);
 }catch(e){if(id===operationId)failed([e.message||'파일 분석에 실패했습니다.']);}finally{if(id===operationId){busy=false;activeController=null;sync();}}
});
$('#generate-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!analysis)return;const choices=Object.fromEntries(new FormData(event.target)),id=++operationId;activeController=new AbortController();const signal=activeController.signal;busy=true;sync();clearResult();$('#live-status').textContent='양식을 복제하고 결과 Excel을 검증하고 있습니다…';
 try{const template=await getReference(signal),data=await withDeadline(()=>generateExcel(template.data,analysis,choices),{label:'Excel 생성',signal});if(id!==operationId)return;blobUrl=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const filename=analysis.notice.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s/g,'_')+'_상시학습등록_시연.xlsx';$('#download').href=blobUrl;$('#download').download=filename;$('#result-filename').textContent=filename;$('#completed-education').textContent=analysis.notice.name;const matched=analysis.roster.attendees.filter(a=>a.employee_lookup.status==='matched').length;fields('#summary',[['대상자',analysis.roster.attendees.length+'명'],['개인식별번호 정상 매칭',matched+'명'],['확인 필요',(analysis.roster.attendees.length-matched)+'명']]);$('#completion').hidden=false;$('#completion').scrollIntoView({behavior:'smooth',block:'center'});$('#live-status').textContent='생성·셀 검증이 완료되었습니다. 결과를 다운로드해주세요. D열 수식은 Excel에서 열 때 재계산됩니다.';alerts(analysis.warnings);document.querySelectorAll('.steps span').forEach((s,i)=>s.classList.toggle('active',i===3));}catch(e){if(id===operationId)failed([...(analysis?.warnings||[]),e.message]);}finally{if(id===operationId){busy=false;activeController=null;sync();}}
});
for(const input of document.querySelectorAll('input[type=file]'))input.addEventListener('change',()=>{input.parentElement.querySelector('.filename').textContent=input.files[0]?.name||'파일을 선택해주세요';invalidate();});
$('#department').addEventListener('input',invalidate);
for(const select of document.querySelectorAll('select'))select.addEventListener('change',()=>{clearResult();sync();});
$('#reset-button').addEventListener('click',()=>{++operationId;activeController?.abort();activeController=null;referencePromise=null;busy=false;$('#upload-form').reset();$('#generate-form').reset();$('#department-options').replaceChildren();for(const el of document.querySelectorAll('.filename'))el.textContent='파일을 선택해주세요';invalidate();$('#live-status').textContent='진행 중인 분석을 취소하고 파일 선택과 결과를 초기화했습니다.';});
window.addEventListener('pagehide',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);});
sync();
