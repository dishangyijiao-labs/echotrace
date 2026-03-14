"""Async model download manager with SSE progress fan-out."""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator, Callable

_log = logging.getLogger("echotrace.download")


class DownloadStatus(str, Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    VERIFYING = "verifying"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class DownloadTask:
    model_name: str
    device: str
    status: DownloadStatus = DownloadStatus.QUEUED
    progress: float = 0.0          # 0.0 – 1.0
    message: str = ""
    error: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    # Subscribers waiting for SSE events
    _subscribers: list[asyncio.Queue] = field(default_factory=list, repr=False)

    def _publish(self, event: dict) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def _update(
        self,
        status: DownloadStatus,
        progress: float = 0.0,
        message: str = "",
        error: str | None = None,
    ) -> None:
        self.status = status
        self.progress = progress
        self.message = message
        self.error = error
        if status in (DownloadStatus.DONE, DownloadStatus.FAILED, DownloadStatus.CANCELLED):
            self.finished_at = time.time()
        self._publish(self.as_event())

    def as_event(self) -> dict:
        return {
            "model": self.model_name,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
        }


class DownloadManager:
    """Singleton that manages async Whisper model downloads."""

    def __init__(self) -> None:
        self._tasks: dict[str, DownloadTask] = {}
        self._lock = asyncio.Lock()

    def get_task(self, model_name: str) -> DownloadTask | None:
        return self._tasks.get(model_name)

    def is_running(self, model_name: str) -> bool:
        task = self._tasks.get(model_name)
        return task is not None and task.status in (
            DownloadStatus.QUEUED,
            DownloadStatus.DOWNLOADING,
            DownloadStatus.VERIFYING,
        )

    async def start_download(
        self,
        model_name: str,
        device: str,
        download_fn: Callable[[str, str, Callable[[str, float], None]], bool],
    ) -> DownloadTask:
        """Enqueue a download and run it in the background."""
        async with self._lock:
            if self.is_running(model_name):
                return self._tasks[model_name]
            task = DownloadTask(model_name=model_name, device=device)
            self._tasks[model_name] = task

        asyncio.create_task(self._run(task, download_fn))
        return task

    async def _run(
        self,
        task: DownloadTask,
        download_fn: Callable[[str, str, Callable[[str, float], None]], bool],
    ) -> None:
        _log.info("Download started: %s (device=%s)", task.model_name, task.device)
        task._update(DownloadStatus.DOWNLOADING, 0.0, "Starting download…")

        def _progress(message: str, progress: float = 0.0) -> None:
            task._update(DownloadStatus.DOWNLOADING, progress, message)

        loop = asyncio.get_event_loop()
        try:
            # Run blocking download_fn in a thread pool
            success = await loop.run_in_executor(
                None, download_fn, task.model_name, task.device, _progress
            )
        except Exception as exc:
            _log.exception("Download failed for %s: %s", task.model_name, exc)
            task._update(DownloadStatus.FAILED, 0.0, "Download failed", str(exc))
            return

        # Respect a cancellation that arrived while the thread was still running
        if task.status == DownloadStatus.CANCELLED:
            _log.info("Download cancelled (thread finished): %s", task.model_name)
            return

        if success:
            task._update(DownloadStatus.VERIFYING, 0.95, "Verifying…")
            await asyncio.sleep(0.2)  # brief pause for UX
            task._update(DownloadStatus.DONE, 1.0, f"Model '{task.model_name}' ready")
            _log.info("Download complete: %s", task.model_name)
        else:
            task._update(DownloadStatus.FAILED, 0.0, "Download returned failure")

    async def cancel(self, model_name: str) -> bool:
        task = self._tasks.get(model_name)
        if not task or not self.is_running(model_name):
            return False
        task._update(DownloadStatus.CANCELLED, task.progress, "Cancelled by user")
        return True

    async def event_stream(self, model_name: str) -> AsyncIterator[str]:
        """Yield SSE-formatted strings for a given model download."""
        task = self._tasks.get(model_name)
        if not task:
            yield _sse({"error": "no active download", "model": model_name})
            return

        # Send current state immediately
        yield _sse(task.as_event())

        if task.status in (DownloadStatus.DONE, DownloadStatus.FAILED, DownloadStatus.CANCELLED):
            return

        q = task.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield _sse({"heartbeat": True})
                    continue
                yield _sse(event)
                status = event.get("status")
                if status in (DownloadStatus.DONE, DownloadStatus.FAILED, DownloadStatus.CANCELLED):
                    break
        finally:
            task.unsubscribe(q)

    def recover_incomplete(self) -> None:
        """Called at startup: mark any download that was interrupted as failed."""
        for task in self._tasks.values():
            if task.status in (DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING, DownloadStatus.VERIFYING):
                task._update(DownloadStatus.FAILED, task.progress, "Interrupted by server restart")


def _sse(data: dict) -> str:
    import json
    return f"data: {json.dumps(data)}\n\n"


# Module-level singleton
download_manager = DownloadManager()
