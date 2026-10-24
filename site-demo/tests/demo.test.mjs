import test from 'node:test';
import {demoData} from './sample-data.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';
import JSZip from 'jszip';
import {gunzipSync} from 'node:zlib';
import {withDeadline} from '../dist/async-utils.js';
import {parseNotice,filterAttendees,employeeDirectory,lookupEmployee,matchType,listDepartments,searchDepartments,requireDepartmentChoice,initialDepartment} from '../dist/core.js';
import {readWorkbook,generateExcel} from '../dist/workbooks.js';
globalThis.DOMParser=DOMParser;globalThis.JSZip=JSZip;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const template=await fs.readFile(path.join(root,'site-demo/dist/reference.xlsx'));
const noticeText='1. 교 육 명 : 2026년 경주시청 소방교육\n2. 교육일시 : 2026. 9. 21.(월) 10:00 ~ 12:00\n3. 교육장소 : 경주시청 대회의실\n4. 학습방법 : 집합교육\n5. 교육유형 : 기관주관교육/직장교육/직무·시책·소양\n6. 인정시간 : 2시간';
const types=['기관주관교육/직장교육/직무ㆍ시책ㆍ소양'];
function analysis(){const d=demoData();d.roster.attendees=d.roster.attendees.filter(a=>a.department==='디지털정책과');for(const a of d.roster.attendees)a.employee_lookup=lookupEmployee(d.directory,a.department,a.name);return {...d,reference:matchType(d.notice.type_raw,types),can_generate:true};}
test('공문 주요 항목 추출',()=>assert.deepEqual(parseNotice(noticeText),demoData().notice));
test('잘못된 날짜 추측 금지',()=>assert.throws(()=>parseNotice(noticeText.replace('9. 21.','2. 30.'))));
test('공식 유형 문자열과 구두점 정규화',()=>assert.equal(matchType(demoData().notice.type_raw,types).official,types[0]));
test('유형 미발견·다중 일치 미확정',()=>{assert.equal(matchType('없는 유형',types).official,null);assert.equal(matchType(types[0],[...types,...types]).official,null);});
test('부서 선별',()=>{const r=filterAttendees([{name:'Sheet1',rows:[['소속','직급','성명'],['디지털정책과','전산9급','김지현'],['다른과','행정7급','김지현']]}],'디지털정책과');assert.equal(r.attendees.length,1);assert.equal(r.attendees[0].status,'대상 부서 일치');});
test('참석 명단 내 동명이인',()=>{const r=filterAttendees([{name:'Sheet1',rows:[['소속','직급','성명'],['디지털정책과','전산9급','김지현'],['디지털정책과','전산6급','김지현']]}],'디지털정책과');assert.ok(r.attendees.every(a=>a.status==='동명이인 확인 필요'));});
test('2컬럼 이름 매칭',()=>{const d=employeeDirectory([{rows:[['이름','개인식별번호'],[' 김지현 ','TEST001']]}]);assert.equal(lookupEmployee(d,'디지털정책과','김지현').employee_id,'TEST001');});
test('2컬럼 이름 중복·미발견',()=>{const d=employeeDirectory([{rows:[['성명','개인식별번호'],['김지현','TEST001'],['김지현','TEST002']]}]);assert.equal(lookupEmployee(d,'디지털정책과','김지현').status,'duplicate');assert.equal(lookupEmployee(d,'디지털정책과','김 지현').status,'not_found');});
test('3컬럼 다른 부서 동명이인 제외',()=>{const d=employeeDirectory([{rows:[['부서','이름','개인식별번호'],['다른과','김지현','TEST003'],['디지털정책과','김지현','TEST001']]}]);assert.equal(lookupEmployee(d,'디지털정책과','김지현').employee_id,'TEST001');});
test('번호 빈셀과 파일 없음',()=>{assert.equal(lookupEmployee(employeeDirectory([{rows:[['이름','개인식별번호'],['김지현',null]]}]),'디지털정책과','김지현').status,'missing_id');assert.equal(lookupEmployee(employeeDirectory(null),'디지털정책과','김지현').status,'no_file');});
test('공개 양식에 예시 번호·로컬 경로 없음',async()=>{const z=await JSZip.loadAsync(template);const all=(await Promise.all(Object.values(z.files).filter(f=>f.name.endsWith('.xml')).map(f=>f.async('string')))).join('\n');assert.ok(!all.includes('A1234567'));assert.ok(!all.includes('C:\\Users\\Owner'));const b=await readWorkbook(template);assert.equal(b.sheets.length,3);assert.equal(b.sheets.find(s=>s.name==='교육유형').rows.length,32);});
test('절대·상대 시트 참조 모두 읽기',async()=>{const source=await fs.readFile(path.join(root,'tests/fixtures/employees.xlsx'));const b=await readWorkbook(source);assert.equal(lookupEmployee(employeeDirectory(b.sheets),'디지털정책과','김지현').employee_id,'TEST001');});
test('XLSX 생성·행별 수식·O/P 빈셀·양식 보존',async()=>{
 const data=await generateExcel(template,analysis(),{required:'N',welfare:'N',participation:'0'}),b=await readWorkbook(data),s=b.sheets.find(s=>s.name==='Sheet1');
 assert.equal(s.rows.length,3);assert.equal(s.rows[1][1],'TEST001');assert.equal(s.rows[2][1],'TEST002');
 for(let row=2;row<=3;row++){assert.equal(s.rows[row-1][14],null);assert.equal(s.rows[row-1][15],null);assert.match(await b.zip.file(s.file).async('string'),new RegExp(`MATCH\\(C${row},`));}
 const before=await JSZip.loadAsync(template);for(const name of Object.keys(before.files)){if(!['xl/worksheets/sheet1.xml','xl/workbook.xml','xl/calcChain.xml'].includes(name))assert.deepEqual(await before.file(name).async('uint8array'),await b.zip.file(name).async('uint8array'),name);}
 const out=path.join(root,'site-demo/test-output');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'demo-result.xlsx'),data);
});
test('파일 미첨부 B열 빈셀',async()=>{const a=analysis();for(const person of a.roster.attendees)person.employee_lookup=lookupEmployee(employeeDirectory(null),person.department,person.name);const b=await readWorkbook(await generateExcel(template,a,{required:'Y',welfare:'N',participation:'1'}));assert.equal(b.sheets[0].rows[1][1],null);assert.equal(b.sheets[0].rows[1][4],'Y');assert.equal(b.sheets[0].rows[1][10],1);});
test('사회복지교육 Y는 생성 차단',async()=>assert.rejects(()=>generateExcel(template,analysis(),{required:'N',welfare:'Y',participation:'0'})));
test('공개 UI 안내와 브라우저 내부 처리',async()=>{const html=await fs.readFile(path.join(root,'site-demo/dist/learning.html'),'utf8'),app=await fs.readFile(path.join(root,'site-demo/dist/app.js'),'utf8');assert.ok(html.includes('실제 개인정보 및 내부자료를 업로드하지 마세요.'));assert.ok(!html.includes('sample-button'));assert.ok(!app.includes('sample-button'));assert.ok(!app.includes('demoData'));assert.ok(html.includes('reset-button'));assert.ok(!app.includes('POST'));assert.ok(!app.includes('localStorage'));});
test('노인복지는 자동 매칭 없이 노인복지과 안내',()=>{const sheets=[{name:'Sheet1',rows:[['소속','직급','성명'],['노인복지과','사회복지8급','가상직원1'],['노인복지과','사회복지6급','가상직원2']]}];const partial=filterAttendees(sheets,'노인복지');assert.equal(partial.attendees.length,0);assert.deepEqual(partial.suggestions,['노인복지과']);assert.equal(filterAttendees(sheets,'노인복지과').attendees.length,2);});
test('끝나지 않는 분석도 제한시간 후 종료',async()=>{let stopped=false;await assert.rejects(withDeadline(new Promise(()=>{}),{label:'공문 PDF',timeoutMs:10,onStop:()=>{stopped=true;}}),/처리 시간이 초과/);assert.equal(stopped,true);});
test('분석 중 취소가 즉시 끝남',async()=>{const c=new AbortController();const pending=withDeadline(new Promise(()=>{}),{signal:c.signal});c.abort();await assert.rejects(pending,/취소/);});
test('정상 작업은 제한시간 없이 값 반환',async()=>assert.equal(await withDeadline(Promise.resolve('완료'),{timeoutMs:100}),'완료'));
test('압축 PDF Worker 복원과 크기 검증',async()=>{const raw=await fs.readFile(path.join(root,'site-demo/dist/vendor/pdf.worker.mjs')),packed=await fs.readFile(path.join(root,'site-demo/dist/vendor/pdf-worker.gz.bin'));assert.deepEqual(gunzipSync(packed),raw);assert.ok(packed.length<500000);});
test('PDF 없이 명단만으로 부서 목록·중복 제거',()=>{const sheets=[{name:'Sheet1',rows:[['소속','직급','성명'],['디지털정책과','전산9급','가상1'],['노인복지과','사회복지8급','가상2'],['노인복지과','사회복지6급','가상3']]}];assert.deepEqual(listDepartments(sheets),['디지털정책과','노인복지과']);});
test('부분어·따옴표·내부 공백은 검색에만 사용',()=>{const departments=['디지털정책과','노인복지과'];for(const query of ['노인',"노인'",'노 인복지과',' “노 인” '])assert.deepEqual(searchDepartments(departments,query),['노인복지과']);});
test('여러 후보와 미발견은 임의 선택 금지',()=>{const departments=['노인복지과','노인시설과'];assert.equal(searchDepartments(departments,'노인').length,2);assert.deepEqual(searchDepartments(departments,'없는부서'),[]);assert.throws(()=>requireDepartmentChoice(departments,'노인'));assert.throws(()=>requireDepartmentChoice(departments,''));});
test('공식 선택값으로 참석자와 3컬럼 명부 함께 매칭',()=>{const departments=['노인복지과'];const selected=requireDepartmentChoice(departments,'노인복지과');const sheets=[{name:'Sheet1',rows:[['소속','직급','성명'],['노인복지과','사회복지8급','가상직원']]}];const a=filterAttendees(sheets,selected).attendees[0];const directory=employeeDirectory([{rows:[['부서','성명','개인식별번호'],['노인복지과','가상직원','TEST001']]}]);assert.equal(lookupEmployee(directory,a.department,a.name).employee_id,'TEST001');assert.throws(()=>requireDepartmentChoice(departments,'노 인복지과'));});
test('기본 부서는 실제 목록에 있을 때만 선택',()=>{assert.equal(initialDepartment(['노인복지과','디지털정책과']),'디지털정책과');assert.equal(initialDepartment(['노인복지과']),'');assert.equal(initialDepartment([]),'');});

