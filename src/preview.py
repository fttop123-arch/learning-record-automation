"""실행: python -B src/preview.py [--input-dir 폴더]"""
import argparse
from pathlib import Path
import sys

from parse_notice import parse_notice
from parse_attendees import parse_attendees, TARGET_DEPARTMENT, normalize_space
from load_reference import load_reference
from employee_lookup import EmployeeLookup


def unique_file(folder, pattern):
    matches = [p for p in folder.glob(pattern) if not p.name.startswith("~$")]
    if len(matches) != 1:
        raise ValueError(f"입력 파일을 하나로 확인할 수 없습니다: {pattern} ({len(matches)}개)")
    return matches[0]


def main():
    parser = argparse.ArgumentParser(description="상시학습 등록 예정 내용 미리보기 (파일 저장 없음)")
    parser.add_argument("--input-dir", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--generate", action="store_true", help="미리보기 후 확인값을 입력받아 Excel 복사본 생성")
    parser.add_argument("--employee-file", type=Path, help="직원정보 Excel 경로 (생략하면 B열 빈셀)")
    args = parser.parse_args()
    try:
        notice = parse_notice(unique_file(args.input_dir, "*.pdf"))
        roster = parse_attendees(unique_file(args.input_dir, "*참석자*명단*.xlsx"))
        reference = load_reference(unique_file(args.input_dir, "*교육실적등록*양식*.xlsx"), notice["type_raw"])
        employees = EmployeeLookup(args.employee_file)
        for attendee in roster["attendees"]:
            attendee["employee_lookup"] = employees.lookup(attendee["department"], attendee["name"])
    except (ValueError, OSError, KeyError) as error:
        print(f"처리 중단: {error}", file=sys.stderr)
        return 1

    method_code = 1 if normalize_space(notice["method"]) == "집합교육" else None
    duration = f'{notice["hours"]}시간 {notice["minutes"]}분'
    print("=== 교육정보 ===")
    for label, value in [
        ("교육명", notice["name"]), ("교육일", notice["date"]),
        ("시작시간", notice["start"]), ("종료시간", notice["end"]),
        ("교육장소", notice["place"]), ("학습방법 원문", notice["method"]),
        ("학습방법 코드", method_code if method_code is not None else "사용자 확인 필요"),
        ("교육유형 원문", notice["type_raw"]),
        ("교육유형 공식명", reference["official"] or "사용자 확인 필요"),
        ("인정시간", duration),
    ]:
        print(f"{label}: {value}")
    print(f'공식 교육유형 목록: {reference["count"]}개 / 정규화 일치: {len(reference["matches"])}개')
    print("\n=== 등록 대상자 ===")
    print(f'명단 전체: {roster["total"]}명 / {TARGET_DEPARTMENT}: {len(roster["attendees"])}명')
    for index, attendee in enumerate(roster["attendees"], 1):
        print(f'{index}. {attendee["name"] or "(성명 없음)"} / {attendee["rank"] or "(직급 없음)"} / {attendee["department"]} [{attendee["status"]}, 원본 {roster["sheet"]} {attendee["row"]}행]')
    if not roster["attendees"]:
        print("등록 대상자가 없습니다. 명단 확인이 필요합니다.")
    print("\n=== 개인식별번호 조회 ===")
    for attendee in roster["attendees"]:
        result = attendee["employee_lookup"]
        print(f'{attendee["name"]}: 개인식별번호 {result["employee_id"] or "미입력"} / 상태: {result["status"]} / {result["reason"]}')
    print("\n=== 자동 확정 ===")
    print(f'대상 부서: {TARGET_DEPARTMENT}\n교육일: {notice["date"]}\n실적시간: {duration}')
    if method_code is not None:
        print(f"학습방법: {method_code} (집합과정)")
    if reference["official"]:
        print(f'교육유형명: {reference["official"]}')
    print(f'제목: {notice["name"]}\n내용: {notice["name"]}')
    print("\n=== 사용자 확인 필요 ===")
    print("필수교육: 미확정\n사회복지교육: 미확정\n참여유형: 미확정")
    if any(a["employee_lookup"]["status"] != "matched" for a in roster["attendees"]):
        print("개인식별번호: 미매칭 대상자는 위 조회 사유 확인 필요")
    print("사회복지교육 시간/분: 여부 확인 전 미확정 (N 확정 시 빈셀)")
    if method_code is None:
        print("학습방법: 지원하는 자동 매핑이 없어 미확정")
    if not reference["official"]:
        print("교육유형명: 공식 목록과 단일 일치하지 않아 미확정")
    for attendee in roster["attendees"]:
        if attendee["status"] != "대상 부서 일치":
            print(f'{attendee["name"] or "(성명 없음)"}: {attendee["status"]}')
    if args.generate:
        from generate_excel import confirm_and_generate
        try:
            confirm_and_generate(
                unique_file(args.input_dir, "*교육실적등록*양식*.xlsx"),
                args.input_dir / "output", notice, roster, reference, method_code,
            )
        except (ValueError, OSError, EOFError, KeyboardInterrupt) as error:
            print(f"\n생성 중단: {error or '입력이 취소되었습니다.'}", file=sys.stderr)
            return 1
    else:
        print("\n미리보기 완료. 결과 Excel은 생성하지 않았습니다.")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
