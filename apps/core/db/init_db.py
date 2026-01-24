from __future__ import annotations

import sqlite3
from pathlib import Path


def init_db(db_path: Path, schema_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        schema = schema_path.read_text(encoding="utf-8")
        conn.executescript(schema)
        _ensure_job_columns(conn)


def _ensure_job_columns(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("PRAGMA table_info(job)")
    existing = {row[1] for row in cursor.fetchall()}
    columns = {
        "progress": "REAL NOT NULL DEFAULT 0",
        "processed_segments": "INTEGER NOT NULL DEFAULT 0",
        "total_segments": "INTEGER NOT NULL DEFAULT 0",
    }
    for name, definition in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE job ADD COLUMN {name} {definition}")


if __name__ == "__main__":
    default_db = Path("data/app.db")
    schema_file = Path(__file__).with_name("schema.sql")
    init_db(default_db, schema_file)
    print(f"Initialized database at {default_db}")
