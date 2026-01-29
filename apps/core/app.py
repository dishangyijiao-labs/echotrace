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
from pipeline.model_manager import get_model_info, is_model_downloaded, download_model

# RAG imports - 语义搜索功能（可选）
# 设置 ECHOTRACE_SEMANTIC_SEARCH=true 启用语义搜索（需要下载模型）
# 默认只用全文搜索（无需模型，立即可用）
import os
SEMANTIC_SEARCH_ENABLED = os.getenv("ECHOTRACE_SEMANTIC_SEARCH", "false").lower() == "true"

if SEMANTIC_SEARCH_ENABLED:
try:
    from rag.vector_store import get_vector_store, sync_all_transcripts_to_vector
    from rag.retriever import get_retriever
    from rag.agents import get_search_agent, ClipExtractorAgent
    RAG_ENABLED = True
        print("✅ 语义搜索已启用（需要下载嵌入模型）")
    except ImportError as e:
        RAG_ENABLED = False
        print(f"⚠️ 语义搜索模块加载失败: {e}")
else:
    RAG_ENABLED = False
    print("ℹ️ 使用全文搜索模式（无需下载模型，立即可用）")
    print("   如需启用语义搜索，设置环境变量: export ECHOTRACE_SEMANTIC_SEARCH=true")

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


class SemanticSearchRequest(BaseModel):
    query: str
    mode: str = "hybrid"  # "keyword" | "semantic" | "hybrid"
    limit: int = 20


class AgentQueryRequest(BaseModel):
    query: str
    agent_type: str = "search"  # "search" | "clip_extractor"


@app.on_event("startup")
def _startup() -> None:
    init_db(DEFAULT_DB_PATH, SCHEMA_PATH)


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
def search(
    q: str = Query(min_length=1),
    limit: int = Query(ge=1, le=200, default=50),
    offset: int = Query(ge=0, default=0),
) -> dict:
    with _connect(DEFAULT_DB_PATH) as conn:
        total = conn.execute(
            "SELECT COUNT(1) FROM segment_fts WHERE segment_fts MATCH ?",
            (q,),
        ).fetchone()[0]
        rows = conn.execute(
            """
            SELECT s.id,
                   s.transcript_id,
                   s.start,
                   s.end,
                   s.text,
                   m.filename,
                   snippet(fts, 0, '', '', '...', 12) AS snippet
            FROM segment_fts fts
            JOIN segment s ON s.id = fts.rowid
            JOIN transcript t ON t.id = s.transcript_id
            JOIN media m ON m.id = t.media_id
            WHERE segment_fts MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
            """,
            (q, limit, offset),
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


@app.post("/models/{model_name}/download")
def download_model_endpoint(model_name: str, device: str = "cpu") -> dict:
    """
    Download a Whisper model
    
    This is a blocking endpoint - it will wait until download completes.
    For production, consider implementing async/background download with progress tracking.
    """
    if is_model_downloaded(model_name):
        return {
            "ok": True,
            "message": f"Model '{model_name}' is already downloaded",
            "downloaded": True
        }
    
    success = download_model(model_name, device)
    
    if success:
        return {
            "ok": True,
            "message": f"Model '{model_name}' downloaded successfully",
            "downloaded": True
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download model '{model_name}'"
        )


# ==================== RAG & Agent Endpoints ====================

@app.post("/rag/index")
def index_transcript_to_vector(transcript_id: int, embedding_provider: str = "local") -> dict:
    """为指定转录文本建立向量索引"""
    if not RAG_ENABLED:
        raise HTTPException(status_code=501, detail="RAG module not installed")
    
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
    if not RAG_ENABLED:
        raise HTTPException(status_code=501, detail="RAG module not installed")
    
    result = sync_all_transcripts_to_vector(DEFAULT_DB_PATH, embedding_provider)
    return {"ok": True, **result}


@app.post("/search/semantic")
def semantic_search(payload: SemanticSearchRequest) -> dict:
    """语义搜索（支持混合检索）"""
    if not RAG_ENABLED:
        raise HTTPException(status_code=501, detail="RAG module not installed")
    
    retriever = get_retriever(DEFAULT_DB_PATH)
    results = retriever.search(payload.query, mode=payload.mode, limit=payload.limit)
    
    return {"ok": True, "data": results, "total": len(results), "mode": payload.mode}


@app.post("/agent/query")
def agent_query(payload: AgentQueryRequest) -> dict:
    """Agent 智能查询"""
    if not RAG_ENABLED:
        raise HTTPException(status_code=501, detail="RAG module not installed")
    
    if payload.agent_type == "search":
        agent = get_search_agent()
        response = agent.run(payload.query)
        return {"ok": True, "response": response, "agent": "search"}
    
    elif payload.agent_type == "clip_extractor":
        # 先搜索相关片段
        retriever = get_retriever(DEFAULT_DB_PATH)
        search_results = retriever.search(payload.query, mode="hybrid", limit=10)
        
        # 调用剪辑建议 Agent
        agent = ClipExtractorAgent()
        suggestions = agent.suggest_clips(search_results, payload.query)
        
        return {
            "ok": True,
            "response": suggestions,
            "agent": "clip_extractor",
            "related_clips": search_results,
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown agent type: {payload.agent_type}")


@app.get("/rag/status")
def rag_status() -> dict:
    """RAG 模块状态"""
    return {
        "ok": True,
        "enabled": RAG_ENABLED,
        "features": {
            "semantic_search": RAG_ENABLED,
            "agent_query": RAG_ENABLED,
            "hybrid_retrieval": RAG_ENABLED,
        } if RAG_ENABLED else {}
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8787, reload=True)
