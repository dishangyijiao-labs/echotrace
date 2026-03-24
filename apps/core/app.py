from __future__ import annotations

import asyncio
import datetime as dt
import io
import json
import logging
import mimetypes
import os
import sqlite3
import zipfile
from pathlib import Path
from typing import List, Optional

# Load .env file if present (simple dotenv without extra dependency)
_env_file = Path(__file__).with_name(".env")
if _env_file.is_file():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

# Sanitize NO_PROXY: httpx cannot parse IPv6 CIDR entries (e.g. fd7a:115c:a1e0::/48)
for _key in ("NO_PROXY", "no_proxy"):
    _val = os.environ.get(_key, "")
    if _val:
        _cleaned = ",".join(e.strip() for e in _val.split(",") if e.strip().count(":") < 2)
        os.environ[_key] = _cleaned

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from db.init_db import init_db
from download_manager import download_manager, DownloadStatus
from errors import E, ErrorResponse, raise_api_error, sanitize_error, build_error
from llm_service import llm_summarize, PROVIDERS
from pipeline.model_manager import get_model_info, is_model_downloaded, download_model

_app_log = logging.getLogger("echotrace.app")

APP_ROOT = Path(__file__).resolve().parent
# Allow the Tauri host to redirect data to a writable directory (e.g. ~/Library/Application Support/…)
_data_dir = os.environ.get("ECHOTRACE_DATA_DIR")
DEFAULT_DB_PATH = Path(_data_dir) / "app.db" if _data_dir else APP_ROOT / "data" / "app.db"

# RAG imports - 语义搜索功能（可选，无需环境变量，可在设置页面开启）
try:
    from rag.vector_store import get_vector_store, sync_all_transcripts_to_vector
    from rag.retriever import get_retriever
    RAG_AVAILABLE = True
    _app_log.info("RAG modules available")
except ImportError as e:
    RAG_AVAILABLE = False
    _app_log.info("RAG modules not available: %s", e)


def _settings_path() -> Path:
    return DEFAULT_DB_PATH.parent / "echotrace_settings.json"


def _load_settings() -> dict:
    path = _settings_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {}


def _save_settings(data: dict) -> None:
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _rag_enabled_from_settings() -> bool:
    settings = _load_settings()
    # Honour env var for backward compat, but settings file takes precedence
    env_flag = os.getenv("ECHOTRACE_SEMANTIC_SEARCH", "false").lower() == "true"
    return bool(settings.get("semantic_search_enabled", env_flag)) and RAG_AVAILABLE


RAG_ENABLED: bool = _rag_enabled_from_settings()
_app_log.info("Semantic search %s (RAG_AVAILABLE=%s)", "enabled" if RAG_ENABLED else "disabled", RAG_AVAILABLE)
SCHEMA_PATH = APP_ROOT / "db" / "schema.sql"

_ALLOWED_MIMES = {
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
    "video/webm", "video/mpeg",
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/flac",
    "audio/aac", "audio/mp4", "audio/x-m4a",
}
_MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024  # 10 GB

