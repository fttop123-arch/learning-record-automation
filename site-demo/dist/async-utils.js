/* 끝나지 않는 파일 작업도 제한시간/취소 후 UI 제어를 돌려준다. */
export function withDeadline(operation,{label='파일 분석',timeoutMs=25000,signal,onStop}={}){
 return new Promise((resolve,reject)=>{
  let done=false,timer;
  const finish=(callback,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);callback(value);};
  const stop=error=>{try{onStop?.();}catch{}finish(reject,error);};
  const cancel=()=>stop(new Error('분석을 취소했습니다. 파일과 부서를 확인한 후 다시 시도해주세요.'));
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>stop(new Error(`${label}: 처리 시간이 초과되었습니다. 파일을 확인하고 다시 분석해주세요.`)),timeoutMs);
  Promise.resolve().then(()=>typeof operation==='function'?operation():operation).then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}