// 가상 문서로 ODT 읽기와 오류 처리를 검증한다.
const {extractOdt,extractNotice}=await import('../dist/notice-reader.js');
async function odtFile(body,mime='application/vnd.oasis.opendocument.text'){
 const z=new JSZip();z.file('mimetype',mime);z.file('content.xml',body);
 const data=await z.generateAsync({type:'uint8array'});return {name:'test.odt',arrayBuffer:async()=>data};
}
const odtXml=text=>`<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${text}</office:text></office:body></office:document-content>`;
test('ODT 본문에서 PDF와 같은 교육정보 추출',async()=>{const n=await extractNotice(await odtFile(odtXml(noticeText.split('\n').map(t=>`<text:p>${t}</text:p>`).join(''))));assert.deepEqual(withoutEvidence(n),parseNotice(noticeText));});
test('ODT 명시적 공백·탭·줄바꿈 읽기',async()=>{const text=noticeText.replace('교 육 명','교<text:s/>육<text:s/>명').replace('교육장소 :','교육장소<text:tab/>:');const n=await extractOdt(await odtFile(odtXml('<text:p>'+text.replaceAll('\n','<text:line-break/>')+'</text:p>')));assert.equal(n.date,'2026-09-21');assert.equal(n.name,'2026년 경주시청 소방교육');});
test('ODT 이미지 전용·잘못된 형식·외부 엔티티 거부',async()=>{
 await assert.rejects(()=>extractOdt({name:'bad.odt',arrayBuffer:async()=>new Uint8Array([1,2])}));
 const empty=await odtFile(odtXml(''));await assert.rejects(()=>extractOdt(empty),/글자를 찾지/);
 const badMime=await odtFile(odtXml(''),'wrong');await assert.rejects(()=>extractOdt(badMime),/올바른 ODT/);
 const entity=await odtFile('<!DOCTYPE x>'+odtXml(''));await assert.rejects(()=>extractOdt(entity),/XML 선언/);
});

