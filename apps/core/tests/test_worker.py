"""Tests for worker reliability: heartbeat, job claim, stale-job reset."""
from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from tests.conftest import _insert_media


def _get_conn(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


class TestHeartbeatHandle:
    def test_stop_sets_event(self):
        from worker import _start_job_heartbeat

        # We need a real DB for heartbeat; use an in-memory one
        import tempfile, os
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            from db.init_db import init_db
            init_db(db_path, None)
            conn = _get_conn(db_path)
            media_id = _insert_media(conn)
            cursor = conn.execute(
                "INSERT INTO job (media_id, status, engine, model, device, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (media_id, "running", "whisper", "tiny", "cpu", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
            )
            job_id = cursor.lastrowid
            conn.commit()

            handle = _start_job_heartbeat(db_path, job_id, interval=0.05)
            assert handle.is_alive()
            handle.stop()
            handle.thread.join(timeout=2.0)
            assert not handle.is_alive()

    def test_is_failed_initially_false(self):
        from worker import HeartbeatHandle
        import threading
        h = HeartbeatHandle(
            stop_event=threading.Event(),
            failed_event=threading.Event(),
            thread=threading.Thread(target=lambda: None),
        )
        assert not h.is_failed()


class TestClaimNextJob:
    def test_claim_returns_none_when_empty(self, tmp_db):
        from worker import _claim_next_job
        conn = _get_conn(tmp_db)
        assert _claim_next_job(conn, "w1") is None

    def test_claim_sets_status_to_running(self, tmp_db):
        from worker import _claim_next_job
        conn = _get_conn(tmp_db)
        media_id = _insert_media(conn)
        conn.execute(
            "INSERT INTO job (media_id, status, engine, model, device, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (media_id, "queued", "whisper", "tiny", "cpu", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
        )
        conn.commit()
        job = _claim_next_job(conn, "worker-1")
        assert job is not None
        row = conn.execute("SELECT status, worker_id FROM job WHERE id = ?", (job["id"],)).fetchone()
        assert row["status"] == "running"
        assert row["worker_id"] == "worker-1"

    def test_claim_prevents_double_claim(self, tmp_db):
        """Two workers should not both claim the same job."""
        from worker import _claim_next_job
        conn1 = _get_conn(tmp_db)
        conn2 = _get_conn(tmp_db)
        media_id = _insert_media(conn1)
        conn1.execute(
            "INSERT INTO job (media_id, status, engine, model, device, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (media_id, "queued", "whisper", "tiny", "cpu", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
        )
        conn1.commit()
        j1 = _claim_next_job(conn1, "w1")
        j2 = _claim_next_job(conn2, "w2")
        # Only one of them should have succeeded
        claimed = [j for j in (j1, j2) if j is not None]
        assert len(claimed) == 1


class TestResetStaleJobs:
    def test_resets_jobs_past_threshold(self, tmp_db):
        from worker import _reset_stale_jobs
        conn = _get_conn(tmp_db)
        media_id = _insert_media(conn)
        # Insert a job with an old updated_at (3 minutes ago)
        old_ts = "2020-01-01T00:00:00Z"
        conn.execute(
            "INSERT INTO job (media_id, status, engine, model, device, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (media_id, "running", "whisper", "tiny", "cpu", old_ts, old_ts),
        )
        conn.commit()
        count = _reset_stale_jobs(conn, stale_threshold_seconds=60)
        assert count == 1
        row = conn.execute("SELECT status FROM job").fetchone()
        assert row["status"] == "queued"

    def test_does_not_reset_recent_jobs(self, tmp_db):
        from worker import _reset_stale_jobs
        import datetime as dt
        conn = _get_conn(tmp_db)
        media_id = _insert_media(conn)
        # Use current timestamp — should NOT be reset
        now = dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S") + "Z"
        conn.execute(
            "INSERT INTO job (media_id, status, engine, model, device, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (media_id, "running", "whisper", "tiny", "cpu", now, now),
        )
        conn.commit()
        count = _reset_stale_jobs(conn, stale_threshold_seconds=120)
        assert count == 0
