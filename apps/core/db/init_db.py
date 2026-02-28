"""Database initialisation and numbered SQL migration runner.

Migrations live in db/migrations/ as NNN_description.sql files (e.g. 001_initial_schema.sql).
Each migration is applied exactly once; the applied set is tracked in schema_version.
"""
from __future__ import annotations

import logging
import shutil
import sqlite3
from pathlib import Path

_log = logging.getLogger("echotrace.db")

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def _create_version_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_version (
            version  INTEGER PRIMARY KEY,
            filename TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )
        """
    )
    conn.commit()


def _applied_versions(conn: sqlite3.Connection) -> set[int]:
    return {
        row[0]
        for row in conn.execute("SELECT version FROM schema_version").fetchall()
    }


def _discover_migrations(migrations_dir: Path) -> list[tuple[int, Path]]:
    """Return (version, path) tuples sorted by version number."""
    migrations = []
    for path in migrations_dir.glob("*.sql"):
        stem = path.stem  # e.g. "001_initial_schema"
        try:
            version = int(stem.split("_")[0])
        except (ValueError, IndexError):
            _log.warning("Skipping migration with unparseable name: %s", path.name)
            continue
        migrations.append((version, path))
    return sorted(migrations, key=lambda t: t[0])


def _apply_migration(conn: sqlite3.Connection, version: int, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    try:
        # executescript commits any pending transaction before running
        conn.executescript(sql)
        conn.execute(
            "INSERT INTO schema_version (version, filename) VALUES (?, ?)",
            (version, path.name),
        )
        conn.commit()
        _log.info("Applied migration %03d: %s", version, path.name)
    except sqlite3.OperationalError as exc:
        # ALTER TABLE ADD COLUMN fails if column already exists — safe to skip
        if "duplicate column name" in str(exc).lower():
            _log.debug("Migration %03d skipped (column already exists): %s", version, exc)
            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version, filename) VALUES (?, ?)",
                (version, path.name),
            )
            conn.commit()
        else:
            raise


def _backup_db(db_path: Path) -> None:
    backup = db_path.with_suffix(".db.bak")
    shutil.copy2(db_path, backup)
    _log.info("Database backed up to %s", backup)


def init_db(db_path: Path, schema_path: Path | None = None) -> None:  # noqa: ARG001
    """Initialise (or migrate) the database at db_path.

    schema_path is accepted for backwards-compatibility but is no longer used;
    all schema is now managed via numbered migrations in db/migrations/.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")

        _create_version_table(conn)
        applied = _applied_versions(conn)
        pending = [
            (v, p)
            for v, p in _discover_migrations(MIGRATIONS_DIR)
            if v not in applied
        ]

        if not pending:
            _log.debug("Database is up to date (no pending migrations)")
            return

        # Back up before applying any migrations (only when DB already has data)
        if db_path.stat().st_size > 0 and applied:
            _backup_db(db_path)

        for version, path in pending:
            _apply_migration(conn, version, path)

    _log.info("Database ready at %s", db_path)


def _ensure_job_columns(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("PRAGMA table_info(job)")
    existing = {row[1] for row in cursor.fetchall()}
    columns = {
        "progress": "REAL NOT NULL DEFAULT 0",
        "processed_segments": "INTEGER NOT NULL DEFAULT 0",
        "total_segments": "INTEGER NOT NULL DEFAULT 0",
        "worker_id": "TEXT",
    }
    for name, definition in columns.items():
        if name not in existing:
            conn.execute(f"ALTER TABLE job ADD COLUMN {name} {definition}")


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/app.db")
    init_db(db, None)
    print(f"Database initialised at {db}")