app = FastAPI(title="EchoTrace Core")
_ALLOWED_ORIGINS = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    err = build_error(
        code=E.INTERNAL_ERROR,
        message=str(exc.detail),
    )
    return JSONResponse(status_code=exc.status_code, content=err.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    _app_log.exception("Unhandled error on %s %s", request.method, request.url.path)
    err = build_error(
        code=E.INTERNAL_ERROR,
        message="An unexpected error occurred.",
        detail=sanitize_error(str(exc)),
    )
    return JSONResponse(status_code=500, content=err.model_dump())


def _require_rag() -> None:
    """Raise 501 if RAG module is not available."""
    if not RAG_ENABLED:
        if not RAG_AVAILABLE:
            raise_api_error(501, E.RAG_NOT_ENABLED, "Semantic search dependencies are not installed.")
        raise_api_error(501, E.RAG_NOT_ENABLED, "Semantic search is not enabled. Enable it in Settings.")


def validate_import_path(path_str: str) -> Path:
    """Validate a user-supplied media path."""
    path = Path(path_str).resolve()
    # Guard against path traversal
    try:
        path.relative_to(Path("/"))
    except ValueError:
        raise_api_error(400, E.PATH_TRAVERSAL, f"Invalid path: {path_str}")
    if not path.exists():
        raise_api_error(400, E.FILE_NOT_FOUND, f"File not found: {path.name}")
    if path.stat().st_size > _MAX_FILE_BYTES:
        raise_api_error(413, E.FILE_TOO_LARGE, f"File exceeds 10 GB limit: {path.name}")
    mime, _ = mimetypes.guess_type(path.name)
    if mime not in _ALLOWED_MIMES:
        raise_api_error(415, E.UNSUPPORTED_MIME, f"Unsupported file type: {mime or 'unknown'}")
    return path


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


class MediaImportRequest(BaseModel):
    paths: List[str]


_VALID_ENGINES = {"whisper"}
_VALID_MODELS = {"tiny", "base", "small", "medium", "large-v2", "large-v3"}
_VALID_DEVICES = {"cpu", "cuda", "auto"}

# Estimated peak RAM (MB) per model during transcription (measured via benchmark)
_MODEL_RAM_MB = {
    "tiny": 600, "base": 800, "small": 1200,
    "medium": 2800, "large-v2": 4500, "large-v3": 4500,
}


class JobCreateRequest(BaseModel):
    media_id: int
    engine: str = "whisper"
    model: str = "small"
    device: str = "cpu"

    def model_post_init(self, __context):
        if self.engine not in _VALID_ENGINES:
            raise ValueError(f"Invalid engine: {self.engine!r}")
        if self.model not in _VALID_MODELS:
            raise ValueError(f"Invalid model: {self.model!r}")
        if self.device not in _VALID_DEVICES:
            raise ValueError(f"Invalid device: {self.device!r}")


class SummarizeRequest(BaseModel):
    provider: str
    model: str
    prompt_type: str = "summary"
    text: str
    transcript_id: int | None = None
    update_summary: bool = True


class SemanticSearchRequest(BaseModel):
    query: str
    mode: str = "hybrid"  # "keyword" | "semantic" | "hybrid"
    limit: int = 20


class BatchExportRequest(BaseModel):
    transcript_ids: List[int]
    format: str = "txt"  # "txt" | "srt" | "md"


@app.on_event("startup")
def _startup() -> None:
    init_db(DEFAULT_DB_PATH, SCHEMA_PATH)
    download_manager.recover_incomplete()


@app.get("/")
def root() -> dict:
    return {
        "name": "EchoTrace Core API",
        "version": "0.1.0",
        "description": "Local Video Archive Search Engine for Content Creators",
        "use_case": "Find any moment in your video library in seconds",
        "target_users": [
            "Short-video editors",
            "Podcast producers",
            "Course creators",
            "MCN content teams"
        ],
        "features": [
            "Batch video/audio transcription",
            "Full-text search across all content",
            "Timestamp-based snippet export",
            "EDL/XML export for editing software"
        ],
        "privacy": "All processing happens locally - no cloud uploads"
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/media/import")
def import_media(payload: MediaImportRequest) -> dict:
    if not payload.paths:
        raise_api_error(400, E.PATHS_EMPTY, "paths cannot be empty")

    settings = _load_settings()
    auto = settings.get("auto_transcribe", _DEFAULT_APP_SETTINGS["auto_transcribe"])
    model = settings.get("default_model", _DEFAULT_APP_SETTINGS["default_model"])

    created = []
    jobs_created = 0
    with _connect(DEFAULT_DB_PATH) as conn:
        for path_str in payload.paths:
            path = validate_import_path(path_str)
            file_type, _ = mimetypes.guess_type(path.name)
            now = _now()
            cursor = conn.execute(
                """
                INSERT INTO media (path, filename, file_type, duration, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(path), path.name, file_type, None, now),
            )
            media_id = cursor.lastrowid
            created.append({"id": media_id, "filename": path.name})

            if auto:
                conn.execute(
                    """
                    INSERT INTO job (
                        media_id, status, engine, model, device, progress,
                        processed_segments, total_segments, error, created_at, updated_at
                    ) VALUES (?, 'queued', 'whisper', ?, 'cpu', 0, 0, 0, NULL, ?, ?)
                    """,
                    (media_id, model, now, now),
                )
                jobs_created += 1

    return {"ok": True, "created": created, "jobs_created": jobs_created}


@app.get("/media")
def list_media() -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        rows = conn.execute(
            "SELECT id, path, filename, file_type, duration, created_at FROM media ORDER BY id DESC"
        ).fetchall()
    return {"ok": True, "data": [dict(row) for row in rows]}


@app.post("/jobs/transcribe")
def create_job(payload: JobCreateRequest) -> dict:
    now = _now()
    with _connect(DEFAULT_DB_PATH) as conn:
        media = conn.execute("SELECT id FROM media WHERE id = ?", (payload.media_id,)).fetchone()
        if not media:
            raise HTTPException(status_code=404, detail="media not found")
        cursor = conn.execute(
            """
            INSERT INTO job (
                media_id, status, engine, model, device, progress, processed_segments, total_segments,
                error, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.media_id,
                "queued",
                payload.engine,
                payload.model,
                payload.device,
                0,
                0,
                0,
                None,
                now,
                now,
            ),
        )
    return {"ok": True, "job_id": cursor.lastrowid}


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: int) -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        row = conn.execute("SELECT status FROM job WHERE id = ?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="job not found")
        if row["status"] not in ("queued", "running"):
            raise HTTPException(status_code=400, detail=f"cannot cancel job in '{row['status']}' state")
        conn.execute(
            "UPDATE job SET status = 'cancelled', updated_at = ? WHERE id = ?",
            (_now(), job_id),
        )
    return {"ok": True}


@app.get("/jobs")
def list_jobs() -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT id, media_id, status, engine, model, device,
                   progress, processed_segments, total_segments,
                   error, created_at, updated_at
            FROM job
            ORDER BY id DESC
            """
        ).fetchall()
    return {"ok": True, "data": [dict(row) for row in rows]}


@app.get("/events/jobs")
async def job_events():
    """SSE stream: push job list whenever data changes (checked every 1s)."""

    async def _generate():
        last_snapshot = None
        while True:
            with _connect(DEFAULT_DB_PATH) as conn:
                rows = conn.execute(
                    """
                    SELECT id, media_id, status, engine, model, device,
                           progress, processed_segments, total_segments,
                           error, created_at, updated_at
                    FROM job
                    ORDER BY id DESC
                    """
                ).fetchall()
            snapshot = json.dumps([dict(r) for r in rows], ensure_ascii=False)
            if snapshot != last_snapshot:
                yield f"data: {snapshot}\n\n"
                last_snapshot = snapshot
            await asyncio.sleep(1)

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/transcripts")
def list_transcripts() -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT t.id, t.media_id, t.content, t.language, t.summary, t.created_at, t.updated_at,
                   m.filename
            FROM transcript t
            JOIN media m ON t.media_id = m.id
            ORDER BY t.updated_at DESC
            """
        ).fetchall()
    return {"ok": True, "data": [dict(row) for row in rows]}


@app.get("/transcripts/{transcript_id}")
def get_transcript(transcript_id: int) -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        transcript = conn.execute(
            """
            SELECT t.id, t.media_id, t.content, t.language, t.summary, t.created_at, t.updated_at,
                   m.filename, m.path as media_path
            FROM transcript t
            JOIN media m ON t.media_id = m.id
            WHERE t.id = ?
            """,
            (transcript_id,),
        ).fetchone()
        if not transcript:
            raise HTTPException(status_code=404, detail="transcript not found")
        segments = conn.execute(
            """
            SELECT id, start, end, text
            FROM segment
            WHERE transcript_id = ?
            ORDER BY start ASC
            """,
            (transcript_id,),
        ).fetchall()
    return {"ok": True, "data": {**dict(transcript), "segments": [dict(row) for row in segments]}}


@app.get("/search")
def search(
    q: str = Query(min_length=1),
    limit: int = Query(ge=1, le=200, default=50),
    offset: int = Query(ge=0, default=0),
    date_from: Optional[str] = Query(default=None, description="ISO date filter start (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="ISO date filter end (YYYY-MM-DD)"),
    duration_min: Optional[float] = Query(default=None, ge=0, description="Min duration in seconds"),
    duration_max: Optional[float] = Query(default=None, ge=0, description="Max duration in seconds"),
    language: Optional[str] = Query(default=None, description="Filter by detected language code"),
    file_type: Optional[str] = Query(default=None, description="Filter by MIME type prefix e.g. video"),
    sort_by: str = Query(default="relevance", pattern="^(relevance|date|duration)$", description="Sort order: relevance | date | duration"),
) -> dict:
    # Build filter clauses and params
    filters: list[str] = []
    params: list = [q]  # first param is always the FTS match

    if date_from:
        filters.append("m.created_at >= ?")
        params.append(date_from)
    if date_to:
        filters.append("m.created_at <= ?")
        params.append(date_to + "T23:59:59Z")
    if duration_min is not None:
        filters.append("m.duration >= ?")
        params.append(duration_min)
    if duration_max is not None:
        filters.append("m.duration <= ?")
        params.append(duration_max)
    if language:
        filters.append("t.language = ?")
        params.append(language)
    if file_type:
        filters.append("m.file_type LIKE ?")
        params.append(f"{file_type}%")

    where_extra = (" AND " + " AND ".join(filters)) if filters else ""

    order_clause = {
        "date": "m.created_at DESC",
        "duration": "m.duration DESC",
        "relevance": "fts.rank",
    }.get(sort_by, "fts.rank")

    with _connect(DEFAULT_DB_PATH) as conn:
        total = conn.execute(
            f"""
            SELECT COUNT(1)
            FROM segment_fts fts
            JOIN segment s ON s.id = fts.rowid
            JOIN transcript t ON t.id = s.transcript_id
            JOIN media m ON m.id = t.media_id
            WHERE segment_fts MATCH ?{where_extra}
            """,
            params,
        ).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT s.id,
                   s.transcript_id,
                   s.start,
                   s.end,
                   s.text,
                   m.filename,
                   m.duration,
                   m.file_type,
                   t.language,
                   s.text AS snippet
            FROM segment_fts fts
            JOIN segment s ON s.id = fts.rowid
            JOIN transcript t ON t.id = s.transcript_id
            JOIN media m ON m.id = t.media_id
            WHERE segment_fts MATCH ?{where_extra}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()
    return {
        "ok": True,
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [dict(row) for row in rows],
    }


@app.post("/summarize")
async def summarize(payload: SummarizeRequest) -> dict:
    if payload.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="unknown provider")

    summary = await llm_summarize(
        provider_name=payload.provider,
        model=payload.model,
        text=payload.text,
        prompt_type=payload.prompt_type,
    )
    if payload.transcript_id and payload.update_summary and summary:
        with _connect(DEFAULT_DB_PATH) as conn:
            conn.execute(
                "UPDATE transcript SET summary = ?, updated_at = ? WHERE id = ?",
                (summary, _now(), payload.transcript_id),
            )
    return {"ok": True, "summary": summary}


@app.get("/export/{transcript_id}")
def export_transcript(transcript_id: int, format: str = "txt") -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        transcript = conn.execute(
            "SELECT id, content FROM transcript WHERE id = ?", (transcript_id,)
        ).fetchone()
        if not transcript:
            raise HTTPException(status_code=404, detail="transcript not found")
        if format not in {"txt", "md", "srt"}:
            raise HTTPException(status_code=400, detail="unsupported format")
        if format in {"txt", "md"}:
            return {"ok": True, "content": transcript["content"]}
        segments = conn.execute(
            "SELECT start, end, text FROM segment WHERE transcript_id = ? ORDER BY start ASC",
            (transcript_id,),
        ).fetchall()
    if not segments:
        raise HTTPException(status_code=400, detail="no segments to export")

    def _fmt(ts: float) -> str:
        hours = int(ts // 3600)
        minutes = int((ts % 3600) // 60)
        seconds = ts % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}".replace(".", ",")

    lines = []
    for idx, seg in enumerate(segments, start=1):
        lines.append(str(idx))
        lines.append(f"{_fmt(seg['start'])} --> {_fmt(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return {"ok": True, "content": "\n".join(lines).strip()}


def _fmt_srt_ts(ts: float) -> str:
    hours = int(ts // 3600)
    minutes = int((ts % 3600) // 60)
    seconds = ts % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}".replace(".", ",")


def _build_srt(segments) -> str:
    lines = []
    for idx, seg in enumerate(segments, start=1):
        lines.append(str(idx))
        lines.append(f"{_fmt_srt_ts(seg['start'])} --> {_fmt_srt_ts(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines).strip()


@app.post("/export/batch")
def batch_export(payload: BatchExportRequest) -> StreamingResponse:
    """Export multiple transcripts as a ZIP archive."""
    if not payload.transcript_ids:
        raise HTTPException(status_code=400, detail="transcript_ids cannot be empty")
    if payload.format not in {"txt", "md", "srt"}:
        raise HTTPException(status_code=400, detail="unsupported format")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        with _connect(DEFAULT_DB_PATH) as conn:
            for tid in payload.transcript_ids:
                transcript = conn.execute(
                    "SELECT id, content FROM transcript WHERE id = ?", (tid,)
                ).fetchone()
                if not transcript:
                    continue
                if payload.format in {"txt", "md"}:
                    content = transcript["content"] or ""
                else:
                    segments = conn.execute(
                        "SELECT start, end, text FROM segment WHERE transcript_id = ? ORDER BY start ASC",
                        (tid,),
                    ).fetchall()
                    content = _build_srt(segments)
                zf.writestr(f"transcript_{tid}.{payload.format}", content)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=echotrace_export.zip"},
    )


@app.delete("/transcripts/{transcript_id}")
def delete_transcript(transcript_id: int) -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        transcript = conn.execute(
            "SELECT id FROM transcript WHERE id = ?", (transcript_id,)
        ).fetchone()
        if not transcript:
            raise HTTPException(status_code=404, detail="transcript not found")
        conn.execute("DELETE FROM segment WHERE transcript_id = ?", (transcript_id,))
        conn.execute("DELETE FROM transcript WHERE id = ?", (transcript_id,))
    return {"ok": True}


@app.post("/transcripts/{transcript_id}/write-subtitle")
def write_subtitle(transcript_id: int) -> dict:
    """Write an SRT subtitle file alongside the source media file (non-destructive)."""
    import subprocess
    with _connect(DEFAULT_DB_PATH) as conn:
        transcript = conn.execute(
            """
            SELECT t.id, m.path as media_path, m.file_type
            FROM transcript t
            JOIN media m ON m.id = t.media_id
            WHERE t.id = ?
            """,
            (transcript_id,),
        ).fetchone()
        if not transcript:
            raise HTTPException(status_code=404, detail="transcript not found")
        segments = conn.execute(
            "SELECT start, end, text FROM segment WHERE transcript_id = ? ORDER BY start ASC",
            (transcript_id,),
        ).fetchall()

    if not segments:
        raise HTTPException(status_code=400, detail="no segments available")

    media_path = Path(transcript["media_path"]).resolve()
    if not media_path.exists():
        raise HTTPException(status_code=400, detail="media file not found")

    srt_path = media_path.with_suffix(".srt").resolve()
    if srt_path.parent != media_path.parent:
        raise HTTPException(status_code=400, detail="invalid subtitle path")

    srt_content = _build_srt(segments)
    srt_path.write_text(srt_content, encoding="utf-8")

    return {"ok": True, "srt_path": str(srt_path), "segments": len(segments)}


@app.get("/models")
def list_models() -> dict:
    """List available Whisper models and their download status"""
    models = ["tiny", "base", "small", "medium", "large-v2", "large-v3"]
    return {
        "models": [
            {
                "name": model,
                **get_model_info(model)
            }
            for model in models
        ]
    }


@app.get("/models/{model_name}")
def get_model_status(model_name: str) -> dict:
    """Get status of a specific model"""
    info = get_model_info(model_name)
    if not info:
        raise HTTPException(status_code=404, detail="Model not found")

    return {
        "model": model_name,
        **info
    }


@app.get("/models/{model_name}/preflight")
def model_preflight(model_name: str) -> dict:
    """Check if the system has enough memory to run this model."""
    try:
        import psutil
        available_mb = psutil.virtual_memory().available / (1024 ** 2)
    except ImportError:
        return {"ok": True, "warning": None}

    required_mb = _MODEL_RAM_MB.get(model_name, 0)
    if not required_mb:
        return {"ok": True, "warning": None}

    enough = available_mb >= required_mb
    return {
        "ok": True,
        "enough": enough,
        "available_mb": round(available_mb),
        "required_mb": required_mb,
        "warning": None if enough else f"available {round(available_mb)} MB < required ~{required_mb} MB",
    }


@app.post("/models/{model_name}/download")
async def start_model_download(model_name: str, device: str = "cpu") -> dict:
    """Enqueue an async background model download. Poll /models/{name}/download/status or
    stream progress from /models/{name}/download/progress (SSE)."""
    valid_models = {"tiny", "base", "small", "medium", "large-v2", "large-v3"}
    if model_name not in valid_models:
        raise HTTPException(status_code=404, detail=f"Unknown model: {model_name}")

    if is_model_downloaded(model_name):
        return {"ok": True, "status": DownloadStatus.DONE, "message": f"Model '{model_name}' is already downloaded"}

    if download_manager.is_running(model_name):
        task = download_manager.get_task(model_name)
        return {"ok": True, "status": task.status, "message": "Download already in progress"}

    await download_manager.start_download(model_name, device, download_model)
    return {"ok": True, "status": DownloadStatus.QUEUED, "message": f"Download of '{model_name}' started"}


@app.get("/models/{model_name}/download/status")
def model_download_status(model_name: str) -> dict:
    """Get the current download status for a model."""
    if is_model_downloaded(model_name):
        return {"ok": True, "model": model_name, "status": DownloadStatus.DONE, "progress": 1.0}
    task = download_manager.get_task(model_name)
    if not task:
        return {"ok": True, "model": model_name, "status": "not_started", "progress": 0.0}
    return {"ok": True, "model": model_name, "status": task.status, "progress": task.progress, "message": task.message, "error": task.error}


@app.get("/models/{model_name}/download/progress")
async def model_download_progress(model_name: str):
    """SSE stream of download progress events for a model."""
    return StreamingResponse(
        download_manager.event_stream(model_name),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.delete("/models/{model_name}/download")
async def cancel_model_download(model_name: str) -> dict:
    """Cancel an in-progress model download."""
    cancelled = await download_manager.cancel(model_name)
    if not cancelled:
        raise HTTPException(status_code=404, detail="No active download for this model")
    return {"ok": True, "message": f"Download of '{model_name}' cancelled"}


# ==================== RAG & Agent Endpoints ====================

@app.post("/rag/index")
def index_transcript_to_vector(transcript_id: int, embedding_provider: str = "local") -> dict:
    """为指定转录文本建立向量索引"""
    _require_rag()

    with _connect(DEFAULT_DB_PATH) as conn:
        # 检查转录是否存在
        transcript = conn.execute("SELECT id FROM transcript WHERE id = ?", (transcript_id,)).fetchone()
        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found")

        # 获取分段
        segments = conn.execute(
            "SELECT id, start, end, text FROM segment WHERE transcript_id = ?",
            (transcript_id,),
        ).fetchall()

        seg_list = [dict(s) for s in segments]

    vector_store = get_vector_store(embedding_provider)
    count = vector_store.index_transcript(transcript_id, seg_list)

    return {"ok": True, "transcript_id": transcript_id, "indexed_segments": count}


@app.post("/rag/sync-all")
def sync_all_to_vector(embedding_provider: str = "local") -> dict:
    """同步所有转录文本到向量库"""
    _require_rag()

    result = sync_all_transcripts_to_vector(DEFAULT_DB_PATH, embedding_provider)
    return {"ok": True, **result}


@app.post("/search/semantic")
def semantic_search(payload: SemanticSearchRequest) -> dict:
    """语义搜索（支持混合检索）"""
    _require_rag()

    retriever = get_retriever(DEFAULT_DB_PATH)
    results = retriever.search(payload.query, mode=payload.mode, limit=payload.limit)

    return {"ok": True, "data": results, "total": len(results), "mode": payload.mode}


@app.get("/rag/status")
def rag_status() -> dict:
    """RAG 模块状态"""
    return {
        "ok": True,
        "available": RAG_AVAILABLE,
        "enabled": RAG_ENABLED,
        "features": {
            "semantic_search": RAG_ENABLED,
            "hybrid_retrieval": RAG_ENABLED,
        } if RAG_ENABLED else {}
    }


# ---------------------------------------------------------------------------
# App settings endpoints
# ---------------------------------------------------------------------------

_DEFAULT_APP_SETTINGS = {
    "semantic_search_enabled": False,
    "auto_transcribe": True,
    "default_model": "small",
}


@app.get("/settings")
def get_app_settings() -> dict:
    """返回应用运行时设置"""
    current = _load_settings()
    return {"ok": True, "data": {**_DEFAULT_APP_SETTINGS, **current}}


class AppSettingsUpdate(BaseModel):
    semantic_search_enabled: Optional[bool] = None
    auto_transcribe: Optional[bool] = None
    default_model: Optional[str] = None


@app.patch("/settings")
def update_app_settings(payload: AppSettingsUpdate) -> dict:
    """更新应用运行时设置"""
    global RAG_ENABLED
    current = _load_settings()
    if payload.semantic_search_enabled is not None:
        if payload.semantic_search_enabled and not RAG_AVAILABLE:
            raise_api_error(422, E.RAG_NOT_ENABLED, "Cannot enable semantic search: dependencies not installed.")
        current["semantic_search_enabled"] = payload.semantic_search_enabled
        RAG_ENABLED = payload.semantic_search_enabled and RAG_AVAILABLE
        _app_log.info("Semantic search toggled to %s", RAG_ENABLED)
    if payload.auto_transcribe is not None:
        current["auto_transcribe"] = payload.auto_transcribe
    if payload.default_model is not None:
        if payload.default_model not in _VALID_MODELS:
            raise HTTPException(status_code=400, detail=f"Invalid model: {payload.default_model}")
        current["default_model"] = payload.default_model
    _save_settings(current)
    return {"ok": True, "data": {**_DEFAULT_APP_SETTINGS, **current}}


if __name__ == "__main__":
    import uvicorn

    # Disable reload in bundled app — the reloader crashes on macOS .app bundles
    # because os.getcwd() fails when there is no valid working directory.
    is_bundled = ".app/Contents/Resources" in os.path.abspath(__file__)
    uvicorn.run("app:app", host="127.0.0.1", port=8787, reload=not is_bundled)
