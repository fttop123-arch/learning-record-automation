import {extractCandidates as parseNotice} from './notice-review.js?v=20261024-review-flow';
import {extractPdf} from './pdf-reader.js?v=20261024-review-flow';
import {withDeadline} from './async-utils.js';
const TEXT='urn:oasis:names:tc:opendocument:xmlns:text:1.0';
function textOf(node){
 if(node.nodeType===3)return node.nodeValue;
 if(node.namespaceURI===TEXT){
  if(node.localName==='s'){const n=Number(node.getAttributeNS(TEXT,'c')||1);if(!Number.isInteger(n)||n<1||n>10000)throw Error('ODT 공백 길이가 올바르지 않습니다.');return ' '.repeat(n);}
  if(node.localName==='tab')return '\t';
  if(node.localName==='line-break')return '\n';
 }
 return Array.from(node.childNodes||[]).map(textOf).join('');
}
export async function extractOdt(file,{signal,progress=()=>{}}={}){
 return withDeadline(async()=>{
  progress('ODT 본문 읽기');
  const zip=await globalThis.JSZip.loadAsync(await file.arrayBuffer());
  const mime=zip.file('mimetype');
  if(!mime||(await mime.async('string')).trim()!=='application/vnd.oasis.opendocument.text')throw Error('올바른 ODT 문서가 아닙니다.');
  const content=zip.file('content.xml');if(!content)throw Error('ODT 본문이 없습니다. 암호화된 문서는 지원하지 않습니다.');
  const xml=await content.async('string');if(xml.length>20*1024*1024)throw Error('ODT 본문이 너무 큽니다.');
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('지원하지 않는 ODT XML 선언입니다.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('ODT 본문 XML을 읽을 수 없습니다.');
  const paragraphs=Array.from(doc.getElementsByTagNameNS(TEXT,'p'));
  const headings=Array.from(doc.getElementsByTagNameNS(TEXT,'h'));
  const text=paragraphs.concat(headings).map(textOf).join('\n');
  if(!text.trim())throw Error('ODT에서 글자를 찾지 못했습니다. 이미지 문서의 OCR은 지원하지 않습니다.');
  if(signal?.aborted)throw Error('공문 분석이 취소되었습니다.');
  progress('ODT 교육정보 분석');return parseNotice(text,{filename:file.name});
 },{label:'공문 ODT 읽기',timeoutMs:25000,signal});
}
// 본문 구역만 읽는다. 미리보기 텍스트는 잘릴 수 있어 대체 자료로 사용하지 않는다.
const HP='http://www.hancom.co.kr/hwpml/2011/paragraph';
function hwpxText(node){
 if(node.nodeType===3)return node.nodeValue;
 if(node.namespaceURI===HP){
  if(node.localName==='tab')return '\t';
  if(node.localName==='lineBreak')return '\n';
 }
 return Array.from(node.childNodes||[]).map(hwpxText).join('')+(node.namespaceURI===HP&&node.localName==='p'?'\n':'');
}
export async function extractHwpx(file,{signal,progress=()=>{}}={}){
 return withDeadline(async()=>{
  progress('HWPX 본문 읽기');
  const zip=await globalThis.JSZip.loadAsync(await file.arrayBuffer());
  const mime=zip.file('mimetype');
  if(!mime||(await mime.async('string')).trim()!=='application/hwp+zip')throw Error('올바른 HWPX 문서가 아닙니다.');
  const sections=Object.keys(zip.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/section(\d+)/)[1])-Number(b.match(/section(\d+)/)[1]));
  if(!sections.length)throw Error('HWPX 본문 구역이 없습니다. 암호화된 문서는 지원하지 않습니다.');
  let text='',size=0;
  for(const [i,name] of sections.entries()){
   if(signal?.aborted)throw Error('공문 분석이 취소되었습니다.');
   progress(`HWPX 본문 읽기 ${i+1}/${sections.length}`);
   const xml=await zip.file(name).async('string');size+=xml.length;
   if(size>20*1024*1024)throw Error('HWPX 본문이 너무 큽니다.');
   if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('지원하지 않는 HWPX XML 선언입니다.');
   const doc=new DOMParser().parseFromString(xml,'application/xml');
   if(doc.getElementsByTagName('parsererror').length)throw Error('HWPX 본문 XML을 읽을 수 없습니다.');
   // p 안의 run/t와 표 내부 문단을 문서 순서대로 한 번씩 방문한다.
   const walk=node=>{
    if(node.namespaceURI===HP&&node.localName==='p')return hwpxText(node);
    return Array.from(node.childNodes||[]).map(walk).join('');
   };
   text+=walk(doc)+'\n';
  }
  if(!text.trim())throw Error('HWPX에서 글자를 찾지 못했습니다. 이미지 문서의 OCR은 지원하지 않습니다.');
  return parseNotice(text,{filename:file.name});
 },{label:'공문 HWPX 읽기',timeoutMs:25000,signal});
}
export function extractNotice(file,options={}){
 const name=file.name.toLowerCase();
 if(name.endsWith('.pdf'))return extractPdf(file,options);
 if(name.endsWith('.odt'))return extractOdt(file,options);
 if(name.endsWith('.hwpx'))return extractHwpx(file,options);
 if(name.endsWith('.hwp'))throw Error('HWP는 아직 지원하지 않습니다. 한글에서 HWPX 또는 PDF로 저장해 선택해주세요.');
 throw Error('공문은 PDF, ODT 또는 HWPX 파일을 선택해주세요.');
}
