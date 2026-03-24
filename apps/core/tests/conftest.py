"""Shared test fixtures for EchoTrace Core."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch

import types

import pytest

# Add core to path so imports work
CORE_ROOT = Path(__file__).resolve().parent.parent
if str(CORE_ROOT) not in sys.path:
    sys.path.insert(0, str(CORE_ROOT))

# ---------------------------------------------------------------------------
# Stub out heavy optional dependencies so tests can import core modules
# without the real packages installed.
# ---------------------------------------------------------------------------
from tests.mocks.mock_whisper import MockWhisperModel  # noqa: E402

_faster_whisper_stub = types.ModuleType("faster_whisper")
_faster_whisper_stub.WhisperModel = MockWhisperModel
sys.modules.setdefault("faster_whisper", _faster_whisper_stub)

from tests.mocks.mock_chromadb import MockChromaClient  # noqa: E402

_chromadb_stub = types.ModuleType("chromadb")
_chromadb_stub.Client = MockChromaClient
sys.modules.setdefault("chromadb", _chromadb_stub)


@pytest.fixture()
def tmp_db(tmp_path) -> Path:
    """Return a path to a fresh in-memory-style SQLite DB in tmp_path."""
    db_path = tmp_path / "test.db"
    # Apply all migrations
    from db.init_db import init_db
    init_db(db_path, None)
    return db_path


@pytest.fixture()
def db_conn(tmp_db) -> sqlite3.Connection:
    """Return an open sqlite3 connection to the test DB."""
    conn = sqlite3.connect(tmp_db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    yield conn
    conn.close()


@pytest.fixture()
def app_client(tmp_db, monkeypatch):
    """Return an httpx AsyncClient backed by the FastAPI app with a test DB."""
    monkeypatch.setenv("ECHOTRACE_SEMANTIC_SEARCH", "false")

    import app as app_module
    # Point the app at the test database
    monkeypatch.setattr(app_module, "DEFAULT_DB_PATH", tmp_db)

    from httpx import AsyncClient, ASGITransport
    return AsyncClient(transport=ASGITransport(app=app_module.app), base_url="http://test")


def _insert_media(conn: sqlite3.Connection, path: str = "/fake/video.mp4", filename: str = "video.mp4") -> int:
    cursor = conn.execute(
        "INSERT INTO media (path, filename, file_type, duration, created_at) VALUES (?, ?, ?, ?, ?)",
        (path, filename, "video/mp4", 60.0, "2024-01-01T00:00:00Z"),
    )
    conn.commit()
    return cursor.lastrowid


def _insert_transcript(conn: sqlite3.Connection, media_id: int, content: str = "Hello world") -> int:
    cursor = conn.execute(
        "INSERT INTO transcript (media_id, content, language, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (media_id, content, "en", content[:50], "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
    )
    conn.commit()
    return cursor.lastrowid


def _insert_segment(conn: sqlite3.Connection, transcript_id: int, start: float, end: float, text: str) -> int:
    cursor = conn.execute(
        "INSERT INTO segment (transcript_id, start, end, text) VALUES (?, ?, ?, ?)",
        (transcript_id, start, end, text),
    )
    conn.commit()
    return cursor.lastrowid
