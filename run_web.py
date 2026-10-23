"""일반 Python 또는 현재 Codex Python에서 로컬 웹앱 실행."""
from pathlib import Path
import sys

packages = Path(__file__).resolve().parent / ".web-packages"
if packages.is_dir():
    sys.path.insert(0, str(packages))

if __name__ == "__main__":
    import argparse
    import uvicorn
    parser = argparse.ArgumentParser(description="서무 상시학습 등록 자동화 로컬 웹앱")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run("src.app:app", host="127.0.0.1", port=args.port, access_log=False)
