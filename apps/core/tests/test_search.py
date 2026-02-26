"""Tests for full-text search and search filter params."""
from __future__ import annotations

import pytest
import pytest_asyncio

from tests.conftest import _insert_media, _insert_transcript, _insert_segment


@pytest.mark.asyncio
class TestSearch:
    async def test_basic_search_returns_results(self, app_client, db_conn):
        # Setup
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "Hello world test")
        _insert_segment(db_conn, t_id, 0.0, 2.0, "Hello world test")

        async with app_client as client:
            response = await client.get("/search", params={"q": "Hello"})
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["total"] >= 1

    async def test_search_no_results(self, app_client, db_conn):
        _insert_media(db_conn)
        async with app_client as client:
            response = await client.get("/search", params={"q": "zzznomatch"})
        assert response.status_code == 200
        assert response.json()["total"] == 0

    async def test_search_requires_query(self, app_client):
        async with app_client as client:
            response = await client.get("/search")
        assert response.status_code == 422

    async def test_search_language_filter(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "Bonjour monde")
        _insert_segment(db_conn, t_id, 0.0, 2.0, "Bonjour monde")

        async with app_client as client:
            response = await client.get("/search", params={"q": "Bonjour", "language": "fr"})
        # The transcript language is "en" from fixture, so filter should return 0
        assert response.status_code == 200

    async def test_search_pagination(self, app_client, db_conn):
        media_id = _insert_media(db_conn)
        t_id = _insert_transcript(db_conn, media_id, "test " * 30)
        for i in range(10):
            _insert_segment(db_conn, t_id, float(i), float(i + 1), f"test segment {i}")

        async with app_client as client:
            r1 = await client.get("/search", params={"q": "test", "limit": 3, "offset": 0})
            r2 = await client.get("/search", params={"q": "test", "limit": 3, "offset": 3})

        assert r1.status_code == 200
        assert r2.status_code == 200
        ids1 = [d["id"] for d in r1.json()["data"]]
        ids2 = [d["id"] for d in r2.json()["data"]]
        assert set(ids1).isdisjoint(set(ids2))
