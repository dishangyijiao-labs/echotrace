"""Tests for the numbered SQL migration runner."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from db.init_db import (
    MIGRATIONS_DIR,
    _applied_versions,
    _create_version_table,
    _discover_migrations,
    init_db,
)


class TestDiscoverMigrations:
    def test_discovers_numbered_files(self):
        migrations = _discover_migrations(MIGRATIONS_DIR)
        assert len(migrations) >= 1
        versions = [v for v, _ in migrations]
        assert versions == sorted(versions), "Migrations must be sorted by version number"

    def test_skips_non_numeric_prefix(self, tmp_path):
        (tmp_path / "bad_name.sql").write_text("SELECT 1;")
        migrations = _discover_migrations(tmp_path)
        assert migrations == []


class TestVersionTable:
    def test_creates_schema_version_table(self, tmp_path):
        db = tmp_path / "test.db"
        conn = sqlite3.connect(db)
        _create_version_table(conn)
        tables = [
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        ]
        assert "schema_version" in tables

    def test_applied_versions_empty_initially(self, tmp_path):
        db = tmp_path / "test.db"
        conn = sqlite3.connect(db)
        _create_version_table(conn)
        assert _applied_versions(conn) == set()


class TestInitDb:
    def test_creates_all_tables(self, tmp_path):
        db = tmp_path / "app.db"
        init_db(db)
        conn = sqlite3.connect(db)
        tables = {
            row[0]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        for expected in ("media", "transcript", "segment", "job", "schema_version"):
            assert expected in tables, f"Missing table: {expected}"

    def test_idempotent(self, tmp_path):
        db = tmp_path / "app.db"
        init_db(db)
        init_db(db)  # second call should not raise

    def test_migration_versions_recorded(self, tmp_path):
        db = tmp_path / "app.db"
        init_db(db)
        conn = sqlite3.connect(db)
        applied = _applied_versions(conn)
        # At minimum migrations 001, 002, 003 should be applied
        assert {1, 2, 3}.issubset(applied)
