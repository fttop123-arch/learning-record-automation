# 서무_상시학습 등록 자동화

## 로컬 업무용 실행

기존 FastAPI 웹앱과 CLI는 그대로 유지합니다. 현재 로컬 주소는 `http://127.0.0.1:8001/`입니다.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\run_web.py --port 8001
```

## 공개 Sites 시연판

공개 주소: https://learning-record-automation-20261023.cwhcom1130.chatgpt.site/

**교육·시연용 시스템입니다. 실제 개인정보 및 내부자료를 업로드하지 마세요.**

`site-demo/`에 별도로 구현했습니다. 파일을 서버로 전송하지 않고 브라우저 안에서 PDF 텍스트 추출, XLSX 읽기, 부서 선별, 번호 매칭, 양식 복제와 다운로드를 처리합니다. **샘플 데이터로 체험**을 누르면 TEST001/TEST002 가상 데이터로 바로 사용할 수 있습니다. 파일 선택 방식도 지원합니다.

| 구분 | 로컬 업무용 | 공개 시연판 |
|---|---|---|
| 실행 | Python/FastAPI + 기존 CLI | Sites 정적 HTML/JavaScript |
| 파일 처리 | 임시 폴더에서 처리 후 삭제 | 브라우저 메모리에서 처리 |
| 기준 양식 | 원본 프로젝트 양식 | 예시 번호·작성자·로컬 경로를 제거한 복사본 |
| 결과 | output 저장 + 다운로드 | 브라우저 다운로드만 |
| 번호 명부 | 명시적으로 지정/첨부 | 사용자가 선택, 서버 전송 없음 |
| 용도 | 로컬 업무 자동화 | 가상 데이터 교육·공개 시연 |

두 버전 모두 2/3컬럼 명부, N/N/0 기본값(웹), matched만 B열 입력, D열 수식, 사회복지교육 N의 O/P 빈셀을 유지합니다. 사회복지교육 Y는 추가 시간 확인이 필요해 생성하지 않습니다.

공개 서버에는 루트의 `테스트용_직원개인식별번호.xlsx`, 공문/참석자 샘플 원본, output, .env를 포함하지 않습니다. Sites는 정적 파일 및 Workers 서버 코드를 지원하지만 이 시연판에는 서버 코드를 사용하지 않았습니다. Python/FastAPI 서버를 Sites로 옮기지 않았습니다.

시연판 구성·검증 방법은 [site-demo/README.md](site-demo/README.md)에 있습니다. 기존 Python 테스트 39개와 시연판 Node 테스트 16개, 총 55개 통과. 실제 공개 URL의 샘플 모드·Chrome 다운로드 파일도 검증했습니다.

## 웹앱 실행과 사용

기존 CLI와 같은 교육정보 추출·매칭·Excel 생성 로직을 FastAPI 웹 화면에서 사용합니다. 외부 API, 로그인, DB, 외부 배포는 사용하지 않습니다.

현재 PC에서 실행 (PowerShell):

```powershell
Set-Location 'C:\Users\Owner\Desktop\AI실습\learning-record-automation'
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\run_web.py
```

브라우저에서 `http://127.0.0.1:8000/`에 접속합니다. 종료는 실행 터미널에서 Ctrl+C입니다. 현재 검증 시점에는 다른 로컬 앱이 8000 포트를 사용하고 있어 8001에서 검증했습니다. 다른 앱을 종료할 필요 없이 아래 명령으로 사용할 수 있습니다.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\run_web.py --port 8001
```

이 경우 접속 주소는 `http://127.0.0.1:8001/`입니다. 서버는 127.0.0.1에만 바인딩합니다. 검증 중 설치한 웹 패키지는 Git에서 제외된 `.web-packages`에 있으며 실행기가 자동으로 읽습니다.

