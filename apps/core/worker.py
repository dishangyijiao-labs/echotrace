from __future__ import annotations

import argparse
import datetime as dt
import logging
import logging.handlers
import os
import sqlite3
import sys
import threading
import time
import uuid as _uuid
from dataclasses import dataclass
from pathlib import Path

# Sanitize NO_PROXY: httpx cannot parse IPv6 CIDR entries (e.g. fd7a:115c:a1e0::/48)
for _key in ("NO_PROXY", "no_proxy"):
    _val = os.environ.get(_key, "")
    if _val:
        _cleaned = ",".join(e.strip() for e in _val.split(",") if e.strip().count(":") < 2)
        os.environ[_key] = _cleaned

import opencc

from pipeline.media import extract_audio
from pipeline.whisper import load_model
from db.init_db import init_db

_t2s = opencc.OpenCC("t2s")

APP_ROOT = Path(__file__).resolve().parent
_data_dir = os.environ.get("ECHOTRACE_DATA_DIR")
DEFAULT_DB_PATH = Path(_data_dir) / "app.db" if _data_dir else APP_ROOT / "data" / "app.db"
SCHEMA_PATH = APP_ROOT / "db" / "schema.sql"
STAGING_DIR = Path(_data_dir) / "staging" if _data_dir else APP_ROOT / "data" / "staging"

LOG_FORMAT = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S"
MAX_HEARTBEAT_FAILURES = 3

_worker_log = logging.getLogger("echotrace.worker")
_tx_log = logging.getLogger("echotrace.transcription")
_hb_log = logging.getLogger("echotrace.heartbeat")


def _configure_logging(log_dir: Path | None = None) -> None:
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_dir / "worker.log",
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        handlers.append(file_handler)
    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
        datefmt=LOG_DATE_FORMAT,
        handlers=handlers,
    )


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@dataclass
class HeartbeatHandle:
    stop_event: threading.Event
    failed_event: threading.Event
    thread: threading.Thread

    def stop(self) -> None:
        self.stop_event.set()

    def is_failed(self) -> bool:
        return self.failed_event.is_set()

    def is_alive(self) -> bool:
        return self.thread.is_alive()


def _claim_next_job(conn: sqlite3.Connection, worker_id: str):
    """Atomically claim the next queued job using UPDATE with rowcount check."""
    conn.execute("PRAGMA busy_timeout = 5000")
    row = conn.execute(
        "SELECT id FROM job WHERE status = 'queued' ORDER BY id ASC LIMIT 1"
    ).fetchone()
    if not row:
        return None
    cursor = conn.execute(
        "UPDATE job SET status = 'running', updated_at = ?, worker_id = ? WHERE id = ? AND status = 'queued'",
        (_now(), worker_id, row["id"]),
    )
    conn.commit()
    if cursor.rowcount == 0:
        # Lost the race to another worker
        return None
    return conn.execute(
        "SELECT id, media_id, engine, model, device FROM job WHERE id = ?",
        (row["id"],),
    ).fetchone()


def _set_job_status(conn: sqlite3.Connection, job_id: int, status: str, error: str | None = None) -> None:
    conn.execute(
        "UPDATE job SET status = ?, error = ?, updated_at = ? WHERE id = ?",
        (status, error, _now(), job_id),
    )


def _set_job_progress(
    conn: sqlite3.Connection,
    job_id: int,
    processed: int,
    total: int,
    progress: float,
) -> None:
    conn.execute(
        """
        UPDATE job
        SET processed_segments = ?, total_segments = ?, progress = ?, updated_at = ?
        WHERE id = ?
        """,
        (processed, total, progress, _now(), job_id),
    )


def _start_job_heartbeat(db_path: Path, job_id: int, interval: float = 10.0) -> HeartbeatHandle:
    stop_event = threading.Event()
    failed_event = threading.Event()

    def _beat() -> None:
        consecutive_failures = 0
        while not stop_event.wait(interval):
            try:
                with _connect(db_path) as conn:
                    conn.execute(
                        "UPDATE job SET updated_at = ? WHERE id = ?",
                        (_now(), job_id),
                    )
                    conn.commit()
                consecutive_failures = 0
                _hb_log.debug("Heartbeat OK for job %d", job_id)
            except Exception as exc:  # noqa: BLE001
                consecutive_failures += 1
                _hb_log.warning(
                    "Heartbeat failure %d/%d for job %d: %s",
                    consecutive_failures,
                    MAX_HEARTBEAT_FAILURES,
                    job_id,
                    exc,
                )
                if consecutive_failures >= MAX_HEARTBEAT_FAILURES:
                    _hb_log.error(
                        "Heartbeat exceeded max failures for job %d — marking failed", job_id
                    )
                    failed_event.set()
                    return

    thread = threading.Thread(target=_beat, daemon=True)
    thread.start()
    return HeartbeatHandle(stop_event=stop_event, failed_event=failed_event, thread=thread)


def _insert_transcript(conn: sqlite3.Connection, media_id: int, content: str, language: str | None) -> int:
    now = _now()
    summary = content[:200] if content else ""
    cursor = conn.execute(
        """
        INSERT INTO transcript (media_id, content, language, summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (media_id, content, language, summary, now, now),
    )
    return cursor.lastrowid


def _insert_segments(conn: sqlite3.Connection, transcript_id: int, segments: list[dict]) -> None:
    rows = [
        (transcript_id, segment["start"], segment["end"], segment["text"])
        for segment in segments
    ]
    conn.executemany(
        """
        INSERT INTO segment (transcript_id, start, end, text)
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )


def _update_media_duration(conn: sqlite3.Connection, media_id: int, duration: float | None) -> None:
    conn.execute(
        "UPDATE media SET duration = ? WHERE id = ?",
        (duration, media_id),
    )


