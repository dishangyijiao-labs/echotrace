from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from faster_whisper import WhisperModel

from .config import WhisperConfig


def load_model(cfg: WhisperConfig) -> WhisperModel:
    # Use explicitly configured device, or auto-detect based on compute_type
    if cfg.device:
        device = cfg.device
    else:
        device = "cuda" if cfg.compute_type in {"float16", "int8_float16"} else "cpu"
    
    return WhisperModel(
        cfg.model_size,
        device=device,
        compute_type=cfg.compute_type,
    )


def transcribe_file(model: WhisperModel, wav_path: Path, cfg: WhisperConfig) -> Dict[str, Any]:
    segments, info = model.transcribe(
        str(wav_path),
        language=cfg.language,
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
