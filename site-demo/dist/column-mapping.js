import {attendeeHeader,spaces} from './core.js?v=20261024-period';
export function mappingChoices(sheets){
 const candidates=[];let hasDepartment=false,hasName=false;
 sheets.forEach((sheet,sheetIndex)=>sheet.rows.forEach((row,headerRow)=>{
  const labels=row.map(spaces),find=names=>labels.flatMap((v,i)=>names.includes(v)?[i]:[]);
  const departments=find(['소속','부서','부서명','소속부서']),names=find(['성명','이름']),ranks=find(['직급']);
  hasDepartment ||= !!departments.length;hasName ||= !!names.length;
  for(const departmentColumn of departments)for(const nameColumn of names)candidates.push({sheetIndex,headerRow,departmentColumn,nameColumn,rankColumn:ranks.length===1?ranks[0]:-1});
 }));
 const missing=[!hasDepartment?'부서(소속/부서/부서명/소속부서)':null,!hasName?'성명(성명/이름)':null].filter(Boolean);
 return {candidates,message:candidates.length?'':missing.length?`${missing.join(', ')} 컬럼을 찾지 못했습니다. 해당 머리글이 있는 Excel 파일로 수정하거나 교체해주세요.`:'부서와 성명 컬럼이 같은 머리글 행에 있는 Excel 파일을 선택해주세요.'};
}
export function autoMapping(sheets){const {candidates}=mappingChoices(sheets);return candidates.length===1?candidates[0]:null;}
export function createColumnMapping(sheets,onChange){
 const panel=document.createElement('section');panel.className='column-mapping compact-mapping';panel.id='column-mapping';
 const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
 const {candidates,message}=mappingChoices(sheets);
 const describe=m=>{const h=attendeeHeader(sheets,m),row=h.sheet.rows[h.index];return `${h.sheet.name} ${h.index+1}행 · 부서: ‘${row[m.departmentColumn]}’ / 성명: ‘${row[m.nameColumn]}’`;};
 if(!candidates.length){panel.classList.add('mapping-error');status.textContent=message;onChange(null);return panel;}
 if(candidates.length===1){status.textContent='✓ 참석자 명단 확인 완료 · '+describe(candidates[0]);onChange(candidates[0]);return panel;}
 status.textContent='부서·성명 컬럼 후보가 여러 개입니다. 사용할 항목을 선택해주세요.';
 const label=document.createElement('label');label.textContent='사용할 명단 컬럼';const select=document.createElement('select');select.id='mapping-choice';label.append(select);
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='선택해주세요';select.append(placeholder);
 candidates.forEach((m,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=describe(m);select.append(option);});
 select.addEventListener('change',()=>{const mapping=select.value===''?null:candidates[Number(select.value)];onChange(mapping);status.textContent=mapping?'✓ 참석자 명단 확인 완료 · '+describe(mapping):'사용할 부서·성명 컬럼을 선택해주세요.';});
 panel.append(label);onChange(null);return panel;
}
