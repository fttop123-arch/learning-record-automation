// 회귀 검증 전용 가상 자료. 배포 자산에 포함하지 않습니다.
export function demoData() {
  return {notice:{name:'2026년 경주시청 소방교육',date:'2026-09-21',start:'10:00',end:'12:00',place:'경주시청 대회의실',method:'집합교육',type_raw:'기관주관교육/직장교육/직무·시책·소양',hours:2,minutes:0},
    roster:{total:3,attendees:[{name:'김지현',rank:'전산9급',department:'디지털정책과',status:'대상 부서 일치'},{name:'문형식',rank:'전산6급',department:'디지털정책과',status:'대상 부서 일치'},{name:'가상직원',rank:'행정7급',department:'경제정책과',status:'대상 부서 일치'}]},
    directory:{mode:'department_name',records:[{name:'김지현',department:'디지털정책과',employee_id:'TEST001'},{name:'문형식',department:'디지털정책과',employee_id:'TEST002'}]}};
}
