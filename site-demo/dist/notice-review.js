import {parseNotice,spaces} from './core.js';
export function extractCandidates(text){
 const candidates={name:[],date:[],hours:[],method:[],type_raw:[]};
 const add=(key,value,line)=>{if(!candidates[key].some(c=>c.value===value))candidates[key].push({value,evidence:line});};
 for(const line of text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
  const parts=line.match(/^\s*(?:\d+[.)]\s*)?([^:：]{1,35})[:：]\s*(.+)$/),label=parts?spaces(parts[1]):'',value=parts?.[2]?.trim();
  if(value&&/^(교육|학습|행사|과정|강좌)명$/.test(label))add('name',value,line);
  if(value&&/(유형|분류)/.test(label))add('type_raw',value,line);
  if(value&&/(방법|방식)/.test(label))add('method',value,line);
  if(/(교육|참석|개최|행사|학습|일시|일자)/.test(label)&&!/(시행|접수|등록)/.test(label)){
   for(const m of (value||'').matchAll(/(\d{4})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})\s*[.일]?/g)){
    const [y,mo,d]=m.slice(1).map(Number),date=new Date(Date.UTC(y,mo-1,d));
    if(date.getUTCFullYear()===y&&date.getUTCMonth()===mo-1&&date.getUTCDate()===d)add('date',`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,line);
   }
  }
  if(/(인정|실적|학습).*시간/.test(label)){
   const m=value?.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*$/);
   if(m&&(m[1]||m[2])&&Number(m[2]||0)<60)add('hours',Number(m[1]||0)*60+Number(m[2]||0),line);
  }
 }
 let base={name:null,date:null,start:null,end:null,place:null,method:null,type_raw:null,hours:null,minutes:null};
 try{base=parseNotice(text);}catch{/* 불확실한 항목은 편집 화면에서 확인한다. */}
 for(const key of ['name','date','method','type_raw'])base[key]=candidates[key].length===1?candidates[key][0].value:null;
 const duration=candidates.hours.length===1?candidates.hours[0].value:null;
 base.hours=duration===null?null:Math.floor(duration/60);base.minutes=duration===null?null:duration%60;
 return {...base,candidates,source_text:text};
}
export function validReview(n){
 const date=new Date(n.date+'T00:00:00Z');
 return !!n.name?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(n.date||'')&&!isNaN(date)&&date.toISOString().slice(0,10)===n.date&&Number.isInteger(n.hours)&&n.hours>=0&&Number.isInteger(n.minutes)&&n.minutes>=0&&n.minutes<60&&n.hours*60+n.minutes>0;
}
export function createReview(notice,names,selected,onConfirm){
 const box=document.createElement('section');box.className='card notice-review';
 const title=document.createElement('h2');title.textContent='교육정보 검토·수정';box.append(title);
 const intro=document.createElement('p');intro.textContent='후보가 하나인 값도 원문과 비교해주세요. 여러 후보 또는 미발견 항목은 직접 선택·입력한 뒤 확인합니다.';box.append(intro);
 const controls={};
 for(const [key,label,type]of [['name','교육명','text'],['date','교육일','date'],['hours','인정시간(시간)','number'],['minutes','인정시간(분)','number'],['method','학습방법','select'],['official','교육유형 공식명','select']]){
  const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='select'?'select':'input');input.name=key;
  if(type==='select')for(const [v,t]of [['','선택해주세요'],...(key==='official'?names.map(n=>[n,n]):[['집합교육','집합교육 → 집합과정(1)']])]){const o=document.createElement('option');o.value=v;o.textContent=t;input.append(o);}
  else{input.type=type;if(type==='number'){input.min=0;input.step=1;if(key==='minutes')input.max=59;}}
  input.value=key==='official'?(selected||''):(notice[key]??'');wrap.append(input);controls[key]=input;
  if(key==='official'){
   wrap.classList.add('official-type-field');input.required=true;input.setAttribute('aria-required','true');input.id='official-type-select';
   const badge=document.createElement('span');badge.className='type-review-badge';wrap.prepend(badge);
   const hint=document.createElement('p');hint.id='official-type-hint';hint.className='type-review-hint';hint.setAttribute('role','status');input.setAttribute('aria-describedby',hint.id);wrap.append(hint);
   function updateTypeHint(){const missing=!input.value;wrap.classList.toggle('type-missing',missing);input.setAttribute('aria-invalid',String(missing));badge.textContent=missing?'필수 선택':'선택 확인 필요';hint.textContent=missing?'교육유형을 반드시 선택해주세요. 공문 내용과 비교하여 공식 목록에서 선택한 뒤 확인·적용하세요.':'선택된 교육유형이 공문 내용에 맞는지 확인한 뒤 아래 ‘교육정보 확인·적용’을 눌러주세요.';}
   input.addEventListener('change',updateTypeHint);updateTypeHint();
  }
  for(const c of notice.candidates?.[key==='official'?'type_raw':key]||[]){const p=document.createElement('p');p.className='candidate-evidence';p.textContent='근거: '+c.evidence;wrap.append(p);if(key==='date'||key==='name'){const choose=document.createElement('button');choose.type='button';choose.textContent='이 후보 사용: '+c.value;choose.addEventListener('click',()=>{input.value=c.value;markDirty();});wrap.append(choose);}}
  box.append(wrap);
 }
 const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='추출한 공문 원문 보기';pre.textContent=notice.source_text||'추출된 원문이 없습니다.';details.append(summary,pre);box.append(details);
 const status=document.createElement('p');status.setAttribute('role','status');status.id='review-confirm-message';const confirm=document.createElement('button');confirm.type='button';confirm.id='confirm-education';confirm.className='confirm-education';confirm.textContent='교육정보 확인·적용';
 function markDirty(){status.textContent='수정된 교육정보를 확인·적용해주세요.';onConfirm(null);}
 for(const input of Object.values(controls))input.addEventListener('input',markDirty);
 confirm.addEventListener('click',()=>{const n={...notice};for(const k of ['name','date','method'])n[k]=controls[k].value.trim();n.hours=controls.hours.value===''?null:Number(controls.hours.value);n.minutes=controls.minutes.value===''?null:Number(controls.minutes.value);const official=controls.official.value;if(!names.includes(official)){status.textContent='교육유형 공식명을 먼저 선택해주세요.';controls.official.scrollIntoView({behavior:'smooth',block:'center'});controls.official.focus({preventScroll:true});onConfirm(null);return;}if(!validReview(n)||!names.includes(official)||n.method!=='집합교육'){status.textContent='교육명·유효한 교육일·인정시간·학습방법·공식 교육유형을 모두 확인해주세요.';onConfirm(null);return;}status.textContent='교육정보 확인이 적용되었습니다.';onConfirm({notice:n,official});});const actions=document.createElement('div');actions.className='review-actions';actions.append(confirm,status);box.append(actions);return box;
}
