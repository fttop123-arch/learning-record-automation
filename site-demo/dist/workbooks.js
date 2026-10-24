import {learningMethod} from './methods.js?v=20261024-review-flow';
import {personDuration,registrationPlan} from './durations.js?v=20261024-review-flow';
/* XLSX 원본 ZIP의 필요한 셀만 변경. 외부 서버 요청이나 파일 저장 API 없음. */
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const els=(node,name)=>Array.from(node.getElementsByTagNameNS(MAIN,name));
function xml(text){if(text.includes('<!DOCTYPE'))throw Error('지원하지 않는 XML 형식입니다.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Excel XML 구조를 읽을 수 없습니다.');return doc;}
const textOf=(node,name)=>els(node,name)[0]?.textContent??'';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function columnIndex(ref){let n=0;for(const c of ref.match(/^[A-Z]+/)[0])n=n*26+c.charCodeAt(0)-64;return n-1;}
function pathFor(target){const stack=[];for(const p of (target.startsWith('/')?target:'xl/'+target).split('/')){if(p==='..')stack.pop();else if(p&&p!=='.')stack.push(p);}return stack.join('/');}
export async function readWorkbook(data){
 const zip=await globalThis.JSZip.loadAsync(data);const shared=zip.file('xl/sharedStrings.xml')?els(xml(await zip.file('xl/sharedStrings.xml').async('string')),'si').map(si=>els(si,'t').map(t=>t.textContent).join('')):[];
 const workbook=xml(await zip.file('xl/workbook.xml').async('string'));
 const rels=xml(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
 const targets=Object.fromEntries(Array.from(rels.getElementsByTagName('Relationship')).map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const sheets=[];
 for(const sheet of els(workbook,'sheet')){
  const target=targets[sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')];
  if(!target||target.includes('://'))throw Error('지원하지 않는 Excel 시트 참조입니다.');
  const file=pathFor(target),doc=xml(await zip.file(file).async('string')),rows=[];
  for(const row of els(doc,'row')){
   const index=Number(row.getAttribute('r'))-1;if(index<0||index>100000)throw Error('지원하는 명단 행 수를 초과했습니다.');
   const values=[];
   for(const cell of els(row,'c')){
    const ci=columnIndex(cell.getAttribute('r'));if(ci>200)continue;
    const type=cell.getAttribute('t'),raw=textOf(cell,'v');
    values[ci]=els(cell,'f').length?null:type==='s'?shared[Number(raw)]:type==='inlineStr'?els(cell,'t').map(t=>t.textContent).join(''):type==='str'?raw:type==='e'?null:raw===''?null:Number(raw);
   }
   rows[index]=values;
  }
  for(let i=0;i<rows.length;i++)if(!rows[i])rows[i]=[];
  sheets.push({name:sheet.getAttribute('name'),rows,file,doc});
 }
 return {zip,workbook,sheets};
}
export async function loadReference({signal}={}){
 const response=await fetch('./reference.xlsx',{signal});if(!response.ok)throw Error('시연용 기준 양식을 읽을 수 없습니다.');
 const data=await response.arrayBuffer(),book=await readWorkbook(data);
 const name=els(book.workbook,'definedName').find(n=>n.getAttribute('name')==='교육유형명');
 const match=name?.textContent.match(/^'?교육유형'?!\$A\$(\d+):\$A\$(\d+)$/);
 if(!match)throw Error('교육유형명 이름정의를 확인할 수 없습니다.');
 const sheet=book.sheets.find(s=>s.name==='교육유형');
 return {data,names:sheet.rows.slice(Number(match[1])-1,Number(match[2])).map(r=>r[0]).filter(v=>typeof v==='string'&&v.trim())};
}
export async function generateExcel(template,analysis,choices){
 if(!analysis.can_generate)throw Error('확인 필요 항목을 해결하고 다시 분석해주세요.');
 if(!['N','Y'].includes(choices.required)||!['N','Y'].includes(choices.welfare)||!['0','1'].includes(choices.participation))throw Error('확인값을 다시 선택해주세요.');
 if(choices.welfare==='Y')throw Error('사회복지교육 Y는 시간/분 추가 확인이 필요합니다.');
 const plan=registrationPlan(analysis.roster.attendees,analysis.notice);if(plan.issues.length)throw Error(plan.issues.join('\n'));const attendees=plan.included;const method=learningMethod(analysis.notice.method);if(!method)throw Error('학습방법을 네 가지 공식 목록에서 선택해주세요.');
 const zip=await globalThis.JSZip.loadAsync(template);const file='xl/worksheets/sheet1.xml';let source=await zip.file(file).async('string');
 const doc=xml(source),sample=els(doc,'row').find(r=>r.getAttribute('r')==='2');
 const styles=Object.fromEntries(els(sample,'c').map(c=>[c.getAttribute('r').replace(/\d+/g,''),c.getAttribute('s')]));
 const oldFormula=textOf(els(sample,'c').find(c=>c.getAttribute('r')==='D2'),'f');
 if(oldFormula!=='INDIRECT("유형코드"&MATCH(C2,교육유형명,0))')throw Error('기준 양식 수식이 예상과 다릅니다.');
 const header=source.match(/<row\b[^>]*\br="1"[^>]*>.*?<\/row>/s)?.[0];
 const sampleTag=source.match(/<row\b[^>]*\br="2"[^>]*>/)?.[0];if(!header||!sampleTag)throw Error('기준 양식 행 구조 확인 필요');
 const n=analysis.notice,serial=Date.parse(n.date+'T00:00:00Z')/86400000+25569;
 const rows=attendees.map((a,i)=>{
  const duration=personDuration(a,n);if(!duration.valid)throw Error(a.name+': 개인별 인정시간을 확인해주세요.');
  const r=i+2;const id=a.employee_lookup.status==='matched'?a.employee_lookup.employee_id:null;
  const values=[a.name,id,analysis.reference.official,null,choices.required,serial,serial,duration.hours,duration.minutes,method.code,Number(choices.participation),n.name,n.name,'N',null,null];
  const cells=[...'ABCDEFGHIJKLMNOP'].map((col,ci)=>{
   const address=col+r,style=styles[col]===null||styles[col]===undefined?'':` s="${styles[col]}"`,base=`<c r="${address}"${style}`;
   if(col==='D')return `${base}><f>${escape(oldFormula.replace('MATCH(C2,',`MATCH(C${r},`))}</f></c>`;
   const value=values[ci];if(value===null)return `${base}/>`;
   return typeof value==='number'?`${base}><v>${value}</v></c>`:`${base} t="inlineStr"><is><t>${escape(value)}</t></is></c>`;
  }).join('');
  return sampleTag.replace(/\br="2"/,`r="${r}"`)+cells+'</row>';
 }).join('');
 source=source.replace(/<sheetData\b[^>]*>.*?<\/sheetData>/s,()=>'<sheetData>'+header+rows+'</sheetData>').replace(/<dimension\b[^>]*\/>/,`<dimension ref="A1:P${attendees.length+1}"/>`);
 zip.file(file,source);
 let workbook=await zip.file('xl/workbook.xml').async('string');workbook=workbook.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>');zip.file('xl/workbook.xml',workbook);
 if(zip.file('xl/calcChain.xml')){let chain=await zip.file('xl/calcChain.xml').async('string');chain=chain.replace(/(<calcChain\b[^>]*>).*?<\/calcChain>/s,(_,opening)=>opening+attendees.map((a,i)=>`<c r="D${i+2}" i="1"/>`).join('')+'</calcChain>');zip.file('xl/calcChain.xml',chain);}
 const data=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 // 내보낸 XLSX를 다시 읽어 이름·번호·빈셀·수식을 확인한다.
 const verify=await readWorkbook(data),sheet=verify.sheets.find(s=>s.name==='Sheet1');
 if(sheet.rows.length!==attendees.length+1)throw Error('결과 행 수 검증 실패');
 attendees.forEach((a,i)=>{
  const row=sheet.rows[i+1],expected=a.employee_lookup.status==='matched'?a.employee_lookup.employee_id:null;
  const duration=personDuration(a,analysis.notice);if(row[7]!==duration.hours||row[8]!==duration.minutes)throw Error('개인별 시간 검증 실패');
  if(row[9]!==method.code)throw Error('학습방법 코드 검증 실패');
  if(row[0]!==a.name||row[1]!==expected||row[14]!==null||row[15]!==null)throw Error('결과 셀 검증 실패');
  const cell=els(sheet.doc,'c').find(c=>c.getAttribute('r')===`D${i+2}`);
  if(textOf(cell,'f')!==oldFormula.replace('MATCH(C2,',`MATCH(C${i+2},`))throw Error('행별 수식 검증 실패');
 });
 return data;
}
