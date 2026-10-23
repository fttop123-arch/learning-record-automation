const KEY='gyeongju-demo-access';
export async function checkPassword(password,config){
 const bytes=hex=>new Uint8Array(hex.match(/../g).map(x=>parseInt(x,16)));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},key,256);
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')===config.digest;
}
export async function requireDemoAccess(){
 let config;
 try{const response=await fetch('./demo-access.json',{cache:'no-store'});if(!response.ok)throw Error();config=await response.json();if(!/^[a-f0-9]{32}$/.test(config.version)||!/^[a-f0-9]{32}$/.test(config.salt)||!/^[a-f0-9]{64}$/.test(config.digest)||config.iterations!==210000)throw Error();}catch{
  await screen(null);return;
 }
 try{if(sessionStorage.getItem(KEY)===config.version){unlock();return;}}catch{}
 await screen(config);
}
function unlock(){document.documentElement.classList.add('demo-unlocked');document.querySelector('#demo-gate')?.remove();}
async function screen(config){
 await new Promise(resolve=>{
 const panel=document.createElement('section');panel.id='demo-gate';
 const title=document.createElement('h1');title.textContent='경주시 서무 AI 업무도우미';
 const intro=document.createElement('p');intro.textContent=config?'시연용 공용 암호를 입력해주세요.':'아직 시연용 암호가 설정되지 않았습니다.';
 const note=document.createElement('p');note.textContent='가상자료 시연용 진입 화면입니다.';
 const message=document.createElement('p');message.setAttribute('role','status');
 panel.append(title,intro);
 if(config){const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),button=document.createElement('button');label.textContent='암호';input.type='password';input.autocomplete='current-password';input.required=true;label.append(input);button.textContent='입장하기';form.append(label,button);panel.append(form);form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{if(await checkPassword(input.value,config)){try{sessionStorage.setItem(KEY,config.version);}catch{}input.value='';unlock();resolve();}else{message.textContent='암호가 맞지 않습니다. 다시 입력해주세요.';input.select();}}catch{message.textContent='암호 확인에 실패했습니다. 최신 Chrome 또는 Edge에서 다시 시도해주세요.';}finally{button.disabled=false;}});queueMicrotask(()=>input.focus());}
 else{message.textContent='프로젝트 폴더의 암호설정.cmd를 실행한 뒤 새로고침해주세요. 설정 전에는 입장할 수 없습니다.';}
 panel.append(message,note);document.body.append(panel);
 });
}
