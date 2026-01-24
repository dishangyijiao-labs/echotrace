from __future__ import annotations

import datetime as dt
import mimetypes
import sqlite3
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db.init_db import init_db
from mcp_gateway.client import call_tool as mcp_call_tool
from mcp_gateway.registry import load_providers

APP_ROOT = Path(__file__).resolve().parent
DEFAULT_DB_PATH = APP_ROOT / "data" / "app.db"
SCHEMA_PATH = APP_ROOT / "db" / "schema.sql"

app = FastAPI(title="EchoTrace Core")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


class MediaImportRequest(BaseModel):
    paths: List[str]


class JobCreateRequest(BaseModel):
    media_id: int
    engine: str = "whisper"
    model: str = "small"
    device: str = "cpu"


class SummarizeRequest(BaseModel):
    provider: str
    model: str
    prompt_type: str = "summary"
    text: str
    transcript_id: int | None = None
    update_summary: bool = True


@app.on_event("startup")
def _startup() -> None:
    init_db(DEFAULT_DB_PATH, SCHEMA_PATH)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/media/import")
def import_media(payload: MediaImportRequest) -> dict:
    if not payload.paths:
        raise HTTPException(status_code=400, detail="paths cannot be empty")

    created = []
    with _connect(DEFAULT_DB_PATH) as conn:
        for path_str in payload.paths:
            path = Path(path_str)
            if not path.exists():
                continue
            file_type, _ = mimetypes.guess_type(path.name)
            now = _now()
            cursor = conn.execute(
                """
                INSERT INTO media (path, filename, file_type, duration, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(path), path.name, file_type, None, now),
            )
            created.append({"id": cursor.lastrowid, "filename": path.name})
    return {"ok": True, "created": created}


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
def search(q: str = Query(min_length=1)) -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT s.id, s.transcript_id, s.start, s.end, s.text
            FROM segment_fts fts
            JOIN segment s ON s.id = fts.rowid
            WHERE segment_fts MATCH ?
            ORDER BY rank
            LIMIT 50
            """,
            (q,),
        ).fetchall()
    return {"ok": True, "data": [dict(row) for row in rows]}


@app.post("/summarize")
async def summarize(payload: SummarizeRequest) -> dict:
    providers = load_providers()
    provider = providers.get(payload.provider)
    if not provider:
        raise HTTPException(status_code=400, detail="unknown provider")

    tool_name = provider.get("tool", "summarize")
    result = await mcp_call_tool(
        provider,
        tool_name,
        {
            "text": payload.text,
            "prompt_type": payload.prompt_type,
            "model": payload.model,
        },
    )
    summary = result.get("text", "")
    if payload.transcript_id and payload.update_summary and summary:
        with _connect(DEFAULT_DB_PATH) as conn:
            conn.execute(
                "UPDATE transcript SET summary = ?, updated_at = ? WHERE id = ?",
                (summary, _now(), payload.transcript_id),
            )
    return {"ok": True, "summary": summary, "structured": result.get("structured")}


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8787, reload=True)
