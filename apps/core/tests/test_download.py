"""Tests for async download manager."""
from __future__ import annotations

import asyncio
import threading

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

        # Use a threading.Event so the download blocks until we release it,
        # guaranteeing the task is still running when cancel() is called.
        release = threading.Event()

        def _slow_sync(model, device, cb):
            release.wait(timeout=5.0)
            return True

        task = await dm.start_download("small", "cpu", _slow_sync)
        await asyncio.sleep(0.05)  # let the executor thread start

        assert dm.is_running("small"), "task should still be running"
        result = await dm.cancel("small")
        release.set()  # unblock the download thread so it can finish

        assert result is True
        assert task.status == DownloadStatus.CANCELLED

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