다른 Python 환경에서 새로 설치할 경우:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -B run_web.py
```

패키지가 설치된 Python에서는 `python -m uvicorn src.app:app --host 127.0.0.1 --port 8000 --no-access-log`도 지원합니다. 개발용 자동 재실행은 `--reload`를 덧붙입니다.

사용 순서:

1. 공문 PDF와 참석자 XLSX를 첨부합니다. 개인식별번호 XLSX는 선택입니다.
2. 대상 부서(기본 디지털정책과)를 확인하고 **분석하기**를 누릅니다.
3. 교육정보, 대상자, 번호 매칭 상태 및 상단 확인 필요 목록을 검토합니다.
4. 필수교육/사회복지교육/참여유형을 선택합니다. 웹 기본값은 N/N/0입니다.
5. **상시학습 등록 Excel 생성** 후 **결과 Excel 다운로드**를 누릅니다.

직원정보를 첨부하지 않거나 중복·미발견·번호 누락이 있으면 사유를 표시하고 B열을 빈셀로 생성합니다. 참석자 명단 자체의 동명이인·누락, 참석자 0명, 공식 교육유형 미확정, 지원하지 않는 학습방법은 생성을 막습니다. 사회복지교육 Y도 시간/분 추가 확인이 필요하여 생성하지 않습니다. 파일이나 부서를 바꾸면 다시 분석해야 합니다.

설정은 `src/settings.py`에서 수정합니다. `TEMPLATE_PATH`는 프로젝트 기본 기준 양식, `OUTPUT_DIR`는 결과 저장 폴더, `DEFAULT_DEPARTMENT`는 기본 부서입니다. 파일당 업로드 제한은 20MB입니다. 업로드 원본은 임시 폴더에서 읽고 분석 성공/실패 후 삭제합니다. 분석 결과는 서버 메모리에 최대 30분 보관하고 주기적으로 정리합니다. 다운로드 링크도 30분 후 만료되며 서버 재시작 시 사라집니다. 결과 Excel은 output에 남아 있으므로 필요에 따라 사용자가 정리합니다. 미리보기에는 개인식별번호가 표시되지만 서버 접근 로그는 기본 실행에서 끕니다.

웹 구조:

- `src/app.py`: 업로드·분석·생성·다운로드 API, 임시 업로드 정리와 메모리 작업 관리
- `src/settings.py`: 기준 양식, 부서, 출력 위치, 크기/시간 제한
- `templates/index.html`: 파일 첨부 → 분석 → 확인 → 다운로드 업무 화면
- `static/style.css`: 네이비·흰색·회색 중심의 업무 화면 스타일
- `static/app.js`: 화면 상태, 분석 요청, 사용자 선택, 다운로드 표시
- `run_web.py`: 로컬 실행기
- `tests/test_web.py`: 웹 HTTP 테스트

전체 테스트 실행 (현재 PC):

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) '.web-packages'
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B -m unittest discover -s tests -v
```

현재 39개(기존 23개 + 웹 16개) 테스트가 통과했습니다. 원본 해시, 양식 보존, 선택값 반영, 빈셀, 덮어쓰기 방지, 업로드 오류, 만료 및 다운로드를 검증합니다. 실제 브라우저 업로드·N/N/0 생성 후 HTTP 다운로드도 확인했습니다.

지원 범위: 현재 샘플과 같은 텍스트 PDF 형식, XLSX 참석자 명단, 2/3컬럼 번호 명부입니다. 스캔 PDF/OCR·임의 공문 레이아웃·사회복지교육 Y 시간 입력은 아직 지원하지 않습니다. Excel 수식은 원문과 참조를 보존하며 실제 수식 계산 결과는 Excel에서 열어 확인해야 합니다. 여러 서버 프로세스나 외부 공개 용도는 지원하지 않습니다.

## 기존 터미널 미리보기

공문 PDF, 참석자 명단, 기준 양식을 읽기 전용으로 분석합니다. 기본 실행은 미리보기이고 `--generate`를 지정하면 확인값 입력 후 결과 Excel 복사본을 저장합니다. API/LLM 호출은 없습니다.

Python 3.10 이상에서 `python -m pip install -r requirements.txt`로 의존성을 설치한 후 실행합니다.

```powershell
python -B src/preview.py
```

## 사용자 확인 후 Excel 생성

