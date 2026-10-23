// 기존 change 처리로 연결하므로 선택 버튼과 검증·분석 경로가 같다.
export function dropError(files,items=[]){
 if(Array.from(items).some(item=>item.webkitGetAsEntry?.()?.isDirectory))return '폴더는 첨부할 수 없습니다. 파일 한 개를 끌어놓아주세요.';
 if(files.length!==1)return '첨부 영역마다 파일 한 개씩 끌어놓아주세요.';
 return '';
}
export function attachFileDrop(card,input,onError){
 let depth=0;
 const clear=()=>{depth=0;card.classList.remove('drag-over');};
 card.addEventListener('dragenter',event=>{event.preventDefault();if(input.disabled)return;depth++;card.classList.add('drag-over');});
 card.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect=input.disabled?'none':'copy';});
 card.addEventListener('dragleave',event=>{event.preventDefault();if(--depth<=0)clear();});
 card.addEventListener('drop',event=>{
  event.preventDefault();clear();if(input.disabled)return;
  const files=Array.from(event.dataTransfer?.files||[]),error=dropError(files,event.dataTransfer?.items||[]);
  if(error){onError(error);return;}
  try{const transfer=new DataTransfer();transfer.items.add(files[0]);input.files=transfer.files;}
  catch{onError('이 브라우저에서는 끌어놓기를 사용할 수 없습니다. 파일 선택 버튼을 이용해주세요.');return;}
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
}
// 첨부 영역 밖에 떨어뜨린 파일이 브라우저에서 열리지 않게 한다.
export function preventFileNavigation(target){
 for(const type of ['dragover','drop'])target.addEventListener(type,event=>{
  if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault();
 });
}
