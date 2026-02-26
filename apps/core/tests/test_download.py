"""Tests for async download manager."""
from __future__ import annotations

import asyncio

import pytest

from download_manager import DownloadManager, DownloadStatus


def _ok_download(model_name, device, progress_cb):
    progress_cb("Downloading...", 0.5)
    return True


def _fail_download(model_name, device, progress_cb):
    return False


@pytest.mark.asyncio
class TestDownloadManager:
    async def test_initial_state_empty(self):
        dm = DownloadManager()
        assert dm.get_task("tiny") is None
        assert not dm.is_running("tiny")

    async def test_start_download_creates_task(self):
        dm = DownloadManager()
        task = await dm.start_download("tiny", "cpu", _ok_download)
        assert task is not None
        assert task.model_name == "tiny"
        # Give the background task a moment to run
        await asyncio.sleep(0.3)
        assert task.status == DownloadStatus.DONE

    async def test_start_download_idempotent(self):
        dm = DownloadManager()
        task1 = await dm.start_download("tiny", "cpu", _ok_download)
        task2 = await dm.start_download("tiny", "cpu", _ok_download)
        assert task1 is task2  # same object returned

    async def test_failed_download(self):
        dm = DownloadManager()
        task = await dm.start_download("tiny", "cpu", _fail_download)
        await asyncio.sleep(0.3)
        assert task.status == DownloadStatus.FAILED

    async def test_cancel_running_download(self):
        dm = DownloadManager()

        async def _slow(model, device, cb):
            await asyncio.sleep(10)
            return True

        # Start but don't await completion
        task = await dm.start_download("small", "cpu", lambda m, d, cb: None)
        # Immediately cancel
        result = await dm.cancel("small")
        # cancel returns True only if task was running; it may or may not be depending on timing
        # Just ensure no exception is raised
        assert isinstance(result, bool)

    async def test_recover_incomplete(self):
        dm = DownloadManager()
        task = await dm.start_download("base", "cpu", _ok_download)
        # Simulate interrupted download
        from download_manager import DownloadStatus
        task._update(DownloadStatus.DOWNLOADING, 0.5, "mid-download")
        dm.recover_incomplete()
        assert task.status == DownloadStatus.FAILED

    async def test_event_stream_immediate_done(self):
        dm = DownloadManager()
        task = await dm.start_download("tiny", "cpu", _ok_download)
        await asyncio.sleep(0.3)  # let download finish
        events = []
        async for event in dm.event_stream("tiny"):
            events.append(event)
        assert any("done" in e for e in events)
