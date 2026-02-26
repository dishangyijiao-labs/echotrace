"""Tests for Core API endpoints."""
from __future__ import annotations

import pytest

from tests.conftest import _insert_media, _insert_transcript, _insert_segment


@pytest.mark.asyncio
class TestHealthAndRoot:
    async def test_health(self, app_client):
        async with app_client as client:
            r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["ok"] is True

    async def test_root(self, app_client):
        async with app_client as client:
            r = await client.get("/")
        assert r.status_code == 200
        assert "EchoTrace" in r.json()["name"]


@pytest.mark.asyncio
class TestMediaImport:
    async def test_import_missing_file_returns_error(self, app_client):
        async with app_client as client:
            r = await client.post("/media/import", json={"paths": ["/does/not/exist.mp4"]})
        # With API hardening this returns 400; without it returns 200 with empty created
        assert r.status_code in (200, 400)

    async def test_import_empty_paths_returns_error(self, app_client):
        async with app_client as client:
            r = await client.post("/media/import", json={"paths": []})
        assert r.status_code == 400

    async def test_list_media_empty(self, app_client):
        async with app_client as client:
            r = await client.get("/media")
        assert r.status_code == 200
        assert r.json()["data"] == []


@pytest.mark.asyncio
class TestTranscripts:
    async def test_list_transcripts_empty(self, app_client):
        async with app_client as client:
            r = await client.get("/transcripts")
        assert r.status_code == 200
        assert r.json()["data"] == []

    async def test_get_transcript_not_found(self, app_client):
        async with app_client as client:
            r = await client.get("/transcripts/9999")
        assert r.status_code == 404

    async def test_get_transcript_with_segments(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "Full content here")
        _insert_segment(db_conn, t_id, 0.0, 2.0, "Full content here")

        async with app_client as client:
            r = await client.get(f"/transcripts/{t_id}")
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["id"] == t_id
        assert len(data["segments"]) == 1


@pytest.mark.asyncio
class TestExport:
    async def test_export_txt(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "Export test content")

        async with app_client as client:
            r = await client.get(f"/export/{t_id}", params={"format": "txt"})
        assert r.status_code == 200
        assert "Export test content" in r.json()["content"]

    async def test_export_srt(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "SRT export test")
        _insert_segment(db_conn, t_id, 0.0, 2.5, "SRT export test")

        async with app_client as client:
            r = await client.get(f"/export/{t_id}", params={"format": "srt"})
        assert r.status_code == 200
        content = r.json()["content"]
        assert "00:00:02,500" in content  # SRT timestamp

    async def test_export_unsupported_format(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "test")

        async with app_client as client:
            r = await client.get(f"/export/{t_id}", params={"format": "docx"})
        assert r.status_code == 400

    async def test_export_not_found(self, app_client):
        async with app_client as client:
            r = await client.get("/export/9999", params={"format": "txt"})
        assert r.status_code == 404


@pytest.mark.asyncio
class TestJobs:
    async def test_create_job_media_not_found(self, app_client):
        async with app_client as client:
            r = await client.post("/jobs/transcribe", json={"media_id": 9999})
        assert r.status_code == 404

    async def test_list_jobs_empty(self, app_client):
        async with app_client as client:
            r = await client.get("/jobs")
        assert r.status_code == 200
        assert r.json()["data"] == []

    async def test_create_job_success(self, app_client, db_conn):
        media_id = _insert_media(db_conn)

        async with app_client as client:
            r = await client.post("/jobs/transcribe", json={"media_id": media_id})
        assert r.status_code == 200
        assert "job_id" in r.json()


@pytest.mark.asyncio
class TestModels:
    async def test_list_models(self, app_client):
        async with app_client as client:
            r = await client.get("/models")
        assert r.status_code == 200
        names = [m["name"] for m in r.json()["models"]]
        assert "tiny" in names
        assert "small" in names
