# 서무_상시학습 등록 자동화

## 로컬 테스트 실행

첫 화면은 **경주시 서무 AI 업무도우미** 포털입니다. 상시학습 카드를 누르면 `learning.html`의 기존 분석·Excel 생성 화면으로 이동하고, 화면 상단의 **업무도우미 홈**으로 돌아옵니다. 초과근무수당 계산 도우미는 현재 준비 중 안내만 제공합니다. 새 포털과 부서 선택 기능은 로컬 검토 중이며 공개 Sites에는 아직 배포하지 않았습니다.

`run_web.py`는 이제 `site-demo/dist`를 그대로 제공하는 로컬 테스트 실행기입니다. 기본 주소는 `http://127.0.0.1:8001/`이고 Python 표준 라이브러리만 사용합니다. 수정 → 저장 → 새로고침으로 확인하며 push/배포는 확인이 끝난 뒤 별도로 진행합니다. 기존 Python 모듈·CLI는 삭제하지 않았지만 기본 웹 화면으로 사용하지 않습니다.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B .\run_web.py --port 8001
```

## 공개 Sites 시연판

공개 주소: https://learning-record-automation-20261023.cwhcom1130.chatgpt.site/

**교육·시연용 시스템입니다. 실제 개인정보 및 내부자료를 업로드하지 마세요.**

`site-demo/`에 별도로 구현했습니다. 파일을 서버로 전송하지 않고 브라우저 안에서 PDF 텍스트 추출, XLSX 읽기, 부서 선별, 번호 매칭, 양식 복제와 다운로드를 처리합니다. **샘플 데이터로 체험**을 누르면 TEST001/TEST002 가상 데이터로 바로 사용할 수 있습니다. 파일 선택 방식도 지원합니다.

| 구분 | 로컬 테스트 | 공개 Sites |
|---|---|---|
| 코드 | site-demo/dist 최신 작업 파일 | 같은 폴더의 마지막 배포본 |
| 파일 처리 | 브라우저 메모리 | 브라우저 메모리 |
| 결과 | 브라우저 다운로드 | 브라우저 다운로드 |
| 수정 반영 | 저장 후 새로고침 | 별도 배포 후 반영 |
| 현재 상태 | 부서 검색·선택 v1.2 검토 중 | 이전 배포 v1.1 유지 |

두 버전 모두 2/3컬럼 명부, N/N/0 기본값(웹), matched만 B열 입력, D열 수식, 사회복지교육 N의 O/P 빈셀을 유지합니다. 사회복지교육 Y는 추가 시간 확인이 필요해 생성하지 않습니다.

공개 서버에는 루트의 `테스트용_직원개인식별번호.xlsx`, 공문/참석자 샘플 원본, output, .env를 포함하지 않습니다. Sites는 정적 파일 및 Workers 서버 코드를 지원하지만 이 시연판에는 서버 코드를 사용하지 않았습니다. Python/FastAPI 서버를 Sites로 옮기지 않았습니다.

시연판 구성·검증 방법은 [site-demo/README.md](site-demo/README.md)에 있습니다. 기존 Python 테스트 39개와 시연판 Node 테스트 26개, 총 65개 통과. 실제 공개 URL의 샘플 모드·Chrome 다운로드 파일도 검증했습니다.

## 로컬 화면 사용 순서

1. 참석자 명단 Excel을 선택하면 PDF와 무관하게 부서 목록을 먼저 읽습니다.
2. 목록에 디지털정책과가 있으면 기본 선택합니다. 없으면 직접 선택해야 합니다.
3. 부서명 검색에 `노인`, `노인'`, `노 인복지과` 등을 입력하면 후보를 좁혀 보여줍니다.
4. **대상 부서 선택**에서 정확한 이름을 선택합니다. 검색어만 입력한 상태에서는 분석하지 않습니다.
5. PDF와 선택적 번호 명부를 첨부하고 분석 → 확인값 선택 → 생성·다운로드합니다.

검색에서는 공백과 일부 따옴표만 제거하며 최종 선택값은 명단의 정확한 부서명입니다. 이 값을 참석자 선별과 번호 조회에 공통으로 사용합니다. 명단을 바꾸면 이전 목록·선택·분석 결과를 지우고 새 명단을 읽습니다.

부서 선택 UI 변경은 현재 로컬 작업에만 반영했습니다. 공개 URL은 사용자가 확인한 뒤 배포합니다.

## 보존된 이전 FastAPI·CLI

`src/app.py`, `src/settings.py`, `static/`, `templates/`와 Python CLI는 남겨두었습니다. 이전 FastAPI를 별도로 실행해야 한다면 웹 의존성이 설치된 환경에서 `python -m uvicorn src.app:app --host 127.0.0.1 --port 8002 --no-access-log`를 사용합니다. 현재 기본 실행기와는 별개입니다.

기존 테스트 실행:

```powershell
$env:PYTHONPATH = Join-Path (Get-Location) '.web-packages'
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -B -m unittest discover -s tests -v
```

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

### ODT 공문 (로컬 웹)
공문 입력에서 PDF와 ODT를 지원합니다. ODT의 content.xml 본문과 표 안의 문단을 브라우저에서 읽고 기존 교육정보 분석 규칙을 사용합니다. 이미지 전용·암호화 문서는 지원하지 않습니다. AI API나 외부 업로드를 사용하지 않습니다.


### HWPX 공문 (로컬 웹)
공문 입력은 PDF·ODT·HWPX를 지원합니다. HWPX의 Contents/section*.xml을 구역 번호 순서로 읽으며 문단과 표 내부 텍스트를 기존 분석 규칙에 연결합니다. 미리보기 텍스트는 사용하지 않습니다. HWP는 아직 미지원이며 HWPX/PDF 변환 안내를 표시합니다. 이미지 전용·암호화 문서는 지원하지 않습니다. 가상 HWPX 검증 완료, 한글에서 저장한 실제 HWPX 호환성은 별도 확인이 필요합니다.
형식 참고: https://tech.hancom.com/hwpxformat/


### 시연용 공용 암호
프로젝트 루트의 `암호설정.cmd`를 실행하여 8자 이상의 전용 암호를 두 번 입력합니다. 입력 문자는 표시되지 않습니다. 변경할 때도 같은 파일을 실행합니다. 원문은 저장하지 않으며 PBKDF2 검증값은 Git에서 제외된 `site-demo/dist/demo-access.json`에 저장합니다. 미설정 시 진입 화면에서 안내하며 업무 화면을 열지 않습니다. 같은 탭의 새로고침과 페이지 이동에는 sessionStorage로 인증을 유지합니다. 브라우저의 탭 복제·세션 복원 기능은 세션을 복구할 수 있으므로 탭 닫기가 엄격한 로그아웃을 보장하지는 않습니다. 암호 변경 후 새로고침하면 기존 인증은 무효화됩니다.
이 기능은 우회 가능한 브라우저 시연용 진입 화면이며 서버 접근 통제가 아닙니다. 원본 정적 자산과 암호 검증값은 방문자가 읽을 수 있습니다. 외부 사이트 적용 시 설정 파일을 포함한 별도 배포가 필요하며, 설정 전에는 배포하지 않습니다.
