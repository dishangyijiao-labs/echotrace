from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".wav", ".m4a", ".mov", ".avi", ".flac", ".mkv"}

# Common ffmpeg install locations on macOS (Homebrew, MacPorts, system)
_FFMPEG_SEARCH_PATHS = [
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/local/bin/ffmpeg",
    "/usr/bin/ffmpeg",
]

_ffmpeg_bin: str | None = None


def _find_ffmpeg() -> str:
    """Resolve ffmpeg binary: env var → bundled → well-known paths → PATH."""
    global _ffmpeg_bin
    if _ffmpeg_bin is not None:
        return _ffmpeg_bin

    # 1. Explicit env var (set by Tauri or user)
    from_env = os.environ.get("ECHOTRACE_FFMPEG")
    if from_env and Path(from_env).is_file():
        _ffmpeg_bin = from_env
        return _ffmpeg_bin

    # 2. Bundled binary next to core dir: <Resources>/bin/ffmpeg
    core_dir = Path(__file__).resolve().parent.parent  # pipeline/ -> core/
    bundled = core_dir / "bin" / "ffmpeg"
    if bundled.is_file():
        _ffmpeg_bin = str(bundled)
        return _ffmpeg_bin

    # 3. Well-known system paths (critical for macOS .app where PATH is minimal)
    for candidate in _FFMPEG_SEARCH_PATHS:
        if Path(candidate).is_file():
            _ffmpeg_bin = candidate
            return _ffmpeg_bin

    # 4. Fall back to PATH lookup
    found = shutil.which("ffmpeg")
    if found:
        _ffmpeg_bin = found
        return _ffmpeg_bin

    raise RuntimeError(
        "ffmpeg not found. Install it via: brew install ffmpeg"
    )


def _run_ffmpeg(args: list[str]) -> None:
    ffmpeg = _find_ffmpeg()
    subprocess.run([ffmpeg, *args], check=True)


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
