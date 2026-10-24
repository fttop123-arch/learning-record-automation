# 브라우저 시연판 안내

이 폴더의 이전 README에 있던 실행·사용법은 루트 [README.md](../README.md), 구현 구조·배포/테스트 스냅샷·제한사항은 [PROJECT_NOTES.md](../PROJECT_NOTES.md)로 통합했습니다. Codex 작업 규칙은 [AGENTS.md](../AGENTS.md)입니다. 이 문서를 별도 개발일지로 누적하지 않습니다.

- 기본 실행(프로젝트 루트): `python -B run_web.py`
- 기본 URL: http://127.0.0.1:8001/
- 공개 시연: https://learning-record-automation-20261023.cwhcom1130.chatgpt.site/
- 테스트(이 폴더): `npm ci --ignore-scripts` 후 `npm test`
- `dist`는 배포 대상이며 직접 관리 JS/CSS와 생성 HTML/양식이 함께 있습니다.
- `prepare_assets.py`는 루트 양식으로 비식별 reference와 화면/라이브러리를 준비하며 Codex 번들 경로에 의존합니다. 일반 사용에 필수인 실행 단계가 아닙니다.
- 가상자료만 사용하세요. 시연용 암호는 서버 인증이 아니며 키/실제 직원정보/임시 결과를 배포하지 않습니다.

이전 문서의 ‘로컬 v1.2 배포 전’, ‘Node 테스트 26개’ 설명은 현재 상태가 아닙니다. 최신 상태는 NOTES의 날짜가 있는 검증 기록을 기준으로 확인하세요.
