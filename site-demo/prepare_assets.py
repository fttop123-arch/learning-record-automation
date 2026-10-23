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
    html = html.replace('href="/static/style.css"','href="./style.css"').replace('<script src="/static/app.js" defer></script>', '<script src="./vendor/jszip.min.js" defer></script><script type="module" src="./app.js?v=20261023-2"></script>')
    html = html.replace('id="department" value=', 'id="department" list="department-options" value=')
    html = html.replace('</label><p class="muted">PDF·XLSX', '</label><datalist id="department-options"></datalist><p class="muted">PDF·XLSX')
    html = html.replace('로컬 업무 도구', '공개 시연판').replace('기준 양식: 프로젝트 기본 양식 사용', '기준 양식: 시연용 비식별 양식 사용')
    html = html.replace('<form id="upload-form"', '<aside class="demo-notice"><strong>교육·시연용 시스템입니다. 실제 개인정보 및 내부자료를 업로드하지 마세요.</strong><p>파일은 이 브라우저 안에서만 분석하며 서버로 전송하거나 저장하지 않습니다.</p><button type="button" id="sample-button">샘플 데이터로 체험</button><button type="button" id="reset-button" class="secondary">입력·결과 초기화</button></aside><form id="upload-form"')
    html = html.replace('업로드 파일은 분석 후 자동 삭제됩니다.', '선택 파일은 브라우저 메모리에서만 처리됩니다.')
    html = html.replace('원본 양식은 유지하고 별도 Excel을 생성합니다.', '시연용 양식 복사본을 브라우저에서 생성합니다.')
    html = html.replace('다운로드 링크는 생성 후 30분 동안 유효합니다. 결과 파일은 output 폴더에도 저장됩니다.', '결과는 서버에 저장되지 않습니다. 초기화하거나 페이지를 닫으면 다운로드 링크가 해제됩니다.')
    html = html.replace('경주시 서무업무 · 상시학습 등록 지원', '교육·시연용 · 상시학습 등록 자동화 v1.1')
    (DIST / 'index.html').write_text(html,encoding='utf-8')
    with (DIST / 'style.css').open('a',encoding='utf-8') as style:
        style.write('\n.demo-notice{background:#eaf2ff;border:1px solid #c9daf4;border-radius:10px;padding:20px 24px;margin-bottom:22px}.demo-notice strong{font-size:14px;color:#244a7b}.demo-notice p{font-size:12px;color:#526b8e;margin:7px 0 14px}.secondary{background:#fff;color:#245dac;border:1px solid #bfd0e9;margin-left:8px}.demo-notice button{font-size:12px;padding:9px 14px}\n')
    print("공개 라이브러리·비식별 기준 양식 준비 완료")


if __name__ == '__main__':
    main()