const {extractHwpx}=await import('../dist/notice-reader.js');
const hwpxXml=body=>`<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${body}</hs:sec>`;
const hwpxParagraph=t=>`<hp:p><hp:run><hp:t>${t}</hp:t></hp:run></hp:p>`;
async function hwpxFile(sections,mime='application/hwp+zip'){
 const z=new JSZip();z.file('mimetype',mime);for(const [name,body]of Object.entries(sections))z.file(name,hwpxXml(body));
 const bytes=await z.generateAsync({type:'uint8array'});return {name:'sample.hwpx',arrayBuffer:async()=>bytes};
}
test('HWPX 구역 순서·표 내부 문단·분리된 run 읽기',async()=>{
 const lines=noticeText.split('\n');
 const file=await hwpxFile({'Contents/section10.xml':lines.slice(3).map(hwpxParagraph).join(''),'Contents/section2.xml':lines.slice(0,3).map(hwpxParagraph).join('')});
 assert.deepEqual(withoutEvidence(await extractNotice(file)),parseNotice(noticeText));
 const table=await hwpxFile({'Contents/section0.xml':'<hp:p><hp:run><hp:tbl><hp:tr><hp:tc>'+lines.map(hwpxParagraph).join('')+'</hp:tc></hp:tr></hp:tbl></hp:run></hp:p>'});
 assert.deepEqual(withoutEvidence(await extractHwpx(table)),parseNotice(noticeText));
 const split=await hwpxFile({'Contents/section0.xml':lines.map(t=>hwpxParagraph(t).replace('2026년 경주시청','2026년</hp:t></hp:run><hp:run><hp:t> 경주시청')).join('')});
 assert.equal((await extractHwpx(split)).name,'2026년 경주시청 소방교육');
 const out=path.join(root,'site-demo/test-output');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'synthetic-notice.hwpx'),await split.arrayBuffer());
});
test('HWPX 잘못된 형식·본문 없음·이미지·XML 선언 거부',async()=>{
 const wrong=await hwpxFile({},'wrong');await assert.rejects(()=>extractHwpx(wrong),/올바른 HWPX/);
 const missing=await hwpxFile({});await assert.rejects(()=>extractHwpx(missing),/본문 구역/);
 const empty=await hwpxFile({'Contents/section0.xml':'<hp:p/>'});await assert.rejects(()=>extractHwpx(empty),/글자를 찾지/);
 const entity=await hwpxFile({'Contents/section0.xml':'<!ENTITY bad "x">'});await assert.rejects(()=>extractHwpx(entity),/XML 선언/);
 assert.throws(()=>extractNotice({name:'sample.hwp'}),/아직 지원하지/);
});
test('HWPX 결과도 기존 수식·대상자·빈셀 규칙으로 생성',async()=>{
 const file=await hwpxFile({'Contents/section0.xml':noticeText.split('\n').map(hwpxParagraph).join('')});
 const a=analysis();a.notice=await extractHwpx(file);
 const b=await readWorkbook(await generateExcel(template,a,{required:'N',welfare:'N',participation:'0'}));
 const sheet=b.sheets.find(s=>s.name==='Sheet1');assert.equal(sheet.rows.length,3);assert.equal(sheet.rows[1][0],'김지현');assert.equal(sheet.rows[2][0],'문형식');assert.equal(sheet.rows[1][14],null);assert.match(await b.zip.file(sheet.file).async('string'),/MATCH\(C3,/);
});

const {fileError}=await import('../dist/file-validation.js');
test('파일 형식: 공문·명단·번호 명부 즉시 검증',()=>{
 for(const ext of ['pdf','odt','hwpx'])assert.equal(fileError('notice',{name:'test.'+ext,size:1}),'');
 assert.match(fileError('notice',{name:'test.hwp',size:1}),/HWPX 또는 PDF/);
 for(const field of ['attendees','employees']){assert.match(fileError(field,{name:'test.pdf',size:1}),/xlsx/);assert.equal(fileError(field,{name:'test.XLSX',size:1}),'');}
 assert.match(fileError('notice',{name:'test.pdf',size:0}),/빈 파일/);assert.match(fileError('notice',{name:'test.pdf',size:21*1024*1024}),/20MB/);assert.equal(fileError('employees',null),'');
});

const {dropError,attachFileDrop,preventFileNavigation}=await import('../dist/file-drop.js');
test('끌어놓기: 단일 파일 허용·복수 파일과 폴더 거부',()=>{
 assert.equal(dropError([{}]),'');assert.match(dropError([]),/한 개씩/);assert.match(dropError([{},{}]),/한 개씩/);
 assert.match(dropError([{}],[{webkitGetAsEntry:()=>({isDirectory:true})}]),/폴더/);
});
test('끌어놓기: change 연결·처리 중 차단·영역 밖 탐색 방지',()=>{
 const handlers={},classes=new Set();const card={addEventListener:(n,f)=>handlers[n]=f,classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)}};
 let changed=0,error='';const input={disabled:false,dispatchEvent:e=>{assert.equal(e.type,'change');changed++;}};
 const old=globalThis.DataTransfer;globalThis.DataTransfer=class{files=[];items={add:f=>this.files.push(f)}};
 try{
 attachFileDrop(card,input,e=>error=e);const file={name:'notice.hwpx'};let prevented=0;const e={preventDefault:()=>prevented++,dataTransfer:{files:[file],items:[]}};
 handlers.dragenter(e);assert.ok(classes.has('drag-over'));handlers.drop(e);assert.equal(input.files[0],file);assert.equal(changed,1);assert.equal(classes.size,0);
 handlers.drop({...e,dataTransfer:{files:[file,file]}});assert.match(error,/한 개씩/);assert.equal(changed,1);
 input.disabled=true;handlers.drop(e);assert.equal(changed,1);assert.ok(prevented>=3);
 const outside={};preventFileNavigation({addEventListener:(n,f)=>outside[n]=f});let blocked=false;outside.drop({dataTransfer:{types:['Files']},preventDefault:()=>blocked=true});assert.equal(blocked,true);
 }finally{globalThis.DataTransfer=old;}
});

