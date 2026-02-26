"""Mock Whisper model for tests — no model weights required."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator


@dataclass
class MockSegment:
    start: float
    end: float
    text: str


@dataclass
class MockTranscriptionInfo:
    language: str = "en"
    duration: float = 10.0


class MockWhisperModel:
    """Drop-in replacement for faster_whisper.WhisperModel in tests."""

    def __init__(self, model_size: str = "tiny", device: str = "cpu", compute_type: str = "int8"):
        self.model_size = model_size
        self.device = device

    def transcribe(
        self,
        audio_path: str,
        language=None,
        vad_filter: bool = False,
        beam_size: int = 5,
    ) -> tuple[Iterator[MockSegment], MockTranscriptionInfo]:
        segments = [
            MockSegment(0.0, 2.5, "Hello world"),
            MockSegment(2.5, 5.0, "This is a test"),
            MockSegment(5.0, 8.0, "Whisper mock output"),
        ]
        return iter(segments), MockTranscriptionInfo()
