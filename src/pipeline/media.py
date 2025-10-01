from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Sequence

from .config import FFMpegConfig


SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".wav", ".m4a", ".mov", ".avi", ".flac", ".mkv"}


@dataclass
class MediaFile:
    source_path: Path
    audio_path: Path
    chunk_paths: Sequence[Path]


def find_media(paths: Iterable[Path]) -> Iterator[Path]:
    for root in paths:
        for item in Path(root).rglob("*"):
            if item.suffix.lower() in SUPPORTED_SUFFIXES:
                yield item


def _run_ffmpeg(args: list[str]) -> None:
    try:
        subprocess.run(["ffmpeg", *args], check=True)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg not found in PATH") from exc


def extract_audio(src: Path, dst: Path, cfg: FFMpegConfig) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    result = dst.with_suffix(".wav")
    cmd = [
        "-y",
        "-i",
        str(src),
        "-acodec",
        cfg.audio_codec,
        "-ar",
        str(cfg.target_samplerate),
        str(result),
    ]
    _run_ffmpeg(cmd)
    return result


def chunk_audio(src: Path, chunk_dir: Path, cfg: FFMpegConfig) -> list[Path]:
    chunk_dir.mkdir(parents=True, exist_ok=True)
    template = chunk_dir / f"{src.stem}_%05d.wav"
    cmd = [
        "-y",
        "-i",
        str(src),
        "-f",
        "segment",
        "-segment_time",
        str(cfg.chunk_seconds),
        "-c",
        "copy",
        str(template),
    ]
    _run_ffmpeg(cmd)
    return sorted(chunk_dir.glob(f"{src.stem}_*.wav"))