기존 명령은 미리보기 전용으로 유지합니다. 생성하려면 다음과 같이 실행합니다.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\src\preview.py --generate
```

미리보기 후 필수교육(N/Y, 기본 N), 사회복지교육(N/Y, 기본 N), 참여유형(0/1, 기본값 없음)을 입력합니다. 잘못된 값은 재입력합니다. 개인식별번호는 직원정보 조회가 matched일 때만 입력하며 그 외에는 빈셀입니다.

사회복지교육 Y는 시간/분 추가 확인이 필요하므로 파일 생성을 중단합니다. 동명이인, 누락, 교육유형/학습방법 미확정, 대상자 없음도 생성을 중단합니다.

결과는 `output/교육명_상시학습등록.xlsx`에 저장합니다. 같은 이름이 있으면 `_2`, `_3` 등을 붙여 기존 결과도 덮어쓰지 않습니다. Sheet1의 실제 데이터는 머리글과 대상자 행만 생성합니다. 원본의 D2 수식을 상대참조로 복사하며 O/P는 빈셀입니다. B열은 직원정보 조회 결과에 따릅니다.

`src/generate_excel.py`는 원본 XLSX 패키지의 구성요소를 복제하여 Sheet1 데이터, 사용 범위, 계산 체인 및 열 때 재계산 설정만 변경합니다. openpyxl은 읽기/검증과 수식 상대참조 변환에만 사용하며 저장하지 않습니다. 그 외 구성요소는 바이트 단위 동일성을 검사하고, Sheet1의 데이터 이외 설정도 비교합니다. 저장된 파일은 다시 읽어 대상자 수와 각 셀 값을 검증합니다.

기존 이름정의의 `#REF!` 및 조건부서식/유효성검사의 기존 적용 범위는 그대로 보존합니다. 코드 수식의 캐시값을 임의로 넣지 않으며 실제 수식 계산 결과는 Excel에서 열어 확인해야 합니다. 개인식별번호 내부자료 연계 전이므로 생성 파일은 최종 등록 완료본이 아닙니다.

다른 입력 폴더는 `--input-dir "폴더 경로"`로 지정합니다. 입력 폴더에서 PDF 하나, 이름에 `참석자`와 `명단`이 포함된 Excel 하나, `교육실적등록`과 `양식`이 포함된 Excel 하나를 찾습니다. 후보가 여러 개면 임의 선택하지 않고 중단합니다. `-B`는 Python 캐시 파일 생성을 방지합니다.

- `src/parse_notice.py`: 번호가 있는 교육정보 항목을 PDF 텍스트에서 추출합니다. 현재 샘플의 단일 날짜/시간 형식을 지원합니다. 스캔 PDF의 OCR은 지원하지 않습니다. 교육시간은 일정 차이가 아닌 공문의 인정시간을 사용합니다.
- `src/parse_attendees.py`: 소속/직급/성명 헤더를 찾아 디지털정책과만 선별한 뒤 부서 내 동일 성명을 검사합니다. 공백만 제거하여 비교합니다.
- `src/load_reference.py`: 기준 양식의 교육유형명 이름정의가 가리키는 숨김 교육유형 시트 목록을 읽습니다. 공백과 가운뎃점 차이만 정규화하며, 단일 일치일 때 원본 공식 문자열을 사용합니다. 코드는 생성하지 않습니다.
- `src/preview.py`: 입력 파일 탐색과 미리보기 출력. 직원정보 조회 상태와 미입력 사유도 표시합니다.

공문 형식이나 필수 추출값이 확인되지 않으면 중단합니다. 유형 미일치/다중 일치는 미확정으로 출력합니다. 현재 샘플 공문은 인정대상 60명, 제공 명단은 14명으로 범위가 다릅니다. 이 미리보기의 대상자는 제공 명단 안에서만 선별합니다.

## 직원정보 연계 (이번 단계는 가상 데이터만 사용)

