"""텍스트 PDF 공문의 명시된 교육정보만 추출한다."""
import re
from datetime import date, time

from pypdf import PdfReader


def parse_notice(path):
    text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    if not text.strip():
        raise ValueError("PDF에서 텍스트를 읽을 수 없습니다. 스캔 PDF/OCR은 지원하지 않습니다.")

    def field(label):
        pattern = r"\s*".join(map(re.escape, label))
        matches = re.findall(r"^\s*\d+\.\s*" + pattern + r"\s*[:：]\s*(.+)$", text, re.M)
        if len(matches) != 1:
            raise ValueError(f"공문의 {label} 항목을 하나로 확인할 수 없습니다.")
        return matches[0].strip()

    schedule = field("교육일시")
    match = re.fullmatch(
        r"(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*"
        r"(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})\s*[~～〜]\s*(\d{1,2}):(\d{2})",
        schedule,
    )
    if not match:
        raise ValueError(f"지원하지 않는 교육일시 형식: {schedule}")
    year, month, day, sh, sm, eh, em = map(int, match.groups())
    start, end = time(sh, sm), time(eh, em)
    if end <= start:
        raise ValueError("종료시간이 시작시간 이후인지 확인이 필요합니다.")
    duration = field("인정시간")
    match = re.fullmatch(r"(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?", duration)
    if not match or not any(v is not None for v in match.groups()):
        raise ValueError(f"지원하지 않는 인정시간 형식: {duration}")
    hours, minutes = (int(v or 0) for v in match.groups())
    if minutes > 59:
        raise ValueError("인정시간의 분은 0~59인지 확인이 필요합니다.")
    return {
        "name": field("교육명"), "date": date(year, month, day).isoformat(),
        "start": start.strftime("%H:%M"), "end": end.strftime("%H:%M"),
        "place": field("교육장소"), "method": field("학습방법"),
        "type_raw": field("교육유형"), "hours": hours, "minutes": minutes,
    }
