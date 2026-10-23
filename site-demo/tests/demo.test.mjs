import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';
import JSZip from 'jszip';
import {gunzipSync} from 'node:zlib';
import {withDeadline} from '../dist/async-utils.js';
import {parseNotice,filterAttendees,employeeDirectory,lookupEmployee,matchType,demoData} from '../dist/core.js';
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
test('공개 UI 안내와 브라우저 내부 처리',async()=>{const html=await fs.readFile(path.join(root,'site-demo/dist/index.html'),'utf8'),app=await fs.readFile(path.join(root,'site-demo/dist/app.js'),'utf8');assert.ok(html.includes('실제 개인정보 및 내부자료를 업로드하지 마세요.'));assert.ok(html.includes('샘플 데이터로 체험'));assert.ok(!app.includes('POST'));assert.ok(!app.includes('localStorage'));});
test('노인복지는 자동 매칭 없이 노인복지과 안내',()=>{const sheets=[{name:'Sheet1',rows:[['소속','직급','성명'],['노인복지과','사회복지8급','가상직원1'],['노인복지과','사회복지6급','가상직원2']]}];const partial=filterAttendees(sheets,'노인복지');assert.equal(partial.attendees.length,0);assert.deepEqual(partial.suggestions,['노인복지과']);assert.equal(filterAttendees(sheets,'노인복지과').attendees.length,2);});
test('끝나지 않는 분석도 제한시간 후 종료',async()=>{let stopped=false;await assert.rejects(withDeadline(new Promise(()=>{}),{label:'공문 PDF',timeoutMs:10,onStop:()=>{stopped=true;}}),/처리 시간이 초과/);assert.equal(stopped,true);});
test('분석 중 취소가 즉시 끝남',async()=>{const c=new AbortController();const pending=withDeadline(new Promise(()=>{}),{signal:c.signal});c.abort();await assert.rejects(pending,/취소/);});
test('정상 작업은 제한시간 없이 값 반환',async()=>assert.equal(await withDeadline(Promise.resolve('완료'),{timeoutMs:100}),'완료'));
test('압축 PDF Worker 복원과 크기 검증',async()=>{const raw=await fs.readFile(path.join(root,'site-demo/dist/vendor/pdf.worker.mjs')),packed=await fs.readFile(path.join(root,'site-demo/dist/vendor/pdf-worker.gz.bin'));assert.deepEqual(gunzipSync(packed),raw);assert.ok(packed.length<500000);});