def process_job(conn: sqlite3.Connection, job, worker_id: str, db_path: Path = DEFAULT_DB_PATH) -> None:
    job_id = job["id"]
    _tx_log.info("Starting job %d (worker=%s)", job_id, worker_id)
    _set_job_status(conn, job_id, "running")
    _set_job_progress(conn, job_id, 0, 0, 0.01)
    conn.commit()

    heartbeat = _start_job_heartbeat(db_path, job_id)

    media = conn.execute(
        "SELECT id, path, filename FROM media WHERE id = ?",
        (job["media_id"],),
    ).fetchone()
    if not media:
        _tx_log.error("Job %d: media %d not found", job_id, job["media_id"])
        _set_job_status(conn, job_id, "error", "media not found")
        conn.commit()
        heartbeat.stop()
        return

    source_path = Path(media["path"])
    if not source_path.exists():
        _tx_log.error("Job %d: media file missing at %s", job_id, source_path)
        _set_job_status(conn, job_id, "error", "media file missing")
        conn.commit()
        heartbeat.stop()
        return

    audio_path = STAGING_DIR / f"media_{media['id']}.wav"
    try:
        if audio_path.exists() and audio_path.stat().st_size > 0:
            _tx_log.info("Job %d: reusing cached audio %s", job_id, audio_path)
            extracted = audio_path
        else:
            extracted = extract_audio(source_path, audio_path)
        _set_job_progress(conn, job_id, 0, 0, 0.05)
        conn.commit()
        model = load_model(job["model"], job["device"])
        _set_job_progress(conn, job_id, 0, 0, 0.1)
        conn.commit()
        segments_stream, info = model.transcribe(
            str(extracted),
            language=None,
            vad_filter=True,
            beam_size=5,
        )
        segments = []
        processed = 0
        total_duration = info.duration or 0.0
        last_update = time.monotonic()
        cancelled = False
        for segment in segments_stream:
            # Check heartbeat health every 5 segments
            if processed % 5 == 0 and heartbeat.is_failed():
                raise RuntimeError("Heartbeat failed — DB connection may be lost")
            # Check if job was cancelled via API
            if processed % 5 == 0:
                row = conn.execute("SELECT status FROM job WHERE id = ?", (job_id,)).fetchone()
                if row and row["status"] == "cancelled":
                    _tx_log.info("Job %d cancelled by user", job_id)
                    cancelled = True
                    break
            segments.append(
                {
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": segment.text.strip(),
                }
            )
            processed += 1
            if total_duration > 0:
                progress = min(segment.end / total_duration, 1.0)
            else:
                progress = 0.1
            now = time.monotonic()
            if processed % 5 == 0 or now - last_update >= 1.5:
                _set_job_progress(conn, job_id, processed, 0, progress)
                conn.commit()
                last_update = now
                _tx_log.debug("Job %d: processed %d segments (%.0f%%)", job_id, processed, progress * 100)
        if cancelled:
            _set_job_status(conn, job_id, "cancelled")
            conn.commit()
            heartbeat.stop()
            return

        # Convert Traditional Chinese to Simplified for zh results
        if info.language == "zh":
            for seg in segments:
                seg["text"] = _t2s.convert(seg["text"])

        content = "\n".join(segment["text"] for segment in segments).strip()
        transcript_id = _insert_transcript(conn, media["id"], content, info.language)
        if segments:
            _insert_segments(conn, transcript_id, segments)
        _update_media_duration(conn, media["id"], info.duration)
        _set_job_progress(conn, job_id, processed, len(segments), 1.0)
        _set_job_status(conn, job_id, "done")
        conn.commit()
        _tx_log.info("Job %d completed: %d segments, language=%s", job_id, len(segments), info.language)
    except Exception as exc:  # noqa: BLE001
        _tx_log.exception("Job %d failed: %s", job_id, exc)
        _set_job_status(conn, job_id, "error", str(exc))
        conn.commit()
    finally:
        heartbeat.stop()


def _reset_stale_jobs(conn: sqlite3.Connection, stale_threshold_seconds: int = 120) -> int:
    """Reset jobs stuck in 'running' state beyond the stale threshold."""
    cutoff = (
        dt.datetime.now(dt.UTC) - dt.timedelta(seconds=stale_threshold_seconds)
    ).strftime("%Y-%m-%dT%H:%M:%S") + "Z"
    cursor = conn.execute(
        """
        UPDATE job
        SET status = 'queued', worker_id = NULL, updated_at = ?
        WHERE status = 'running' AND updated_at < ?
        """,
        (_now(), cutoff),
    )
    count = cursor.rowcount
    conn.commit()
    if count > 0:
        _worker_log.info("Reset %d stale job(s) to 'queued'", count)
    return count


def run_worker(db_path: Path, poll_interval: float, once: bool) -> None:
    # Initialize database
    init_db(db_path, SCHEMA_PATH)
    worker_id = str(_uuid.uuid4())[:8]
    _worker_log.info("Worker starting (id=%s)", worker_id)


    with _connect(db_path) as conn:
        reset_count = _reset_stale_jobs(conn)
        if reset_count > 0:
            _worker_log.info("Reset %d stale job(s) from 'running' to 'queued'", reset_count)

        while True:
            job = _claim_next_job(conn, worker_id)
            if not job:
                if once:
                    break
                time.sleep(poll_interval)
                continue
            process_job(conn, job, worker_id, db_path)
            if once:
                break

    _worker_log.info("Worker %s exiting", worker_id)


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description="EchoTrace transcription worker")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--poll", type=float, default=2.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    _configure_logging(APP_ROOT / "data" / "logs")
    run_worker(args.db, args.poll, args.once)


if __name__ == "__main__":
    main()
