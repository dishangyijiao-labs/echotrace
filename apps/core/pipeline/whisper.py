from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from faster_whisper import WhisperModel


def load_model(model_size: str, device: str) -> WhisperModel:
    compute_type = "float16" if device == "cuda" else "int8"
    return WhisperModel(model_size, device=device, compute_type=compute_type)


def transcribe_file(model: WhisperModel, wav_path: Path, language: str | None) -> Dict[str, Any]:
    segments, info = model.transcribe(
        str(wav_path),
        language=language,
        vad_filter=True,
        beam_size=5,
    )
    payload = {
        "path": str(wav_path),
        "duration": info.duration,
        "language": info.language,
        "segments": [],
    }
    for segment in segments:
        payload["segments"].append(
            {
                "start": float(segment.start),
                "end": float(segment.end),
                "text": segment.text.strip(),
            }
        )
    return payload
