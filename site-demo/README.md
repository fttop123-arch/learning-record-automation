# 상시학습 등록 자동화 · 공개 Sites 시연판

공개 주소: https://learning-record-automation-20261023.cwhcom1130.chatgpt.site/

교육·시연용 시스템입니다. 실제 개인정보 및 내부자료를 업로드하지 마세요.

## 사용

1. 공개 주소에서 **샘플 데이터로 체험**을 누릅니다. 김지현 TEST001, 문형식 TEST002가 표시됩니다.
2. 기본값 N/N/0과 교육정보·대상자를 확인합니다.
3. **상시학습 등록 Excel 생성** → **결과 Excel 다운로드**를 누릅니다.
4. 파일로 체험하려면 가상 PDF 공문·참석자 XLSX를 선택합니다. 번호 명부는 선택이며 2/3컬럼 모두 지원합니다.
5. 대상 부서를 변경하면 다시 분석하거나 샘플 모드를 다시 실행합니다. **입력·결과 초기화**는 선택 파일과 결과 링크를 지웁니다.

## 환경에서 확인한 지원 방식

- Sites 스킬의 지원 런타임은 정적 파일 및 Cloudflare Workers 서버 코드입니다.
- 이 배포는 `.openai/hosting.json`의 `static.directory=dist`로 실제 공개 배포했습니다.
- 기존 Python/FastAPI를 직접 실행하지 않고 별도 브라우저 JavaScript로 구현했습니다.
- PDF.js의 Worker로 PDF 텍스트를 읽고, JSZip과 XML API로 XLSX를 읽고 복제합니다.
- 실제 파일 선택·PDF 추출·부서 선별과 샘플 모드를 브라우저에서 확인했습니다.
- 브라우저가 생성한 XLSX는 실제 Chrome 다운로드 후 Python/openpyxl로 다시 열어 확인했습니다.

## 구조

- `dist/index.html`, `style.css`: 로컬 버전 디자인을 이어받은 공개 시연 화면
- `dist/app.js`: 파일 선택, 샘플 모드, 검토, 확인값, 다운로드·초기화
- `dist/core.js`: 교육정보 추출, 부서 선별, 2/3컬럼 번호 매칭과 상태값
- `dist/workbooks.js`: XLSX 읽기, 공식 목록 읽기, 원본 ZIP 복제, 셀 변경 및 생성 후 검증
- `dist/reference.xlsx`: 공개용으로 비식별 처리한 기준 양식 복사본
- `dist/vendor/`: PDF.js·JSZip 공개 라이브러리와 라이선스. 런타임 CDN 요청 없이 같은 사이트에서 로드
- `prepare_assets.py`: 프로젝트 양식에서 공개 복사본과 화면 자산을 준비. 직원정보 파일은 읽지 않음
- `tests/demo.test.mjs`: 업무 규칙 및 실제 XLSX 생성·보존 테스트 16개
- `.openai/hosting.json`: Sites 프로젝트 ID와 정적 디렉터리 지정

## 처리·보존 범위

선택 파일은 File API로 읽고 서버 업로드 API는 사용하지 않습니다. 개인정보를 localStorage/DB/서버에 저장하지 않습니다. 다운로드는 메모리 Blob으로 생성하며 초기화/페이지 종료 시 링크를 해제합니다. 새로고침하면 결과가 사라집니다.

공개용 양식은 샘플 입력행을 비우고 기존 예시 식별번호와 주민번호 형식 예시를 TEST001로 대체했습니다. 작성자와 로컬 절대 경로도 제거했습니다. 공식 교육유형 목록, 이름정의, 숨김 시트, 유효성검사와 보호는 유지합니다. 공개용 양식에서 결과를 만들 때에는 데이터/범위, 계산 설정·체인 외 ZIP 구성요소를 바꾸지 않습니다. D열은 수식으로 유지하며 계산 캐시를 임의 작성하지 않습니다.

이전 로컬 버전의 `src/`, CLI, 실행 명령은 바꾸지 않았습니다. Sites 배포 체크아웃과 ZIP은 프로젝트 저장소 밖의 별도 작업 폴더에서 관리했습니다. 배포에는 `dist`와 Sites manifest만 포함합니다.

## 개발·검증

```powershell
cd site-demo
npm ci --ignore-scripts
npm test
```

테스트용 XLSX는 Git에서 제외되는 `test-output/`에만 생성합니다. 개발 라이브러리와 npm 캐시도 배포/Git에서 제외합니다.

로컬 미리보기:

```powershell
python -m http.server 8010 --bind 127.0.0.1 --directory site-demo/dist
```

새 기준 양식에서 공개 자산을 다시 준비하는 경우 프로젝트 루트에서 `python -B site-demo/prepare_assets.py`를 실행합니다. 이 도구는 현재 Codex 번들 라이브러리 경로를 사용합니다. 재생성 후 테스트와 배포 내용 점검을 다시 수행해야 합니다.

## 제한

현 샘플 형식의 텍스트 PDF, 일반 XLSX 명단을 대상으로 합니다. OCR·XLS·매크로·암호화 Excel·임의 공문 형식·사회복지교육 Y 시간 입력은 지원하지 않습니다. 숫자/수식 형태의 식별번호는 확정하지 않습니다. 실제 Excel 엔진의 D열 재계산은 Excel에서 열어 확인해야 합니다. 공개 시연판은 실제 내부자료 처리 시스템으로 인증되거나 검증된 서비스가 아닙니다.
