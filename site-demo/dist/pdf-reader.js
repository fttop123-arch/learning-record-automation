// PDF.js fingerprint 계산에서 사용하는 최신 API의 구형 브라우저 대체 구현.
export const PDF_WORKER_COMPAT = `if(typeof Uint8Array.prototype.toHex!=='function'){Object.defineProperty(Uint8Array.prototype,'toHex',{configurable:true,writable:true,value:function(){let hex='';for(let i=0;i<this.length;i++)hex+=this[i].toString(16).padStart(2,'0');return hex;}});}`;
import {extractCandidates as parseNotice} from './notice-review.js?v=20261024-duration-alias';
import {withDeadline} from './async-utils.js';

export async function extractPdf(file,{signal,progress=()=>{}}={}){
 let port,worker,task,workerUrl;
 const controller=new AbortController();
 const stop=()=>{controller.abort();port?.terminate();if(task)void task.destroy().catch(()=>{});};
 const abort=()=>stop();
 signal?.addEventListener('abort',abort,{once:true});
 try{
  return await withDeadline(async()=>{
   progress('PDF 라이브러리 준비');
   const pdfjs=await import('./vendor/pdf.mjs');
   progress('PDF 분석 모듈 내려받기');
   // 큰 Worker 원문 대신 압축된 작은 정적 파일을 받아 브라우저에서 복원한다.
   const response=await fetch('./vendor/pdf-worker.gz.bin',{signal:controller.signal});
   if(!response.ok)throw Error('PDF 분석 모듈을 내려받지 못했습니다. 새로고침 후 다시 시도해주세요.');
   const bytes=new Uint8Array(await response.arrayBuffer());
   let source;
   if(bytes[0]===0x1f&&bytes[1]===0x8b){
    if(typeof DecompressionStream==='undefined')throw Error('이 브라우저는 압축 모듈 복원을 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해주세요.');
    source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
   }else source=new TextDecoder().decode(bytes);
   if(controller.signal.aborted)throw Error('PDF 분석이 취소되었습니다.');
   progress('PDF 문서 열기');
   workerUrl=URL.createObjectURL(new Blob([PDF_WORKER_COMPAT+'\n'+source],{type:'text/javascript'}));
   port=new Worker(workerUrl,{type:'module'});
   worker=new pdfjs.PDFWorker({port});
   task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),worker,isEvalSupported:false,useSystemFonts:true});
   const doc=await task.promise;
   let text='';
   for(let i=1;i<=doc.numPages;i++){
    progress(`PDF 텍스트 추출 ${i}/${doc.numPages}쪽`);
    const page=await doc.getPage(i),content=await page.getTextContent();let previousY=null;
    for(const item of content.items){if(!('str'in item))continue;const y=item.transform[5];if(previousY!==null&&Math.abs(previousY-y)>3)text+='\n';text+=item.str+' ';if(item.hasEOL)text+='\n';previousY=y;}text+='\n';
   }
   if(!text.trim())throw Error('텍스트를 읽을 수 없습니다. 스캔 PDF의 OCR은 지원하지 않습니다.');
   return parseNotice(text,{filename:file.name});
  },{label:'공문 PDF 읽기',timeoutMs:25000,signal,onStop:stop});
 }finally{
  signal?.removeEventListener('abort',abort);
  stop();worker?.destroy();if(workerUrl)URL.revokeObjectURL(workerUrl);
 }
}
