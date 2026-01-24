from __future__ import annotations

import argparse
import datetime as dt
import sqlite3
import threading
import time
from pathlib import Path

from pipeline.media import extract_audio
from pipeline.whisper import load_model

APP_ROOT = Path(__file__).resolve().parent
DEFAULT_DB_PATH = APP_ROOT / "data" / "app.db"
STAGING_DIR = APP_ROOT / "data" / "staging"


def _now() -> str:
    return dt.datetime.now(dt.UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _load_next_job(conn: sqlite3.Connection):
    return conn.execute(
        """
        SELECT id, media_id, engine, model, device
        FROM job
        WHERE status = 'queued'
        ORDER BY id ASC
        LIMIT 1
        """
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


def _start_job_heartbeat(db_path: Path, job_id: int, interval: float = 10.0) -> threading.Event:
    stop_event = threading.Event()

    def _beat() -> None:
        while not stop_event.wait(interval):
            try:
                with _connect(db_path) as conn:
                    conn.execute(
                        "UPDATE job SET updated_at = ? WHERE id = ?",
                        (_now(), job_id),
                    )
                    conn.commit()
            except Exception:  # noqa: BLE001
                pass

    thread = threading.Thread(target=_beat, daemon=True)
    thread.start()
    return stop_event


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


def process_job(conn: sqlite3.Connection, job) -> None:
    job_id = job["id"]
    _set_job_status(conn, job_id, "running")
    _set_job_progress(conn, job_id, 0, 0, 0.01)
    conn.commit()

    heartbeat = _start_job_heartbeat(DEFAULT_DB_PATH, job_id)

    media = conn.execute(
        "SELECT id, path, filename FROM media WHERE id = ?",
        (job["media_id"],),
    ).fetchone()
    if not media:
        _set_job_status(conn, job_id, "error", "media not found")
        conn.commit()
        heartbeat.set()
        return

    source_path = Path(media["path"])
    if not source_path.exists():
        _set_job_status(conn, job_id, "error", "media file missing")
        conn.commit()
        heartbeat.set()
        return

    audio_path = STAGING_DIR / f"media_{media['id']}.wav"
    try:
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
        for segment in segments_stream:
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

        content = "\n".join(segment["text"] for segment in segments).strip()
        transcript_id = _insert_transcript(conn, media["id"], content, info.language)
        if segments:
            _insert_segments(conn, transcript_id, segments)
        _update_media_duration(conn, media["id"], info.duration)
        _set_job_progress(conn, job_id, processed, len(segments), 1.0)
        _set_job_status(conn, job_id, "done")
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        _set_job_status(conn, job_id, "error", str(exc))
        conn.commit()
    finally:
        heartbeat.set()


def _reset_stale_jobs(conn: sqlite3.Connection) -> int:
    """Reset running jobs to queued state (assumes previous worker crashed)."""
    cursor = conn.execute(
        """
        UPDATE job 
        SET status = 'queued', updated_at = ? 
        WHERE status = 'running'
        """,
        (_now(),),
    )
    count = cursor.rowcount
    conn.commit()
    return count


def run_worker(db_path: Path, poll_interval: float, once: bool) -> None:
    with _connect(db_path) as conn:
        # Reset any stale 'running' jobs from crashed workers
        reset_count = _reset_stale_jobs(conn)
        if reset_count > 0:
            print(f"Reset {reset_count} stale job(s) from 'running' to 'queued'")
        
        while True:
            job = _load_next_job(conn)
            if not job:
                if once:
                    break
                time.sleep(poll_interval)
                continue
            process_job(conn, job)
            if once:
                break


def main() -> None:
    parser = argparse.ArgumentParser(description="EchoTrace transcription worker")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--poll", type=float, default=2.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    run_worker(args.db, args.poll, args.once)


if __name__ == "__main__":
    main()
