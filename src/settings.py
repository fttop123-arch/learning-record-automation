"""로컬 웹앱 설정. 양식 교체 시 TEMPLATE_PATH를 변경한다."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_PATH = ROOT / "(샘플)교육실적등록 양식_작업용.xlsx"
OUTPUT_DIR = ROOT / "output"
DEFAULT_DEPARTMENT = "디지털정책과"
MAX_FILE_BYTES = 20 * 1024 * 1024
SESSION_SECONDS = 30 * 60
MAX_SESSIONS = 50
