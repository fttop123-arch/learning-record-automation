import {createColumnMapping} from './column-mapping.js?v=20261024-columns';
import {workflowStep,paintProgress} from './progress.js';
import {requireDemoAccess} from './demo-access.js';
await requireDemoAccess();
import {createReview} from './notice-review.js';
import {attachFileDrop,preventFileNavigation} from './file-drop.js';
import {fileError,uploadIssues} from './file-validation.js';
import {filterAttendees,employeeDirectory,lookupEmployee,matchType,demoData,spaces,listDepartments,searchDepartments,requireDepartmentChoice,initialDepartment} from './core.js?v=20261024-columns';
import {readWorkbook,loadReference,generateExcel} from './workbooks.js';
import {extractNotice} from './notice-reader.js';
import {withDeadline} from './async-utils.js';
const $=s=>document.querySelector(s);
if(['127.0.0.1','localhost'].includes(location.hostname))$('header .local').textContent='로컬 테스트';
let analysis=null,busy=false,blobUrl=null,referencePromise=null,activeController=null,operationId=0;
let attendeeMapping=null;
let attendeeBook=null,attendeeFile=null,departments=[],rosterLoading=false,rosterLoadId=0;
function populateDepartments(query='',selected=''){
 const candidates=searchDepartments(departments,query),select=$('#department-select');
 select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=rosterLoading?'부서 목록 읽는 중…':!departments.length?'참석자 명단을 먼저 선택해주세요':candidates.length?'목록에서 부서를 선택해주세요':'일치하는 부서가 없습니다';select.append(placeholder);
 for(const name of candidates){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
 select.value=candidates.includes(selected)?selected:'';
 $('#department-status').textContent=rosterLoading?'참석자 Excel에서 부서 목록을 읽고 있습니다…':!departments.length?'참석자 Excel을 선택하면 부서 목록을 먼저 읽습니다.':select.value?`선택된 부서: ${select.value} / 명단의 부서 ${departments.length}개`:`검색 후보 ${candidates.length}개 / 명단의 부서 ${departments.length}개. 검색 후 목록에서 선택해주세요.`;
}
function setDepartments(names){departments=names;$('#department-search').value='';populateDepartments('',initialDepartment(names));}
async function loadAttendeeFile(file){
 document.querySelector('#column-mapping')?.remove();attendeeMapping=null;
 const id=++rosterLoadId;attendeeBook=null;attendeeFile=null;attendeeMapping=null;document.querySelector('#column-mapping')?.remove();departments=[];rosterLoading=!!file;$('#department-search').value='';populateDepartments();sync();
 if(!file)return;
 try{
  if(!file.name.toLowerCase().endsWith('.xlsx')||!file.size||file.size>20*1024*1024)throw Error('참석자 명단은 20MB 이하의 비어 있지 않은 XLSX 파일을 선택해주세요.');
  const book=await withDeadline(async()=>readWorkbook(await file.arrayBuffer()),{label:'참석자 부서 목록',timeoutMs:28000});
  if(id!==rosterLoadId)return;
  attendeeBook=book;attendeeFile=file;rosterLoading=false;
  const panel=createColumnMapping(book.sheets,mapping=>{
   if(id!==rosterLoadId)return;attendeeMapping=mapping;invalidate();
   try{const names=mapping?listDepartments(book.sheets,mapping):[];setDepartments(names);$('#live-status').textContent=mapping?'컬럼 연결이 적용되었습니다. 대상 부서를 선택해주세요.':'부서·성명 컬럼을 연결해주세요.';if(mapping&&!names.length)$('#department-status').textContent='선택한 부서 컬럼에 부서 값이 없습니다. 머리글 행과 컬럼 연결을 확인해주세요.';}
   catch(error){attendeeMapping=null;setDepartments([]);$('#live-status').textContent=error.message;}
   sync();
  });
  $('.file-grid').after(panel);
 }catch(error){if(id===rosterLoadId){rosterLoading=false;populateDepartments();const input=document.querySelector('input[name="attendees"]'),message=document.getElementById('attendees-file-error');message.textContent=error.message;message.hidden=false;input.setAttribute('aria-invalid','true');input.parentElement.classList.add('invalid-file');$('#live-status').textContent=error.message;}}
 finally{if(id===rosterLoadId){rosterLoading=false;sync();}}
}
function getReference(signal){
 if(!referencePromise){const controller=new AbortController();referencePromise=withDeadline(()=>loadReference({signal:controller.signal}),{label:'기준 양식 읽기',timeoutMs:15000,signal,onStop:()=>controller.abort()}).catch(error=>{referencePromise=null;throw error;});}
 return withDeadline(referencePromise,{label:'기준 양식 읽기',signal});
}
const statusLabels={matched:'정상 매칭',duplicate:'동명이인 확인 필요',not_found:'직원정보 미발견',no_file:'파일 미첨부',missing_id:'개인식별번호 없음'};
function alerts(messages=[]){$('#alert-list').replaceChildren(...messages.map(m=>{const li=document.createElement('li');li.textContent=m;return li;}));$('#alerts').hidden=!messages.length;}
function fields(selector,entries){$(selector).replaceChildren(...entries.map(([label,value,wide])=>{const div=document.createElement('div');if(wide)div.className='wide';const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value??'확인 필요';div.append(dt,dd);return div;}));}
function clearResult(){if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;$('#download').removeAttribute('href');$('#completion').hidden=true;}
const readyHint=document.createElement('p');readyHint.className='analysis-ready-hint';readyHint.setAttribute('role','status');$('#analyze-button').after(readyHint);
function sync(){paintProgress([...document.querySelectorAll('.steps span')],workflowStep({hasAnalysis:!!analysis,reviewConfirmed:!!analysis?.review_confirmed,hasResult:!!blobUrl,busy}));for(const form of ['#upload-form','#generate-form'])for(const c of $(form).elements)c.disabled=busy;$('#department-search').disabled=busy||rosterLoading||!departments.length;$('#department-select').disabled=busy||rosterLoading||!departments.length;$('#analyze-button').disabled=busy||rosterLoading;$('#sample-button').disabled=busy||rosterLoading;$('#reset-button').disabled=false;$('#reset-button').textContent=busy||rosterLoading?'분석 취소·초기화':'입력·결과 초기화';$('#generate-button').disabled=busy;$('#welfare-warning').hidden=$('#welfare').value!=='Y';
 const notice=document.querySelector('input[name="notice"]').files[0];
 const reason=busy?'파일을 처리하고 있습니다.':rosterLoading?'참석자 명단에서 부서를 읽고 있습니다.':!attendeeBook?'참석자 명단 Excel을 선택해주세요. 명단에는 소속(부서)·성명(이름) 컬럼이 필요합니다. 직급은 선택입니다.':!$('#department-select').value?'대상 부서를 목록에서 선택해주세요.':!notice?'교육실적 인정 공문을 선택해주세요.':[...document.querySelectorAll('input[type=file]')].some(input=>!!fileError(input.name,input.files[0]))?'첨부파일의 오류 안내를 확인하고 다시 선택해주세요.':'분석할 준비가 되었습니다.';
 readyHint.textContent=reason;
}
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
 analysis={notice,roster,reference:matchedType,method_code:method,warnings,can_generate:false,isSample};
 document.querySelector('.notice-review')?.remove();
 const editor=createReview(notice,reference.names,matchedType.official,result=>{
  if(!analysis)return;
  clearResult();
  analysis.review_confirmed=!!result;
  analysis.can_generate=!!result&&can_generateRoster();
  if(result){analysis.notice=result.notice;analysis.reference={official:result.official,matches:[result.official]};analysis.method_code=1;analysis.warnings=warnings.filter(w=>!w.startsWith('교육유형')&&!w.startsWith('지원하는 학습방법'));render();}
  sync();
 });
 function can_generateRoster(){return !!roster.attendees.length&&roster.attendees.every(a=>a.status==='대상 부서 일치');}
 $('#analysis').prepend(editor);
 $('#generate-form').reset();render();
}
function render(){
 const a=analysis,n=a.notice;
 if(!a.isSample&&!document.querySelector('input[name="employees"]').files.length&&!a.warnings.includes('번호 명부가 없습니다. 개인식별번호를 빈셀로 진행합니다.'))a.warnings.push('번호 명부가 없습니다. 개인식별번호를 빈셀로 진행합니다.');
 fields('#education',[['교육명',n.name,true],['교육일',n.date],['시간',n.start&&n.end?`${n.start} ~ ${n.end}`:'공문에 미기재 (등록에는 사용하지 않음)'],['교육장소',n.place||'공문에 미기재'],['학습방법',`${n.method} / 코드 ${a.method_code??'미확정'}`],['교육유형 공식명',a.reference.official,true],['인정시간',n.hours===null?'확인 필요':`${n.hours}시간 ${n.minutes}분`]]);
 fields('#source-info',[['교육유형 원문',n.type_raw,true],['공식 목록 일치',`${a.reference.matches.length}개`],['교육시작일',n.date],['교육종료일',n.date],['제목',n.name],['내용',n.name,true]]);
 $('#attendee-count').textContent=a.roster.attendees.length+'명';
 $('#attendees').replaceChildren(...a.roster.attendees.map(person=>{const tr=document.createElement('tr');for(const value of [person.name||'(성명 없음)',person.rank||'미제공',person.department,person.employee_lookup.employee_id||'미입력']){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td'),span=document.createElement('span'),small=document.createElement('small');span.className='status'+(person.employee_lookup.status==='matched'?'':' review');span.textContent=statusLabels[person.employee_lookup.status];small.textContent=person.employee_lookup.reason;td.append(span,small);tr.append(td);return tr;}));
 alerts(a.warnings);$('#analysis').hidden=false;$('#live-status').textContent=(a.isSample?'가상 샘플 모드입니다. TEST001/TEST002는 시연용 번호입니다. ':'')+`분석이 완료되었습니다. 대상자 ${a.roster.attendees.length}명. `+(a.roster.attendees.length?'확인값을 검토해주세요.':'정확한 부서명을 확인한 후 다시 분석해주세요.');
 if(!a.roster.attendees.length)$('#alerts').scrollIntoView({behavior:'smooth',block:'center'});

}
$('#sample-button').addEventListener('click',async()=>{if(busy||rosterLoading)return;invalidate();const demo=demoData();if(!departments.length)setDepartments([...new Set(demo.roster.attendees.map(a=>a.department))]);const id=++operationId;activeController=new AbortController();busy=true;sync();$('#live-status').textContent='가상 샘플과 기준 양식을 준비하고 있습니다…';try{const reference=await getReference(activeController.signal);if(id!==operationId)return;const department=requireDepartmentChoice(departments,$('#department-select').value);demo.roster.attendees=demo.roster.attendees.filter(a=>a.department===department);finish(demo.notice,demo.roster,demo.directory,reference,true);}catch(e){if(id===operationId)failed([e.message]);}finally{if(id===operationId){busy=false;activeController=null;sync();}}});
$('#upload-form').noValidate=true;
$('#upload-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||rosterLoading)return;invalidate();const data=new FormData(event.target),errors=[];
 const issues=uploadIssues(Object.fromEntries(['notice','attendees','employees'].map(name=>[name,data.get(name)])));
 if(issues.length){
  for(const {name,message}of issues){const input=document.querySelector(`input[name="${name}"]`),hint=document.getElementById(`${name}-file-error`);hint.textContent=message;hint.hidden=false;input.setAttribute('aria-invalid','true');input.parentElement.classList.add('invalid-file');}
  const input=document.querySelector(`input[name="${issues[0].name}"]`);input.parentElement.scrollIntoView({behavior:'smooth',block:'center'});input.focus({preventScroll:true});$('#live-status').textContent=issues.map(i=>i.message).join(' ');return;
 }
 if(!attendeeMapping){$('#column-mapping')?.scrollIntoView({behavior:'smooth',block:'center'});$('#live-status').textContent='참석자 명단의 부서·성명 컬럼을 연결하고 적용해주세요.';return;}
 let department;
 try{department=requireDepartmentChoice(listDepartments(attendeeBook?.sheets||[],attendeeMapping),data.get('department'));}catch(error){$('#department-status').textContent=error.message;$('#department-select').scrollIntoView({behavior:'smooth',block:'center'});if(!$('#department-select').disabled)$('#department-select').focus({preventScroll:true});$('#live-status').textContent=error.message;return;}
 const id=++operationId;activeController=new AbortController();const signal=activeController.signal;
 busy=true;sync();$('#live-status').textContent='브라우저 안에서 파일을 분석하고 있습니다…';
 const stages=new Map();
 const progress=(name,status)=>{if(id!==operationId)return;stages.set(name,status);$('#live-status').textContent=[...stages].map(([n,s])=>`${n}: ${s}`).join(' / ');};
 const tracked=(name,job)=>{progress(name,'처리 중');return withDeadline(job,{label:name,timeoutMs:28000,signal}).then(value=>{progress(name,'완료');return value;},error=>{progress(name,'확인 필요');throw error;});};
 try{
  const jobs=await Promise.allSettled([tracked('공문',()=>extractNotice(data.get('notice'),{signal,progress:status=>progress('공문',status)})),tracked('참석자 명단',()=>{if(!attendeeBook||attendeeFile!==document.querySelector('input[name="attendees"]').files[0])throw Error('참석자 명단을 다시 선택해주세요.');return attendeeBook;}),tracked('번호 명부',async()=>data.get('employees')?.name?readWorkbook(await data.get('employees').arrayBuffer()):null),tracked('기준 양식',()=>getReference(signal))]);
  if(id!==operationId)return;
  jobs.forEach((job,i)=>{if(job.status==='rejected')errors.push(['공문 분석 실패','참석자 명단 분석 실패','개인식별번호 명부 분석 실패','기준 양식 로드 실패'][i]+': '+job.reason.message);});
  if(errors.length){failed(errors);return;}
  const [notice,rosterBook,employeeBook,reference]=jobs.map(j=>j.value);
  finish(notice,filterAttendees(rosterBook.sheets,department,attendeeMapping),employeeDirectory(employeeBook?.sheets),reference);
 }catch(e){if(id===operationId)failed([e.message||'파일 분석에 실패했습니다.']);}finally{if(id===operationId){busy=false;activeController=null;sync();}}
});
$('#generate-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!analysis)return;
 if(!analysis.review_confirmed){const message=$('#review-confirm-message'),button=$('#confirm-education');message.textContent='먼저 ‘교육정보 확인·적용’ 버튼을 눌러주세요.';message.classList.add('confirmation-needed');button.scrollIntoView({behavior:'smooth',block:'center'});button.focus({preventScroll:true});return;}
 if(!analysis.can_generate){failed(['대상자 누락·동명이인 등 확인 필요 항목을 해결한 뒤 다시 분석해주세요.']);return;}
 if($('#welfare').value==='Y'){$('#welfare-warning').hidden=false;$('#welfare-warning').scrollIntoView({behavior:'smooth',block:'center'});return;}
 const choices=Object.fromEntries(new FormData(event.target)),id=++operationId;activeController=new AbortController();const signal=activeController.signal;busy=true;sync();clearResult();$('#live-status').textContent='양식을 복제하고 결과 Excel을 검증하고 있습니다…';
 try{const template=await getReference(signal),data=await withDeadline(()=>generateExcel(template.data,analysis,choices),{label:'Excel 생성',signal});if(id!==operationId)return;blobUrl=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const filename=analysis.notice.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\s/g,'_')+'_상시학습등록_시연.xlsx';$('#download').href=blobUrl;$('#download').download=filename;$('#result-filename').textContent=filename;$('#completed-education').textContent=analysis.notice.name;const matched=analysis.roster.attendees.filter(a=>a.employee_lookup.status==='matched').length;fields('#summary',[['대상자',analysis.roster.attendees.length+'명'],['개인식별번호 정상 매칭',matched+'명'],['확인 필요',(analysis.roster.attendees.length-matched)+'명']]);$('#completion').hidden=false;$('#completion').scrollIntoView({behavior:'smooth',block:'center'});$('#live-status').textContent='생성·셀 검증이 완료되었습니다. 결과를 다운로드해주세요. D열 수식은 Excel에서 열 때 재계산됩니다.';alerts(analysis.warnings);}catch(e){if(id===operationId)failed([...(analysis?.warnings||[]),e.message]);}finally{if(id===operationId){busy=false;activeController=null;sync();}}
});
for(const input of document.querySelectorAll('input[type=file]')){
 const message=document.createElement('small');message.className='file-error';message.id=`${input.name}-file-error`;message.setAttribute('role','alert');message.hidden=true;input.after(message);input.setAttribute('aria-describedby',message.id);
 const filename=input.parentElement.querySelector('.filename'),row=document.createElement('div');row.className='selected-file';filename.before(row);row.append(filename);
 const remove=document.createElement('button');remove.type='button';remove.className='remove-file';remove.textContent='×';remove.hidden=true;remove.setAttribute('aria-label',`${input.getAttribute('aria-label')} 선택 해제`);remove.title='선택 해제';row.append(remove);
 remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(input.disabled)return;input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));$('#live-status').textContent='파일 선택을 해제했습니다. 필요한 파일을 다시 선택해주세요.';});
 const hint=document.createElement('span');hint.className='drop-hint';hint.textContent='파일을 여기에 끌어놓거나 파일 선택 버튼을 눌러주세요';input.before(hint);
 attachFileDrop(input.parentElement,input,error=>{$('#live-status').textContent=error;alerts([error]);});
 input.addEventListener('change',()=>{
  const file=input.files[0],error=fileError(input.name,file);
  filename.textContent=file?.name||'파일을 선택해주세요';filename.title=file?.name||'';row.classList.toggle('has-file',!!file);remove.hidden=!file;
  message.textContent=error;message.hidden=!error;input.setAttribute('aria-invalid',String(!!error));input.parentElement.classList.toggle('invalid-file',!!error);
  invalidate();
  if(input.name==='attendees')void loadAttendeeFile(error?null:file);
  if(error){$('#live-status').textContent=error;sync();}
 });
}
$('#department-search').addEventListener('input',()=>{invalidate();populateDepartments($('#department-search').value);sync();});
$('#department-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('#department-select').focus();}});
$('#department-select').addEventListener('change',()=>{invalidate();populateDepartments($('#department-search').value,$('#department-select').value);sync();});
for(const select of document.querySelectorAll('#generate-form select'))select.addEventListener('change',()=>{clearResult();sync();});
$('#reset-button').addEventListener('click',()=>{++operationId;++rosterLoadId;activeController?.abort();activeController=null;referencePromise=null;busy=false;rosterLoading=false;attendeeBook=null;attendeeFile=null;attendeeMapping=null;document.querySelector('#column-mapping')?.remove();departments=[];$('#upload-form').reset();$('#generate-form').reset();for(const input of document.querySelectorAll('input[type=file]')){input.removeAttribute('aria-invalid');input.parentElement.classList.remove('invalid-file');input.parentElement.querySelector('.remove-file').hidden=true;input.parentElement.querySelector('.selected-file').classList.remove('has-file');input.parentElement.querySelector('.filename').removeAttribute('title');const message=document.getElementById(`${input.name}-file-error`);message.hidden=true;message.textContent='';}populateDepartments();for(const el of document.querySelectorAll('.filename'))el.textContent='파일을 선택해주세요';invalidate();$('#live-status').textContent='진행 중인 분석을 취소하고 파일 선택과 결과를 초기화했습니다.';});
preventFileNavigation(document);
window.addEventListener('pagehide',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);});
sync();