test('참석자 명단: 부서/소속 + 이름/성명 두 컬럼 지원',()=>{
 for(const dept of ['소속','부서'])for(const name of ['성명','이름']){
 const sheets=[{name:'Sheet1',rows:[[dept,name],['디지털정책과','김지현'],['경제정책과','김지현'],['디지털정책과','문형식']]}];
 assert.deepEqual(listDepartments(sheets),['디지털정책과','경제정책과']);const roster=filterAttendees(sheets,'디지털정책과');assert.equal(roster.attendees.length,2);assert.ok(roster.attendees.every(a=>a.status==='대상 부서 일치'&&a.rank===''));
 }
});
test('직급 없이도 동명이인·성명 누락은 확인 대상으로 유지',()=>{
 const roster=filterAttendees([{name:'S',rows:[['부서','이름'],['디지털정책과','김지현'],['디지털정책과','김지현'],['디지털정책과','']]}],'디지털정책과');
 assert.equal(roster.attendees[0].status,'동명이인 확인 필요');assert.match(roster.attendees[2].status,/성명 누락/);
 assert.throws(()=>listDepartments([{name:'S',rows:[['부서','소속','이름']]}]),/하나로 확인/);
});

test('학습유형·날짜만 있는 공문·장소 미기재 허용',()=>{
 const text=noticeText.replace('교육유형','학습유형').replace('10:00 ~ 12:00','').replace('3. 교육장소 : 경주시청 대회의실\n','');const n=parseNotice(text);assert.equal(n.hours,2);assert.equal(n.date,'2026-09-21');assert.equal(n.start,null);assert.equal(n.place,null);
 assert.throws(()=>parseNotice(text.replace('학습유형','학습유힝')),/교육유형/);
 assert.throws(()=>parseNotice(text+'\n7. 교육유형 : 다른 유형'),/하나로 확인/);
});

function withoutEvidence(n){const {candidates,source_text,start_date,end_date,...value}=n;return value;}
const {extractCandidates,validReview}=await import('../dist/notice-review.js');
test('후보 추출: 참석일시·누락 항목·모호한 날짜·시행일 제외',()=>{
 const n=extractCandidates('시행일: 2026. 9. 1.\n참석일시: 2026. 9. 22.\n인정시간: 2시간\n학습유형: 공식 유형');assert.equal(n.date,'2026-09-22');assert.equal(n.hours,2);assert.equal(n.name,null);assert.equal(n.candidates.date[0].evidence,'참석일시: 2026. 9. 22.');
 const multi=extractCandidates('교육일: 2026.9.21.\n참석일시: 2026.9.22.');assert.equal(multi.date,null);assert.equal(multi.candidates.date.length,2);
 assert.equal(extractCandidates('접수일: 2026.9.21.').date,null);assert.equal(extractCandidates('교육일: 2026.2.30.').date,null);
 assert.equal(validReview({...n,name:'교육'}),true);assert.equal(validReview({...n,name:'교육',minutes:60}),false);
});

const {uploadIssues}=await import('../dist/file-validation.js');
test('분석 클릭 검증: 필수 공문·명단 안내, 번호 명부 선택 유지',()=>{
 assert.deepEqual(uploadIssues({}).map(i=>i.name),['notice','attendees']);
 const files={notice:{name:'notice.pdf',size:1},attendees:{name:'list.xlsx',size:1}};
 assert.equal(uploadIssues(files).length,0);
 assert.deepEqual(uploadIssues({...files,employees:{name:'bad.txt',size:1}}).map(i=>i.name),['employees']);
 assert.deepEqual(uploadIssues({...files,notice:null}).map(i=>i.name),['notice']);
});

