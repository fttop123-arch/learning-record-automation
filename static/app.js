const $ = (selector) => document.querySelector(selector);
let analysis = null;
let busy = false;
const labels = {matched: '정상 매칭', duplicate: '동명이인 확인 필요', not_found: '직원정보에서 찾지 못함', missing_id: '개인식별번호 없음', no_file: '개인식별번호 파일 미첨부'};
function alerts(messages = []) {
  $('#alert-list').replaceChildren(...messages.map(message => { const li = document.createElement('li'); li.textContent = message; return li; }));
  $('#alerts').hidden = !messages.length;
}
function fieldList(target, fields) {
  $(target).replaceChildren(...fields.map(([label, value, wide]) => {
    const div = document.createElement('div'); if (wide) div.className = 'wide';
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value ?? '확인 필요';
    div.append(dt, dd); return div;
  }));
}
function syncButtons() {
  $('#analyze-button').disabled = busy;
  $('#generate-button').disabled = busy || !analysis?.can_generate || $('#welfare').value === 'Y';
  $('#welfare-warning').hidden = $('#welfare').value !== 'Y';
}
function invalidate() {
  analysis = null; $('#analysis').hidden = true; $('#completion').hidden = true;
  alerts(); $('#live-status').textContent = '첨부 파일 또는 대상 부서가 변경되었습니다. 다시 분석해주세요.';
  syncButtons();
}
async function api(url, options) {
  const response = await fetch(url, {...options, headers: {'X-Requested-With': 'LearningRecord', ...options.headers}});
  const data = await response.json();
  if (!response.ok) throw data.errors || ['처리 중 오류가 발생했습니다. 파일과 입력값을 확인해주세요.'];
  return data;
}
for (const input of document.querySelectorAll('input[type=file]')) input.addEventListener('change', () => {
  input.parentElement.querySelector('.filename').textContent = input.files[0]?.name || '파일을 선택해주세요';
  invalidate();
});
$('#department').addEventListener('input', invalidate);
$('#welfare').addEventListener('change', () => { $('#completion').hidden = true; syncButtons(); });
for (const select of document.querySelectorAll('select')) select.addEventListener('change', () => { $('#completion').hidden = true; });
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  analysis = null; $('#analysis').hidden = true; $('#completion').hidden = true;
  busy = true; syncButtons(); alerts(); $('#live-status').textContent = '파일을 분석하고 있습니다…';
  $('#analyze-button').textContent = '분석 중…';
  const controls = [...$('#upload-form').elements];
  const formData = new FormData(event.target);
  controls.forEach(control => control.disabled = true);
  try {
    analysis = await api('/api/analyze', {method: 'POST', body: formData});
    const n = analysis.notice;
    fieldList('#education', [['교육명', n.name, true], ['교육일', n.date], ['시간', `${n.start} ~ ${n.end}`], ['교육장소', n.place], ['학습방법', `${n.method} / 코드 ${analysis.method_code ?? '미확정'}`], ['교육유형 공식명', analysis.reference.official, true], ['인정시간', `${n.hours}시간 ${n.minutes}분`]]);
    fieldList('#source-info', [['교육유형 원문', n.type_raw, true], ['공식 목록 일치', `${analysis.reference.matches.length}개`], ['교육시작일', n.date], ['교육종료일', n.date], ['제목', n.name], ['내용', n.name, true]]);
    $('#attendee-count').textContent = `${analysis.roster.attendees.length}명`;
    $('#attendees').replaceChildren(...analysis.roster.attendees.map(a => {
      const tr = document.createElement('tr');
      for (const value of [a.name || '(성명 없음)', a.rank || '(직급 없음)', a.department, a.employee_lookup.employee_id || '미입력']) {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      }
      const td = document.createElement('td'); const span = document.createElement('span');
      span.className = 'status' + (a.employee_lookup.status !== 'matched' ? ' review' : '');
      span.textContent = labels[a.employee_lookup.status];
      const reason = document.createElement('small'); reason.textContent = a.employee_lookup.reason;
      td.append(span, reason); tr.append(td); return tr;
    }));
    alerts(analysis.warnings); $('#analysis').hidden = false;
    $('#generate-form').reset();
    $('#live-status').textContent = '분석이 완료되었습니다. 교육정보와 대상자를 검토한 후 확인값을 선택해주세요.';
    document.querySelectorAll('.steps span').forEach((s, i) => s.classList.toggle('active', i === 1));
  } catch (errors) { alerts(Array.isArray(errors) ? errors : ['서버에 연결할 수 없습니다. 실행 상태를 확인해주세요.']); $('#live-status').textContent = '분석을 완료하지 못했습니다.'; }
  finally { busy = false; controls.forEach(control => control.disabled = false); syncButtons(); $('#analyze-button').textContent = '분석하기 →'; }
});
$('#generate-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !analysis) return;
  const values = Object.fromEntries(new FormData(event.target));
  const controls = [...$('#upload-form').elements, ...$('#generate-form').elements];
  controls.forEach(control => control.disabled = true);
  busy = true; syncButtons(); $('#completion').hidden = true; $('#live-status').textContent = 'Excel을 생성하고 양식 보존 여부를 검증하고 있습니다…';
  try {
    const result = await api('/api/generate', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({analysis_id: analysis.analysis_id, ...values})});
    $('#completed-education').textContent = result.education;
    fieldList('#summary', [['대상자', `${result.count}명`], ['개인식별번호 정상 매칭', `${result.matched}명`], ['확인 필요', `${result.needs_review}명`]]);
    $('#result-filename').textContent = result.filename; $('#download').href = result.download_url;
    alerts(analysis.warnings); $('#completion').hidden = false;
    $('#completion').scrollIntoView({behavior: 'smooth', block: 'center'});
    $('#live-status').textContent = '생성이 완료되었습니다. 결과 Excel을 다운로드해주세요.';
    document.querySelectorAll('.steps span').forEach((s, i) => s.classList.toggle('active', i === 3));
  } catch (errors) { alerts([...(analysis.warnings || []), ...(Array.isArray(errors) ? errors : ['서버에 연결할 수 없습니다.'])]); $('#live-status').textContent = 'Excel을 생성하지 못했습니다.'; }
  finally { busy = false; controls.forEach(control => control.disabled = false); syncButtons(); }
});
fetch('/api/config').then(r => r.json()).then(c => { $('#department').value = c.department; }).catch(() => alerts(['서버 설정을 읽지 못했습니다. 새로고침해주세요.']));
syncButtons();
