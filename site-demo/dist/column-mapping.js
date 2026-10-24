import {attendeeHeader} from './core.js?v=20261024-columns';
export function autoMapping(sheets){
 try{const h=attendeeHeader(sheets);return {sheetIndex:sheets.indexOf(h.sheet),headerRow:h.index,departmentColumn:h.columns[0],rankColumn:h.columns[1],nameColumn:h.columns[2]};}catch{return null;}
}
export function createColumnMapping(sheets,onChange){
 const panel=document.createElement('section');panel.className='column-mapping';panel.id='column-mapping';
 const title=document.createElement('h3');title.textContent='참석자 명단 컬럼 연결';panel.append(title);
 const description=document.createElement('p');description.textContent='알려진 컬럼은 자동 연결합니다. 결과가 다르거나 자동 인식되지 않으면 시트·머리글 행과 컬럼을 지정하세요. 직급은 선택입니다.';panel.append(description);
 const controls={},status=document.createElement('p');status.setAttribute('role','status');
 function select(key,label){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('select');input.id='mapping-'+key;wrap.append(input);panel.append(wrap);controls[key]=input;return input;}
 function options(input,entries){input.replaceChildren();for(const [value,text]of entries){const o=document.createElement('option');o.value=String(value);o.textContent=text;input.append(o);}}
 const sheetSelect=select('sheet','대상 시트');options(sheetSelect,sheets.map((s,i)=>[i,s.name]));
 const rowWrap=document.createElement('label');rowWrap.textContent='머리글 행 번호';const rowInput=document.createElement('input');rowInput.id='mapping-row';rowInput.type='number';rowInput.min=1;rowInput.step=1;rowWrap.append(rowInput);panel.append(rowWrap);
 for(const [key,label]of [['department','부서 컬럼'],['name','성명 컬럼'],['rank','직급 컬럼 (선택)']])select(key,label);
 const preview=document.createElement('div');preview.className='mapping-preview';panel.append(preview);
 const apply=document.createElement('button');apply.type='button';apply.textContent='컬럼 연결 적용';panel.append(status,apply);
 function chosen(){return {sheetIndex:Number(sheetSelect.value),headerRow:Number(rowInput.value)-1,departmentColumn:Number(controls.department.value),nameColumn:Number(controls.name.value),rankColumn:Number(controls.rank.value)};}
 function fillColumns(mapping=null){
  const sheet=sheets[Number(sheetSelect.value)],row=sheet?.rows[Number(rowInput.value)-1]||[];
  const entries=row.map((value,index)=>[index,`${index+1}열 · ${String(value??'').trim()||'(머리글 없음)'}`]);
  for(const key of ['department','name','rank'])options(controls[key],[[-1,key==='rank'?'사용 안 함':'선택해주세요'],...entries]);
  if(mapping){controls.department.value=mapping.departmentColumn;controls.name.value=mapping.nameColumn;controls.rank.value=mapping.rankColumn;}
  preview.replaceChildren();const p=document.createElement('p');p.textContent='자료 미리보기 (선택한 머리글 다음 최대 3행)';preview.append(p);
  const table=document.createElement('table');for(const r of sheet?.rows.slice(Number(rowInput.value)-1,Number(rowInput.value)+3)||[]){const tr=document.createElement('tr');for(let i=0;i<row.length;i++){const td=document.createElement('td');td.textContent=String(r[i]??'');tr.append(td);}table.append(tr);}preview.append(table);
 }
 function dirty(){status.textContent='연결이 변경되었습니다. 컬럼 연결 적용을 눌러주세요.';onChange(null);}
 sheetSelect.addEventListener('change',()=>{rowInput.value=1;rowInput.max=sheets[Number(sheetSelect.value)].rows.length;fillColumns();dirty();});
 rowInput.addEventListener('input',()=>{fillColumns();dirty();});
 for(const key of ['department','name','rank'])controls[key].addEventListener('change',dirty);
 function applyMapping(mapping,automatic=false){try{const h=attendeeHeader(sheets,mapping);onChange(mapping);status.textContent=`${automatic?'자동 연결':'연결 적용'}: ${h.sheet.name} ${h.index+1}행 / 부서 ← ${h.sheet.rows[h.index][h.columns[0]]??h.columns[0]+1} / 성명 ← ${h.sheet.rows[h.index][h.columns[2]]??h.columns[2]+1}`;}catch(e){onChange(null);status.textContent=e.message;}}
 apply.addEventListener('click',()=>applyMapping(chosen()));
 const initial=autoMapping(sheets);sheetSelect.value=initial?.sheetIndex??0;rowInput.value=(initial?.headerRow??0)+1;rowInput.max=sheets[Number(sheetSelect.value)]?.rows.length||1;fillColumns(initial);
 if(initial)applyMapping(initial,true);else{status.textContent='자동 연결을 하나로 확인하지 못했습니다. 부서·성명 컬럼을 직접 선택한 뒤 적용해주세요.';onChange(null);}
 return panel;
}
