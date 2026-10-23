"""실행: python -m uvicorn src.app:app --host 127.0.0.1 --port 8000"""
import asyncio
from contextlib import asynccontextmanager
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import settings
from .employee_lookup import EmployeeLookup
from .generate_excel import generate_result, validate_ready
from .load_reference import load_reference
from .parse_attendees import parse_attendees, normalize_space
from .parse_notice import parse_notice

STATUS_LABELS = {
    "matched": "정상 매칭", "duplicate": "동명이인 확인 필요",
    "not_found": "직원정보에서 찾지 못함", "missing_id": "개인식별번호 없음",
    "no_file": "개인식별번호 파일 미첨부",
}


def create_app(template_path=None, output_dir=None):
    template = Path(template_path or settings.TEMPLATE_PATH)
    output = Path(output_dir or settings.OUTPUT_DIR)
    sessions, downloads = {}, {}

    def cleanup():
        now = monotonic()
        for cache in (sessions, downloads):
            for token in list(cache):
                if cache[token]["expires"] <= now:
                    del cache[token]

    @asynccontextmanager
    async def lifespan(app):
        async def sweep():
            while True:
                await asyncio.sleep(60)
                cleanup()
        task = asyncio.create_task(sweep())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        sessions.clear()
        downloads.clear()

    app = FastAPI(title="서무_상시학습 등록 자동화", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])

    @app.middleware("http")
    async def local_requests(request, call_next):
        if request.method == "POST":
            origin = request.headers.get("origin")
            if request.headers.get("x-requested-with") != "LearningRecord" or (origin and origin != str(request.base_url).rstrip("/")):
                return JSONResponse({"errors": ["이 화면에서 다시 요청해주세요."]}, status_code=403)
        cleanup()
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        return response

    app.mount("/static", StaticFiles(directory=settings.ROOT / "static"), name="static")

    @app.get("/")
    async def index():
        return FileResponse(settings.ROOT / "templates" / "index.html", media_type="text/html")

    @app.get("/api/config")
    async def config():
        return {"department": settings.DEFAULT_DEPARTMENT, "max_file_mb": settings.MAX_FILE_BYTES // (1024 * 1024)}

    def analyze_files(paths, department):
        errors = []
        notice = roster = reference = None
        employees = None
        for label, operation in (
            ("공문 정보 추출 실패", lambda: parse_notice(paths["notice"])),
            ("참석자 명단 분석 실패", lambda: parse_attendees(paths["attendees"], department)),
            ("개인식별번호 명부 분석 실패", lambda: EmployeeLookup(paths.get("employees"))),
        ):
            try:
                value = operation()
                if label.startswith("공문"):
                    notice = value
                elif label.startswith("참석자"):
                    roster = value
                else:
                    employees = value
            except ValueError as error:
                errors.append(f"{label}: {error}")
            except Exception:
                errors.append(f"{label}: 파일 내용과 형식을 확인해주세요.")
        if notice:
            try:
                reference = load_reference(template, notice["type_raw"])
            except Exception:
                errors.append("기준 양식의 교육유형 목록을 읽을 수 없습니다. 양식 설정을 확인해주세요.")
        if errors:
            return None, errors
        warnings = []
        for attendee in roster["attendees"]:
            result = employees.lookup(attendee["department"], attendee["name"])
            attendee["employee_lookup"] = result
            result["label"] = STATUS_LABELS[result["status"]]
            if result["status"] != "matched":
                warnings.append(f'{attendee["name"]}: {result["label"]} — {result["reason"]}')
            if attendee["status"] != "대상 부서 일치":
                warnings.append(f'{attendee["name"]}: {attendee["status"]}')
        if not paths.get("employees") and not roster["attendees"]:
            warnings.append("개인식별번호 파일 미첨부: B열은 빈셀로 유지됩니다.")
        method_code = 1 if normalize_space(notice["method"]) == "집합교육" else None
        try:
            validate_ready(roster, reference, method_code)
            can_generate = True
        except ValueError as error:
            warnings.append(str(error))
            can_generate = False
        if not reference["official"]:
            warnings.append("교육유형 공식 목록과 단일 일치하지 않습니다. 확인 후 다시 분석해주세요.")
        state = {"notice": notice, "roster": roster, "reference": reference, "method_code": method_code,
                 "warnings": warnings, "can_generate": can_generate,
                 "template_hash": hashlib.sha256(template.read_bytes()).hexdigest()}
        return state, []

    @app.post("/api/analyze")
    async def analyze(request: Request):
        if len(sessions) >= settings.MAX_SESSIONS:
            return JSONResponse({"errors": ["검토 중인 작업이 많습니다. 잠시 후 다시 시도해주세요."]}, status_code=429)
        try:
            form = await request.form(max_files=3, max_fields=2)
        except Exception:
            return JSONResponse({"errors": ["파일 첨부 요청을 읽지 못했습니다."]}, status_code=422)
        errors, uploads = [], []
        department = str(form.get("department", settings.DEFAULT_DEPARTMENT)).strip()
        if not department or len(department) > 80:
            errors.append("대상 부서를 1~80자로 입력해주세요.")
        try:
            with TemporaryDirectory(prefix="learning-record-") as directory:
                paths = {}
                for field, label, extension in (("notice", "교육실적 인정 공문", ".pdf"), ("attendees", "참석자 명단", ".xlsx"), ("employees", "개인식별번호 명부", ".xlsx")):
                    upload = form.get(field)
                    if not upload or not getattr(upload, "filename", None):
                        if field != "employees":
                            errors.append(f"{label} 파일을 첨부해주세요.")
                        continue
                    uploads.append(upload)
                    if Path(upload.filename).suffix.lower() != extension:
                        errors.append(f"{label}: {extension} 파일만 첨부할 수 있습니다.")
                        continue
                    destination = Path(directory) / (field + extension)
                    size = 0
                    with destination.open("wb") as stream:
                        while chunk := await upload.read(1024 * 1024):
                            size += len(chunk)
                            if size > settings.MAX_FILE_BYTES:
                                errors.append(f"{label}: 파일당 20MB 이하로 첨부해주세요.")
                                break
                            stream.write(chunk)
                    if not size:
                        errors.append(f"{label}: 빈 파일입니다.")
                    paths[field] = destination
                if errors:
                    return JSONResponse({"errors": errors}, status_code=422)
                state, errors = await run_in_threadpool(analyze_files, paths, department)
                if errors:
                    return JSONResponse({"errors": errors}, status_code=422)
        finally:
            await form.close()
        token = uuid4().hex
        state["expires"] = monotonic() + settings.SESSION_SECONDS
        sessions[token] = state
        return {"analysis_id": token, "notice": state["notice"], "roster": state["roster"],
                "reference": state["reference"], "method_code": state["method_code"],
                "warnings": state["warnings"], "can_generate": state["can_generate"]}

    @app.post("/api/generate")
    async def generate(request: Request):
        try:
            body = await request.json()
            if not isinstance(body, dict):
                raise ValueError()
        except Exception:
            return JSONResponse({"errors": ["확인값 요청이 올바르지 않습니다."]}, status_code=422)
        state = sessions.get(str(body.get("analysis_id", "")))
        if state is None:
            return JSONResponse({"errors": ["분석 결과가 없거나 30분이 지났습니다. 파일을 다시 분석해주세요."]}, status_code=410)
        if not state["can_generate"]:
            return JSONResponse({"errors": state["warnings"]}, status_code=422)
        required, welfare, participation = (body.get(key) for key in ("required", "welfare", "participation"))
        if required not in ("N", "Y") or welfare not in ("N", "Y") or participation not in ("0", "1"):
            return JSONResponse({"errors": ["필수교육·사회복지교육 N/Y와 참여유형 0/1을 선택해주세요."]}, status_code=422)
        if welfare == "Y":
            return JSONResponse({"errors": ["사회복지교육 Y는 시간/분 추가 확인이 필요합니다. 현재 버전에서는 생성할 수 없습니다."]}, status_code=422)
        try:
            if hashlib.sha256(template.read_bytes()).hexdigest() != state["template_hash"]:
                raise ValueError("기준 양식이 변경되었습니다. 다시 분석해주세요.")
            destination = await run_in_threadpool(generate_result, template, output, state["notice"], state["roster"],
                                                 state["reference"], state["method_code"], required, welfare, participation)
        except ValueError as error:
            return JSONResponse({"errors": [str(error)]}, status_code=422)
        except Exception:
            return JSONResponse({"errors": ["결과 파일을 생성하지 못했습니다. output 폴더의 쓰기 권한과 열려 있는 파일을 확인해주세요."]}, status_code=500)
        token = uuid4().hex
        downloads[token] = {"path": destination, "expires": monotonic() + settings.SESSION_SECONDS}
        attendees = state["roster"]["attendees"]
        matched = sum(a["employee_lookup"]["status"] == "matched" for a in attendees)
        return {"filename": destination.name, "download_url": f"/api/download/{token}",
                "education": state["notice"]["name"], "count": len(attendees), "matched": matched, "needs_review": len(attendees) - matched}

    @app.get("/api/download/{token}")
    async def download(token: str):
        result = downloads.get(token)
        if result is None or not result["path"].is_file():
            return JSONResponse({"errors": ["다운로드 링크가 만료되었거나 파일이 없습니다. output 폴더를 확인해주세요."]}, status_code=404)
        return FileResponse(result["path"], filename=result["path"].name,
                            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    return app


app = create_app()
