from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import yaml


@dataclass
class FFMpegConfig:
    chunk_seconds: int
    target_samplerate: int
    audio_codec: str


@dataclass
class WhisperConfig:
    model_size: str
    compute_type: str
    language: Optional[str]
    device: Optional[str]


@dataclass
class CleaningConfig:
    allowed_languages: List[str]
    min_chars: int
    max_chars: int
    strip_disfluencies: bool
    normalize_punctuation: bool
    drop_repeated_ratio: float


@dataclass
class ExportConfig:
    formats: List[str]
    report_samples: int


@dataclass
class PipelineConfig:
    input_dir: Path
    staging_dir: Path
    output_dir: Path
    manifest_db: Path
    ffmpeg: FFMpegConfig
    whisper: WhisperConfig
    cleaning: CleaningConfig
    export: ExportConfig


def load_config(path: Path | str) -> PipelineConfig:
    config_path = Path(path)
    data = yaml.safe_load(config_path.read_text())

    return PipelineConfig(
        input_dir=Path(data["input_dir"]),
        staging_dir=Path(data["staging_dir"]),
        output_dir=Path(data["output_dir"]),
        manifest_db=Path(data["manifest_db"]),
        ffmpeg=FFMpegConfig(**data["ffmpeg"]),
        whisper=WhisperConfig(**data["whisper"]),
        cleaning=CleaningConfig(**data["cleaning"]),
        export=ExportConfig(**data["export"]),
    )
