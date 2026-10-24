"""공개 가능한 라이브러리와 비식별 기준 양식만 dist에 준비한다."""
from pathlib import Path
import re
import shutil
import gzip
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DIST = Path(__file__).resolve().parent / "dist"
PACKAGES = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
N = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def main():
    vendor = DIST / "vendor"
    vendor.mkdir(parents=True, exist_ok=True)
    for source, destination in [
        ("jszip/dist/jszip.min.js", "jszip.min.js"),
        ("jszip/LICENSE.markdown", "JSZip-LICENSE.md"),
        ("pdfjs-dist/build/pdf.min.mjs", "pdf.mjs"),
        ("pdfjs-dist/build/pdf.worker.min.mjs", "pdf.worker.mjs"),
        ("pdfjs-dist/LICENSE", "PDFjs-LICENSE.txt"),
    ]:
        shutil.copyfile(PACKAGES / source, vendor / destination)
    (vendor / 'pdf-worker.gz.bin').write_bytes(gzip.compress((vendor / 'pdf.worker.mjs').read_bytes(),mtime=0))
    template = ROOT / "(샘플)교육실적등록 양식_작업용.xlsx"
    with ZipFile(template) as original:
        text = original.read("xl/worksheets/sheet1.xml").decode("utf-8")
        sample = re.search(r'<row\b[^>]*\br="2"[^>]*>.*?</row>', text, re.S).group()
        sample_xml = ET.fromstring('<root xmlns="'+N['m']+'">'+re.sub(r'\s+[\w]+:[\w]+="[^"]*"','',sample)+'</root>')
        sample_string_ids = {c.find('m:v', N).text for c in sample_xml.findall('.//m:c', N) if c.get('t') == 's'}
        # 다른 시트나 머리글이 참조하는 공식 문자열은 지우지 않는다.
        used_elsewhere = set()
        for part in original.namelist():
            if part.startswith('xl/worksheets/sheet') and part.endswith('.xml'):
                content = original.read(part).decode('utf-8')
                if part == 'xl/worksheets/sheet1.xml':
                    content = content.replace(sample, '')
                xml = ET.fromstring(content)
                used_elsewhere.update(c.find('m:v', N).text for c in xml.findall('.//m:c', N) if c.get('t') == 's')
        sample_string_ids -= used_elsewhere
        def blank_cell(match):
            cell = match.group()
            if re.search(r'\br="D2"', cell):
                return re.sub(r'<v>.*?</v>', '', cell)
            opening = cell.split('>')[0]
            opening = re.sub(r'\s+t="[^"]*"', '', opening)
            return opening + '/>'
        clean_sample = re.sub(r'<c\b[^>]*>.*?</c>', blank_cell, sample, flags=re.S)
        text = text.replace(sample, clean_sample)
        with ZipFile(DIST / "reference.xlsx", "w", ZIP_DEFLATED) as result:
            for item in original.infolist():
                data = original.read(item.filename)
                if item.filename == "xl/worksheets/sheet1.xml":
                    data = text.encode('utf-8')
                elif item.filename == "xl/sharedStrings.xml":
                    shared = data.decode('utf-8')
                    counter = -1
                    def scrub(match):
                        nonlocal counter
                        counter += 1
                        return '<si><t></t></si>' if str(counter) in sample_string_ids else match.group()
                    data = re.sub(r'<si>.*?</si>', scrub, shared, flags=re.S).encode('utf-8')
                elif item.filename == "xl/workbook.xml":
                    data = re.sub(r'<mc:AlternateContent\b[^>]*>.*?</mc:AlternateContent>', '', data.decode('utf-8'), flags=re.S).encode('utf-8')
                elif item.filename == "docProps/core.xml":
                    data = re.sub(r'<(dc:creator|cp:lastModifiedBy)>.*?</\1>', lambda m: '<'+m[1]+'>Demo</'+m[1]+'>', data.decode('utf-8'), flags=re.S).encode('utf-8')
                if item.filename.endswith('.xml'):
                    for example in (b'A1234567', b'211230-1234567', b'2112301234567'):
                        data = data.replace(example, b'TEST001')
                result.writestr(item, data)
    shutil.copyfile(ROOT / "static/style.css", DIST / "style.css")
    html = (ROOT / 'templates/index.html').read_text(encoding='utf-8')
    html = html.replace('href="/static/style.css"','href="./style.css"').replace('<script src="/static/app.js" defer></script>', '<script src="./vendor/jszip.min.js" defer></script><script type="module" src="./app.js?v=20261023-3"></script>')
    html = html.replace('<label class="department">대상 부서<input name="department" id="department" value="디지털정책과" maxlength="80" required></label>', '<div class="department-picker"><label class="department" for="department-search">부서명 검색<input id="department-search" placeholder="예: 노인, 노 인복지과" maxlength="80" autocomplete="off" disabled></label><label class="department" for="department-select">대상 부서 선택<select id="department-select" name="department" required disabled><option value="">참석자 명단을 먼저 선택해주세요</option></select></label><p id="department-status" class="department-status" role="status">참석자 Excel을 선택하면 부서 목록을 먼저 읽습니다.</p></div>')
    html = html.replace('로컬 업무 도구', '공개 시연판').replace('기준 양식: 프로젝트 기본 양식 사용', '기준 양식: 시연용 비식별 양식 사용')
    html = html.replace('<span class="local">', '<a class="home-link" href="./index.html">← 업무도우미 홈</a><span class="local">')
    html = html.replace('<form id="upload-form"', '<aside class="demo-notice"><strong>교육·시연용 시스템입니다. 실제 개인정보 및 내부자료를 업로드하지 마세요.</strong><p>파일은 이 브라우저 안에서만 분석하며 서버로 전송하거나 저장하지 않습니다.</p><button type="button" id="sample-button">샘플 데이터로 체험</button><button type="button" id="reset-button" class="secondary">입력·결과 초기화</button></aside><form id="upload-form"')
    html = html.replace('업로드 파일은 분석 후 자동 삭제됩니다.', '선택 파일은 브라우저 메모리에서만 처리됩니다.')
    html = html.replace('원본 양식은 유지하고 별도 Excel을 생성합니다.', '시연용 양식 복사본을 브라우저에서 생성합니다.')
    html = html.replace('다운로드 링크는 생성 후 30분 동안 유효합니다. 결과 파일은 output 폴더에도 저장됩니다.', '결과는 서버에 저장되지 않습니다. 초기화하거나 페이지를 닫으면 다운로드 링크가 해제됩니다.')
    html = html.replace('경주시 서무업무 · 상시학습 등록 지원', '교육·시연용 · 상시학습 등록 자동화 v1.2')
    html = html.replace('<span class="mark" aria-hidden="true">경주</span>', '<img class="learning-logo" src="./assets/gyeongju-ci.png" alt="경주시" width="42" height="44">')
    html = html.replace('<span class="local">', '<button type="button" class="learning-help" id="learning-help-button">ⓘ 상시학습 도움말</button><span class="local">')
    html = html.replace('</body>', '<dialog id="learning-help-dialog" aria-labelledby="learning-help-title"><h2 id="learning-help-title">상시학습 도우미 사용 안내</h2><ol><li>교육정보와 인정시간이 명시된 PDF 공문과 참석자 Excel을 선택합니다.</li><li>참석자 명단에서 읽어온 부서 목록을 검색하고 대상 부서를 선택합니다.</li><li>개인식별번호 명부는 선택 첨부입니다. 정확히 매칭되지 않은 번호는 빈셀로 유지됩니다.</li><li>분석 결과와 대상자를 검토한 뒤 필수교육·사회복지교육·참여유형을 확인합니다.</li><li>결과 Excel을 생성하고 내려받아 최종 확인합니다.</li></ol><p>원본 입력파일은 변경하지 않습니다. 테스트에는 가상 데이터만 사용해주세요.</p><button type="button" id="learning-help-close">확인</button></dialog><script type="module" src="./learning-help.js"></script></body>')
    html = html.replace('accept=".pdf"', 'accept=".pdf,.odt,.hwpx"').replace('공문 PDF', '공문 PDF, ODT 또는 HWPX').replace('PDF <b>', 'PDF · ODT · HWPX <b>').replace('PDF·XLSX /', 'PDF·ODT·HWPX·XLSX /').replace('PDF 공문', 'PDF, ODT 또는 HWPX 공문')
    html = html.replace('소속·직급·성명이 포함된 명단', '소속(부서)·성명(이름) 필수 / 직급 선택')
    html = html.replace('<head>', '<head><link rel="stylesheet" href="./demo-access.css">')
    html = html.replace('<body>', '<body class="learning-page">').replace('</head>', '<link rel="stylesheet" href="./gyeongju-theme.css"></head>')
    (DIST / 'learning.html').write_text(html,encoding='utf-8')
    shutil.copyfile(Path(__file__).resolve().parent / 'portal.html', DIST / 'index.html')
    with (DIST / 'style.css').open('a',encoding='utf-8') as style:
        style.write('\n.demo-notice{background:#eaf2ff;border:1px solid #c9daf4;border-radius:10px;padding:20px 24px;margin-bottom:22px}.demo-notice strong{font-size:14px;color:#244a7b}.demo-notice p{font-size:12px;color:#526b8e;margin:7px 0 14px}.secondary{background:#fff;color:#245dac;border:1px solid #bfd0e9;margin-left:8px}.demo-notice button{font-size:12px;padding:9px 14px}\n')
        style.write('.department-picker{display:grid;grid-template-columns:200px minmax(220px,1fr);gap:10px 14px;flex:2}.department-status{grid-column:1/-1;font-size:12px;color:#526b8e;min-height:20px}.department-picker input,.department-picker select{width:100%}.upload-footer{align-items:center}.upload-footer>.muted{flex:1}@media(max-width:800px){.department-picker{grid-template-columns:1fr;flex-basis:100%}}\n')
        style.write('.home-link{margin-left:auto;margin-right:18px;color:#d8e5f7;font-size:12px;text-decoration:none;white-space:nowrap}.home-link:hover{text-decoration:underline}@media(max-width:800px){header{padding:12px 18px;gap:8px;height:auto;flex-wrap:wrap}.home-link{margin-right:0}.local{margin-left:auto}}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.learning-logo{object-fit:contain}.learning-help{font-size:12px;padding:9px 14px;margin-right:14px;white-space:nowrap}#learning-help-dialog{max-width:620px;width:calc(100% - 40px);padding:30px;border:1px solid #c9d7e8;border-radius:16px;color:#193654}#learning-help-dialog::backdrop{background:#16263e66}#learning-help-dialog li{margin:14px 0;line-height:1.7}#learning-help-dialog p{line-height:1.7;margin-bottom:20px}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.file-error{display:block;color:#b42318;font-size:13px;line-height:1.6;white-space:normal;overflow-wrap:anywhere}.file-error[hidden]{display:none}.file-card.invalid-file{border-color:#d92d20;background:#fff7f6}.file-card .filename{overflow-wrap:anywhere}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.drop-hint{font-size:12px;color:#526b8e;line-height:1.6;margin:4px 0 10px}.file-card.drag-over{border:2px dashed #245dac;background:#eaf2ff;box-shadow:0 0 0 3px #245dac18}.file-card{transition:background .15s,border-color .15s}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.selected-file{display:flex;align-items:flex-start;gap:8px;width:100%;margin-top:12px}.file-card .selected-file .filename{flex:1;min-width:0;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.6;margin:0}.file-card .selected-file.has-file{background:#edf3fc;border-radius:8px;padding:10px 12px}.file-card .selected-file.has-file .filename{font-weight:750;color:#163d70;font-size:14px}.file-card .remove-file{flex:none;width:28px;height:28px;padding:0;margin:0;border:1px solid #a6bad5;border-radius:6px;background:#fff;color:#244a70;font-size:22px;line-height:24px}.file-card .remove-file:hover{background:#fee4e2;color:#b42318;border-color:#d92d20}.remove-file[hidden]{display:none}.remove-file:focus-visible{outline:3px solid #245dac;outline-offset:2px}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.analysis-ready-hint{flex-basis:100%;font-size:13px;color:#526b8e;line-height:1.6;margin:8px 0 0}.upload-footer{flex-wrap:wrap}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.notice-review label{display:block;margin:18px 0;font-weight:600}.notice-review input,.notice-review select{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #bfd0e9;border-radius:6px}.candidate-evidence{font-size:12px;font-weight:400;white-space:pre-wrap;color:#526b8e}.notice-review pre{white-space:pre-wrap;max-height:300px;overflow:auto;font-size:12px}.notice-review button{margin:6px 4px 6px 0}\n')
    with (DIST / 'style.css').open('a', encoding='utf-8') as style:
        style.write('\n.notice-review .confirm-education{background:#087f6b;color:white;border:1px solid #066653;padding:13px 22px;font-weight:700}.notice-review .confirm-education:hover{background:#066653}.review-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.review-actions p{margin:0}.confirmation-needed{color:#b42318;font-weight:700}.confirm-education:focus-visible{outline:3px solid #f3b746;outline-offset:4px}\n')
    print("공개 라이브러리·비식별 기준 양식 준비 완료")


if __name__ == '__main__':
    main()