```powershell
# 가상 직원정보로 미리보기
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\src\preview.py --employee-file .\tests\fixtures\employees.xlsx

# 가상 직원정보를 연결하고 확인값 입력 후 생성
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\src\preview.py --generate --employee-file .\tests\fixtures\employees.xlsx

# 테스트 전체 실행
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B -m unittest discover -s tests -v
```

직원정보 파일을 지정하지 않으면 자동 탐색하지 않고 no_file로 처리합니다. 지정 경로가 없어도 no_file이며 B열은 빈셀입니다. 존재하는 파일의 헤더가 잘못되거나 헤더 후보가 여러 개이면 중단합니다.

`src/employee_lookup.py`의 `EMPLOYEE_COLUMNS`에서 실제 컬럼명을 한 곳에서 변경할 수 있습니다. 기본 이름 컬럼은 `NAME_COLUMN_ALIASES`의 성명/이름을 모두 지원합니다. 모든 시트를 읽어 헤더를 찾으며 위치는 고정하지 않습니다. 부서와 성명은 양끝 공백만 제거하고 정확하게 비교합니다. 내부 공백/유사어 매칭은 하지 않습니다.

부서 컬럼이 있으면 기존의 부서+성명 조회를 사용합니다. 부서 컬럼이 없는 2컬럼 파일은 참석자 명단에서 디지털정책과를 먼저 선별한 다음 이름만으로 조회합니다. 부서 컬럼이 있는데 해당 행의 부서가 비어 있는 경우에는 이름 조회로 전환하지 않습니다. 조회 결과의 `match_mode`는 `department_name` 또는 `name_only`입니다. 이름/성명 헤더가 동시에 있거나 헤더가 중복되면 임의 선택 없이 중단합니다.

프로젝트 루트의 가상 테스트 파일로 결과 생성:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\src\preview.py --generate --employee-file .\테스트용_직원개인식별번호.xlsx
```

| 상태 | 의미 | B열 |
|---|---|---|
| matched | 부서+성명(부서 없으면 이름)으로 정확히 1행, 텍스트 번호 있음 | 원본 번호를 텍스트로 입력 |
| duplicate | 같은 조회 키로 2행 이상 (같은 번호여도 중복) | 빈셀 |
| not_found | 해당 조회 키로 찾지 못함 | 빈셀 |
| no_file | 경로 미지정 또는 파일 없음 | 빈셀 |
| missing_id | 번호 빈셀 또는 텍스트 상수가 아님 | 빈셀 |

3컬럼 파일에서는 다른 부서의 동명 직원이 매칭에 영향을 주지 않습니다. 2컬럼 파일에서는 부서를 구분할 수 없으므로 파일 전체에서 같은 이름이 2개 이상이면 duplicate입니다. 중복 판단은 번호 유무보다 우선합니다. 번호는 추측·생성·숫자 변환하지 않습니다. 숫자, 수식, 오류 셀은 자동입력하지 않고 missing_id로 확인을 요청합니다. 향후 원본 번호 컬럼은 텍스트 상수로 준비해야 합니다.

가상 fixture:

- `tests/fixtures/employees.xlsx`: 디지털정책과 김지현 TEST001, 문형식 TEST002, 경제정책과 김지현 TEST003, 디지털정책과 테스트빈번호(빈셀).
- `tests/fixtures/employees_duplicate.xlsx`: 디지털정책과 김지현을 TEST001/TEST004 두 행으로 구성한 동명이인 사례.
- `tests/fixtures/employees_mapping.xlsx`: 소속부서/직원명/내부번호로 헤더가 다른 사례.
- `tests/fixtures/build_fixtures.mjs`: 위 가상 데이터만 사용하는 fixture 재생성 도구. 일반 실행에는 필요 없습니다.

현재 실제 내부 직원정보는 포함하지 않았습니다. 나중에는 정확한 부서명·성명·텍스트 개인식별번호가 있는 Excel과 컬럼명 확인이 필요합니다. 실제 파일은 저장소 밖에 보관하고 `--employee-file`로 명시적으로 지정할 수 있습니다. 조회 결과 번호는 터미널과 결과 Excel에 표시됩니다.
