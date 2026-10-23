"""시연용 브라우저 암호 설정. 실제 접근 통제용이 아닙니다."""
import getpass
import hashlib
import json
import secrets
from pathlib import Path

def main():
    print("시연용 공용 암호를 설정합니다. 입력한 문자는 표시되지 않습니다.")
    password = getpass.getpass("새 암호 (8자 이상): ")
    if len(password) < 8:
        raise SystemExit("8자 이상으로 다시 실행해주세요. 기존 설정은 유지됩니다.")
    if password != getpass.getpass("새 암호 확인: "):
        raise SystemExit("암호가 다릅니다. 기존 설정은 유지됩니다.")
    salt = secrets.token_bytes(16)
    iterations = 210000
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    config = dict(version=secrets.token_hex(16), salt=salt.hex(), iterations=iterations, digest=digest.hex())
    target = Path(__file__).parent / 'dist/demo-access.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(config), encoding='utf-8')
    temp.replace(target)
    print("설정 완료. 로컬 페이지를 새로고침하세요. 외부 사이트에는 별도 배포가 필요합니다.")

if __name__ == '__main__':
    main()