const {checkPassword}=await import('../dist/demo-access.js');
const {pbkdf2Sync}=await import('node:crypto');
test('시연 암호: 올바른 암호·오입력·한글 검증',async()=>{
 const salt='0123456789abcdef0123456789abcdef',password='가상테스트-only';const config={salt,iterations:210000,digest:pbkdf2Sync(password,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex')};
 assert.equal(await checkPassword(password,config),true);assert.equal(await checkPassword('wrong',config),false);
});

const {PDF_WORKER_COMPAT}=await import('../dist/pdf-reader.js');
const {runInNewContext}=await import('node:vm');
test('구형 브라우저 PDF Worker: toHex 부재 호환 및 기존 함수 유지',()=>{
 assert.equal(runInNewContext("delete Uint8Array.prototype.toHex;"+PDF_WORKER_COMPAT+"new Uint8Array([0,15,16,255]).toHex()"),'000f10ff');
 assert.equal(runInNewContext("Uint8Array.prototype.toHex=function(){return 'native';};"+PDF_WORKER_COMPAT+"new Uint8Array().toHex()"),'native');
});

const {workflowStep}=await import('../dist/progress.js');
test('진행 표시: 첨부→분석→확인→생성 및 재수정·초기화',()=>{
 assert.equal(workflowStep(),0);assert.equal(workflowStep({busy:true}),1);
 assert.equal(workflowStep({hasAnalysis:true}),1);
 assert.equal(workflowStep({hasAnalysis:true,reviewConfirmed:true}),2);
 assert.equal(workflowStep({hasAnalysis:true,reviewConfirmed:true,hasResult:true}),3);
 assert.equal(workflowStep({hasAnalysis:true,reviewConfirmed:true,hasResult:false}),2);
 assert.equal(workflowStep({hasAnalysis:true,reviewConfirmed:false}),1);assert.equal(workflowStep({hasAnalysis:false}),0);
});

const {autoMapping}=await import('../dist/column-mapping.js');
test('컬럼 연결: 알려진 부서명 별칭 자동 연결·모호한 헤더 수동 전환',()=>{
 for(const dept of ['부서명','소속부서']){const sheets=[{name:'S',rows:[[dept,'이름'],['디지털정책과','김지현']]}];assert.equal(autoMapping(sheets).departmentColumn,0);assert.equal(listDepartments(sheets)[0],'디지털정책과');}
 assert.equal(autoMapping([{name:'S',rows:[['부서','소속','성명']]}]),null);
});
test('컬럼 연결: 다른 시트·머리글 행·알 수 없는 이름·원본 행 유지',()=>{
 const sheets=[{name:'안내',rows:[['설명']]},{name:'출석부',rows:[['제목'],['조직단위','참여자','등급'],['디지털정책과','김지현','9급'],['다른부서','김지현','6급']]}];
 const mapping={sheetIndex:1,headerRow:1,departmentColumn:0,nameColumn:1,rankColumn:2};
 assert.equal(autoMapping(sheets),null);assert.deepEqual(listDepartments(sheets,mapping),['디지털정책과','다른부서']);const r=filterAttendees(sheets,'디지털정책과',mapping);assert.equal(r.attendees.length,1);assert.equal(r.attendees[0].row,3);assert.equal(r.attendees[0].rank,'9급');
 assert.throws(()=>listDepartments(sheets,{...mapping,nameColumn:0}),/서로 다른/);assert.throws(()=>listDepartments(sheets,{...mapping,headerRow:99}),/머리글/);assert.throws(()=>listDepartments(sheets,{...mapping,rankColumn:1}),/직급/);
});

const {mappingChoices}=await import('../dist/column-mapping.js');
test('간소화 명단: 공백 머리글 자동 인식',()=>{
 for(const dept of ['부서','부서명','부 서','부 서 명','소속','소 속 부 서'])for(const name of ['성명','성 명','이름','이 름']){
 const sheets=[{name:'명단',rows:[['제목'],[dept,name],['디지털정책과','가상직원']]}];
 assert.equal(autoMapping(sheets).headerRow,1);assert.equal(filterAttendees(sheets,'디지털정책과').attendees.length,1);
 }
});
test('간소화 명단: 누락·알 수 없는 머리글은 파일 교체 안내',()=>{
 for(const rows of [[['부서','참여자']],[['조직','이름']],[['조직','참여자']]]){
 const result=mappingChoices([{name:'S',rows}]);assert.equal(result.candidates.length,0);assert.match(result.message,/수정하거나 교체/);
 }
 const separate=mappingChoices([{name:'S',rows:[['부서'],['이름']]}]);assert.equal(separate.candidates.length,0);assert.match(separate.message,/같은 머리글 행/);
});
test('간소화 명단: 중복 컬럼·다중 시트는 후보만 제시',()=>{
 const result=mappingChoices([{name:'S',rows:[['부서','소속','성명']]}]);assert.equal(result.candidates.length,2);assert.equal(autoMapping([{name:'S',rows:[['부서','소속','성명']]}]),null);
 for(const m of result.candidates)assert.doesNotThrow(()=>listDepartments([{name:'S',rows:[['부서','소속','성명']]}],m));
 assert.equal(mappingChoices([{name:'A',rows:[['부서','이름']]},{name:'B',rows:[['소속','성명']]}]).candidates.length,2);
});

test('교육명 보완: 본문 우선·문서 제목 추정·파일명 추정',()=>{
 const title='2026 경주 AI·AX대전환 시민포럼 참석자 상시학습 인정 알림';
 assert.equal(extractCandidates('제목: 소방교육').name,'소방교육');
 const a=extractCandidates('제 목 : '+title);assert.equal(a.name,'2026 경주 AI·AX대전환 시민포럼');assert.equal(a.candidates.name[0].source,'document_title');assert.equal(a.candidates.name[0].inferred,true);
 const b=extractCandidates('교육명: 명시된 소방교육\n제목: '+title,{filename:'다른포럼.pdf'});assert.equal(b.name,'명시된 소방교육');assert.equal(b.candidates.name.length,1);
 const c=extractCandidates('참석일시: 2026. 9. 21.',{filename:'(샘플)2026년_경주시청_소방교육_상시학습_인정_알림.hwpx'});assert.equal(c.name,'2026년 경주시청 소방교육');assert.equal(c.candidates.name[0].source,'filename');
});
test('교육명 보완: 일반 제목·모호한 제목·다중 본문은 임의 확정 금지',()=>{
 for(const title of ['교육실적 인정 안내','교육실적 인정 알림','교육 안내','상시학습 인정 알림','문서'])assert.equal(extractCandidates('제목: '+title).name,null);
 assert.equal(extractCandidates('제목: 교육실적 인정 안내',{filename:'소방교육.pdf'}).name,null);
 assert.equal(extractCandidates('제목: 경주시 소방교육 안내\n제목: 경주시 안전교육 안내').name,null);
 assert.equal(extractCandidates('교육명: 소방교육\n교육명: 안전교육',{filename:'경주시 소방교육.pdf'}).name,null);
});

const {parseDuration,personDuration,rosterDurationColumns}=await import('../dist/durations.js');
test('개인시간: 단위·분·소수시간 검증',()=>{
 assert.deepEqual(parseDuration('2시간 30분'),{hours:2,minutes:30});assert.deepEqual(parseDuration(2.5,'hours'),{hours:2,minutes:30});assert.deepEqual(parseDuration(150,'minutes'),{hours:2,minutes:30});
 for(const v of ['',3,'-1시간','2시간 60분','0시간','2시간 3분 기타'])assert.equal(parseDuration(v),null);
});
test('개인시간: 인정시간 우선·교육시간 대체·빈칸은 공통값 대입 금지',()=>{
 const sheets=[{name:'S',rows:[['부서','성명','교육시간(시간)','인정시간'],['디지털정책과','가상A',5,'2시간 30분'],['디지털정책과','가상B',4,'']]}];
 const people=filterAttendees(sheets,'디지털정책과').attendees;
 assert.equal(personDuration(people[0],{hours:3,minutes:0}).hours,2);assert.equal(personDuration(people[1],{hours:3,minutes:0}).valid,false);
 assert.deepEqual(rosterDurationColumns(['교육 시간 (시간)']),[{index:0,label:'교육시간(시간)',unit:'hours'}]);
 assert.equal(personDuration({}, {hours:3,minutes:0}).source,'공문 공통값');
 assert.equal(personDuration({duration_input:{raw:'3',unit:''}},{hours:2,minutes:0}).hours,3);
 assert.equal(personDuration({duration_input:{ambiguous:true,raw:'2시간'}},{hours:2,minutes:0}).valid,false);
 people[1].duration_override={hours:1,minutes:30};assert.equal(personDuration(people[1],{}).valid,true);people[1].duration_pending=true;assert.equal(personDuration(people[1],{}).valid,false);
});
test('공문 시간: 차수별 시간 후보·복수 시간 불확정·근거 유지',()=>{
 const n=extractCandidates('차수별3시간 인정');assert.equal(n.hours,3);assert.equal(n.minutes,0);assert.match(n.candidates.hours[0].evidence,/차수당/);
 assert.equal(extractCandidates('차수별 3시간 인정\n인정시간: 2시간').hours,null);
 assert.equal(extractCandidates('차수별 0시간 인정').hours,null);
});
test('개인시간 Excel: H/I 개별 출력·빈값 차단·수정 후 출력',async()=>{
 const a=analysis();a.roster.attendees[0].duration_input={label:'인정시간',raw:'2시간 30분',unit:''};a.roster.attendees[1].duration_input={label:'교육시간(시간)',raw:1.5,unit:'hours'};
 const choices={required:'N',welfare:'N',participation:'0'};
 let b=await readWorkbook(await generateExcel(template,a,choices));let rows=b.sheets.find(s=>s.name==='Sheet1').rows;assert.deepEqual(rows.slice(1).map(r=>r.slice(7,9)),[[2,30],[1,30]]);
 a.roster.attendees[1].duration_input.raw='';await assert.rejects(()=>generateExcel(template,a,choices),/개인별 인정시간/);
 a.roster.attendees[1].duration_override={hours:1,minutes:0};b=await readWorkbook(await generateExcel(template,a,choices));rows=b.sheets.find(s=>s.name==='Sheet1').rows;assert.deepEqual(rows[2].slice(7,9),[1,0]);assert.equal(rows[2][14],null);
});

test('시간 별칭: 모든 내부 공백·이수시간·인증시간·단위 인식',()=>{
 for(const alias of ['인정시간','이수시간','인증시간','교육시간'])for(const header of [alias,[...alias].join(' '),[...alias].join('  ')]){
 const sheets=[{name:'S',rows:[['부서','이름',header],['디지털정책과','가상직원','2시간 30분']]}];const person=filterAttendees(sheets,'디지털정책과').attendees[0];const duration=personDuration(person,{hours:9,minutes:0});assert.equal(duration.hours,2);assert.equal(duration.minutes,30);
 if(alias==='인증시간')assert.match(duration.source,/오타로 간주/);
 const column=rosterDurationColumns([header+' ( 시 간 )'])[0];assert.equal(column.unit,'hours');assert.deepEqual(parseDuration(1.5,column.unit),{hours:1,minutes:30});
 const notice=extractCandidates(header+': 2시간 30분');assert.equal(notice.hours,2);assert.equal(notice.minutes,30);
 }
});
test('시간 별칭: 동의어 중복은 차단·교육시간보다 실적시간 우선',()=>{
 const row=['부서','성명','교육시간','이 수 시 간'];assert.equal(rosterDurationColumns(row)[0].index,3);
 const sheets=[{name:'S',rows:[['부서','이름','인정시간','이수시간'],['디지털정책과','가상직원','2시간','3시간']]}];assert.equal(personDuration(filterAttendees(sheets,'디지털정책과').attendees[0],{hours:9,minutes:0}).valid,false);
 assert.match(extractCandidates('인 증 시 간: 3시간').candidates.hours[0].evidence,/오타로 간주/);
});

const {learningMethod,LEARNING_METHODS}=await import('../dist/methods.js');
const {registrationPlan}=await import('../dist/durations.js');
test('학습방법: 네 가지와 공백 별칭·미지원 값',()=>{
 assert.deepEqual(LEARNING_METHODS.map(m=>m.code),[1,2,3,4]);
 for(const [name,code]of [['집합교육',1],['집 합 과 정',1],['사이버교육',2],['사이버과정',2],['집합 ＋ 사이버과정',3],['기타',4]])assert.equal(learningMethod(name).code,code);
 assert.equal(learningMethod('알 수 없는 방법'),null);
});
test('등록계획: 0시간 제외와 빈칸·수정대기·동명이인 사유 구분',()=>{
 const people=[{name:'가상A',row:2,status:'대상 부서 일치',duration_input:{raw:'0',unit:''}},{name:'가상B',row:3,status:'대상 부서 일치',duration_input:{raw:'1시간',unit:''}},{name:'가상C',row:4,status:'대상 부서 일치',duration_input:{raw:'',unit:''}}];
 let plan=registrationPlan(people,{date:'2026-09-21'});assert.equal(plan.excluded.length,1);assert.equal(plan.included.length,1);assert.match(plan.issues[0],/가상C.*4행.*빈칸/);
 plan=registrationPlan(people.slice(0,1),{});assert.match(plan.issues[0],/모든 대상자.*0시간/);
 people[1].duration_pending=true;assert.match(registrationPlan(people.slice(1,2),{date:'2026-09-21'}).issues[0],/수정한 시간 적용/);
 delete people[1].duration_pending;people[1].status='동명이인 확인 필요';assert.match(registrationPlan(people.slice(1,2),{date:'2026-09-21'}).issues[0],/가상B.*동명이인/);
 assert.equal(parseDuration('0'),null);assert.deepEqual(parseDuration('0','',true),{hours:0,minutes:0});
});
test('Excel: 네 가지 J열 코드·0시간 제외 후 연속 행/수식·전체 0 차단',async()=>{
 for(const method of LEARNING_METHODS){const a=analysis();a.notice.method=method.name;
 a.roster.attendees[0].duration_input={label:'이수시간',raw:'0시간',unit:''};a.roster.attendees[1].duration_input={label:'이수시간',raw:'1시간 30분',unit:''};
 const choices={required:'N',welfare:'N',participation:'0'},result=await readWorkbook(await generateExcel(template,a,choices)),sheet=result.sheets.find(s=>s.name==='Sheet1');
 assert.equal(sheet.rows.length,2);assert.equal(sheet.rows[1][0],'문형식');assert.equal(sheet.rows[1][9],method.code);assert.deepEqual(sheet.rows[1].slice(7,9),[1,30]);
 const cell=Array.from(sheet.doc.getElementsByTagNameNS('*','c')).find(c=>c.getAttribute('r')==='D2');assert.match(cell.textContent,/MATCH\(C2,/);
 a.roster.attendees[1].duration_input.raw='0분';await assert.rejects(()=>generateExcel(template,a,choices),/모든 대상자/);
 }
});

test('검토 화면: 개인시간이면 공통입력 숨김·네 방법 선택·빈 공통시간으로 확인',async()=>{
 const {createReview}=await import('../dist/notice-review.js'),old=globalThis.document;
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.events={};this.value='';this.classList={add(){},toggle(){}};}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}setAttribute(){}addEventListener(name,fn){this.events[name]=fn;}scrollIntoView(){}focus(){}}
 const nodes=[];globalThis.document={createElement(tag){const e=new Element(tag);nodes.push(e);return e;}};
 try{let confirmed;const notice={...demoData().notice,hours:null,minutes:null};createReview({...notice,date:null},types,types[0],v=>confirmed=v,{individualTimes:true,individualDates:true});
 const hours=nodes.find(n=>n.name==='hours'),minutes=nodes.find(n=>n.name==='minutes'),method=nodes.find(n=>n.name==='method');
 assert.equal(nodes.find(n=>n.name==='start_date').disabled,true);assert.equal(nodes.find(n=>n.name==='end_date').disabled,true);assert.equal(hours.disabled,true);assert.equal(minutes.disabled,true);assert.ok(nodes.some(n=>n.children.includes(hours)&&n.hidden));assert.equal(method.children.length,5);
 method.value='사이버과정';nodes.find(n=>n.id==='confirm-education').events.click();assert.equal(confirmed.notice.hours,null);assert.equal(confirmed.notice.minutes,null);assert.equal(confirmed.notice.method,'사이버과정');
 }finally{globalThis.document=old;}
});

