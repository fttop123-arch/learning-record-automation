export function workflowStep({hasAnalysis=false,reviewConfirmed=false,hasResult=false,busy=false}={}){
 if(hasResult)return 3;
 if(reviewConfirmed)return 2;
 if(hasAnalysis||busy)return 1;
 return 0;
}
export function paintProgress(elements,step){
 elements.forEach((element,index)=>{
  element.classList.toggle('active',index===step);
  element.classList.toggle('completed',index<step);
  element.classList.toggle('result-ready',index===3&&step===3);
  if(index===step)element.setAttribute('aria-current','step');else element.removeAttribute('aria-current');
  element.setAttribute('aria-label',element.textContent.trim()+(index===step?' — 현재 단계':index<step?' — 완료':' — 대기'));
 });
}
