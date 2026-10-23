"""공개 Sites와 같은 정적 코드를 로컬 8001에서 테스트한다."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="상시학습 등록 자동화 로컬 테스트 (Sites와 동일한 코드)")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    class PreviewHandler(SimpleHTTPRequestHandler):
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".mjs": "text/javascript", ".js": "text/javascript"}

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, format, *args):
            pass

    directory = Path(__file__).resolve().parent / "site-demo" / "dist"
    handler = partial(PreviewHandler, directory=str(directory))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"로컬 테스트: http://127.0.0.1:{args.port}/", flush=True)
        print("수정한 파일을 저장한 뒤 브라우저에서 새로고침하세요. 종료: Ctrl+C", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