test('단위 없는 명단 숫자: 시간 기본값·분 예외·소수시간 H/I 출력',async()=>{
 for(const alias of ['인정시간','이수시간','교육시간','인증시간']){
 const sheets=[{name:'S',rows:[['부서','성명',alias],['디지털정책과','가상A',2],['디지털정책과','가상B','2.5'],['디지털정책과','가상C',0],['디지털정책과','가상D','']]}];
 const people=filterAttendees(sheets,'디지털정책과').attendees;
 assert.deepEqual(people.slice(0,3).map(p=>{const d=personDuration(p,{});return [d.hours,d.minutes];}),[[2,0],[2,30],[0,0]]);assert.equal(personDuration(people[3],{}).valid,false);
 const a=analysis();a.roster.attendees=people.slice(0,3).map(p=>({...p,employee_lookup:{status:'no_file'}}));const book=await readWorkbook(await generateExcel(template,a,{required:'N',welfare:'N',participation:'0'}));assert.deepEqual(book.sheets.find(s=>s.name==='Sheet1').rows.slice(1).map(r=>r.slice(7,9)),[[2,0],[2,30]]);
 }
 const sheets=[{name:'S',rows:[['부서','名前','성명','이 수 시 간 ( 분 )'],['디지털정책과','','가상A',90]]}];const d=personDuration(filterAttendees(sheets,'디지털정책과').attendees[0],{});assert.deepEqual([d.hours,d.minutes],[1,30]);
 assert.deepEqual(parseDuration('30분','hours'),{hours:0,minutes:30});assert.equal(parseDuration('-2','hours'),null);assert.equal(parseDuration('잘못된 값','hours'),null);
});

