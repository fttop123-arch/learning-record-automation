export const FILE_RULES={notice:{label:'교육실적 인정 공문',extensions:['.pdf','.odt','.hwpx']},attendees:{label:'교육 참석자 명단',extensions:['.xlsx']},employees:{label:'개인식별번호 명부',extensions:['.xlsx']}};
export function fileError(name,file){
 const rule=FILE_RULES[name];if(!file?.name)return '';
 if(!rule.extensions.some(ext=>file.name.toLowerCase().endsWith(ext)))return `${rule.label}: 허용되지 않는 파일 형식입니다. ${rule.extensions.join(', ')} 파일을 다시 선택해주세요.`+(file.name.toLowerCase().endsWith('.hwp')?' HWP는 한글에서 HWPX 또는 PDF로 저장한 뒤 선택해주세요.':'');
 if(!file.size)return `${rule.label}: 빈 파일입니다. 내용이 있는 파일을 선택해주세요.`;
 if(file.size>20*1024*1024)return `${rule.label}: 파일당 최대 20MB까지 선택할 수 있습니다.`;
 return '';
}

export function uploadIssues(files){
 const issues=[];
 for(const [name,rule]of Object.entries(FILE_RULES)){
  const file=files[name];
  const message=!file?.name?(name==='employees'?'':`${rule.label} 파일을 선택해주세요.`):fileError(name,file);
  if(message)issues.push({name,message});
 }
 return issues;
}
