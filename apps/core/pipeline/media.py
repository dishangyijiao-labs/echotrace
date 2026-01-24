from __future__ import annotations

import subprocess
from pathlib import Path

SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".wav", ".m4a", ".mov", ".avi", ".flac", ".mkv"}


def _run_ffmpeg(args: list[str]) -> None:
    try:
        subprocess.run(["ffmpeg", *args], check=True)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg not found in PATH") from exc


def extract_audio(src: Path, dst: Path) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    result = dst.with_suffix(".wav")
    cmd = [
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(result),
    ]
    _run_ffmpeg(cmd)
    return result