const {readDate,readPeriod,personDates,noticePeriod}=await import('../dist/dates.js');
test('날짜: 공문 기간·시작/종료 별칭·하루·연도 생략',()=>{
 for(const text of ['교육기간: 2026. 9. 21. ~ 9. 23.','학 습 기 간: 2026-09-21 ~ 2026-09-23','교육시작일: 2026.9.21.\n학습 종료: 2026.9.23.']){
 const n=extractCandidates(text);assert.equal(n.start_date,'2026-09-21');assert.equal(n.end_date,'2026-09-23');
 }
 const one=extractCandidates('교육일: 2026.9.21.');assert.equal(one.start_date,one.end_date);assert.equal(one.start_date,'2026-09-21');
 assert.deepEqual(readPeriod('2026. 9. 21. ~ 23.'),{start:'2026-09-21',end:'2026-09-23'});
 assert.equal(readPeriod('2026.9.23. ~ 21.'),null);assert.equal(readDate('2026.2.30.'),null);
 assert.equal(readDate(46286),'2026-09-21');assert.equal(readDate(46286-1462,true),'2026-09-21');
 const conflict=noticePeriod('교육기간: 2026.9.21. ~ 9.23.\n학습시작일: 2026.9.22.');assert.equal(conflict.start,null);
});
test('날짜: 명단 우선·없는 경우만 공문·빈칸/충돌/중복/역전 차단',()=>{
 const n={date:'2026-09-21',start_date:'2026-09-21',end_date:'2026-09-23'};
 const sheets=[{name:'S',rows:[['부서','이름','학 습 시 작','교육종료일'],['디지털정책과','가상A','2026.9.22.','2026.9.23.'],['디지털정책과','가상B','2026.9.22.','']]}];
 const people=filterAttendees(sheets,'디지털정책과').attendees;assert.equal(personDates(people[0],n).start,'2026-09-22');assert.equal(personDates(people[1],n).valid,false);
 assert.equal(personDates({},n).end,'2026-09-23');
 const p=fields=>({date_input:{fields}});
 assert.equal(personDates(p([{kind:'start',label:'교육시작일',raw:'2026-09-22'}]),n).end,'2026-09-22');
 assert.equal(personDates(p([{kind:'start',raw:'2026-09-24'},{kind:'end',raw:'2026-09-23'}]),n).valid,false);
 assert.equal(personDates(p([{kind:'single',raw:'2026-09-22'},{kind:'period',raw:'2026.9.21.~9.23.'}]),n).valid,false);
 assert.equal(personDates(p([{kind:'start',raw:'2026-09-22'},{kind:'start',raw:'2026-09-22'}]),n).valid,false);
 assert.equal(personDates({date_pending:true},n).valid,false);
});
test('Excel 날짜: 공문기간·개인별 F/G·하루·날짜 오류 차단',async()=>{
 const a=analysis();a.notice.start_date='2026-09-21';a.notice.end_date='2026-09-23';a.roster.attendees[0].date_input={fields:[{kind:'start',label:'학습시작일',raw:46287},{kind:'end',label:'학습종료일',raw:46288}]};
 const choices={required:'N',welfare:'N',participation:'1'},book=await readWorkbook(await generateExcel(template,a,choices)),rows=book.sheets.find(s=>s.name==='Sheet1').rows;
 assert.deepEqual(rows.slice(1).map(r=>r.slice(5,7)),[[46287,46288],[46286,46288]]);assert.deepEqual(rows[1].slice(7,9),[2,0]);
 a.roster.attendees[0].date_input.fields[1].raw='';await assert.rejects(()=>generateExcel(template,a,choices),/김지현.*날짜 빈칸/);
 a.roster.attendees[0].date_override={start:'2026-09-21',end:'2026-09-21'};const b=await readWorkbook(await generateExcel(template,a,choices));assert.deepEqual(b.sheets.find(s=>s.name==='Sheet1').rows[1].slice(5,7),[46286,46286]);
});
