"""Tests for pipeline.media — ffmpeg discovery and audio extraction."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from pipeline.media import _find_ffmpeg, _run_ffmpeg, _FFMPEG_SEARCH_PATHS
import pipeline.media as media_mod


@pytest.fixture(autouse=True)
def _reset_ffmpeg_cache(tmp_path_factory):
    """Reset cache and isolate bundled-binary lookup.

    Default assumption: no bundled <core>/bin/ffmpeg exists. The real project ships a
    bundled ffmpeg for macOS .app packaging, which would otherwise short-circuit the
    well-known-paths and PATH branches in _find_ffmpeg. Tests exercising the bundled
    branch (test_bundled_binary) override __file__ themselves.
    """
    media_mod._ffmpeg_bin = None
    sandbox = tmp_path_factory.mktemp("ffmpeg_sandbox")
    fake_pipeline = sandbox / "pipeline"
    fake_pipeline.mkdir()
    fake_file = fake_pipeline / "media.py"
    fake_file.touch()
    with patch.object(media_mod, "__file__", str(fake_file)):
        yield
    media_mod._ffmpeg_bin = None


class TestFindFfmpeg:
    def test_env_var_takes_priority(self, tmp_path):
        """ECHOTRACE_FFMPEG env var should be checked first."""
        fake_ffmpeg = tmp_path / "ffmpeg"
        fake_ffmpeg.touch()
        with patch.dict(os.environ, {"ECHOTRACE_FFMPEG": str(fake_ffmpeg)}):
            assert _find_ffmpeg() == str(fake_ffmpeg)

    def test_env_var_ignored_if_missing_file(self, tmp_path):
        """Env var pointing to non-existent file should be skipped."""
        with patch.dict(os.environ, {"ECHOTRACE_FFMPEG": "/no/such/ffmpeg"}), \
             patch("shutil.which", return_value="/usr/local/bin/ffmpeg"):
            result = _find_ffmpeg()
            assert result != "/no/such/ffmpeg"

    def test_bundled_binary(self, tmp_path):
        """Bundled binary at <core>/bin/ffmpeg should be found."""
        # Simulate core dir structure: tmp_path/pipeline/media.py -> core = tmp_path
        bundled = tmp_path / "bin" / "ffmpeg"
        bundled.parent.mkdir(parents=True)
        bundled.touch()
        with patch.dict(os.environ, {}, clear=False), \
             patch.object(media_mod, "_FFMPEG_SEARCH_PATHS", []):
            # Remove env var if present
            env = os.environ.copy()
            env.pop("ECHOTRACE_FFMPEG", None)
            with patch.dict(os.environ, env, clear=True):
                # Patch __file__ to simulate core dir
                fake_file = tmp_path / "pipeline" / "media.py"
                fake_file.parent.mkdir(parents=True, exist_ok=True)
                fake_file.touch()
                with patch.object(media_mod, "__file__", str(fake_file)):
                    result = _find_ffmpeg()
                    assert result == str(bundled)

    def test_well_known_paths(self, tmp_path):
        """Should find ffmpeg via well-known system paths list."""
        fake_ffmpeg = tmp_path / "ffmpeg"
        fake_ffmpeg.touch()
        env = os.environ.copy()
        env.pop("ECHOTRACE_FFMPEG", None)
        with patch.dict(os.environ, env, clear=True), \
             patch.object(media_mod, "_FFMPEG_SEARCH_PATHS", [str(fake_ffmpeg)]):
            result = _find_ffmpeg()
            assert result == str(fake_ffmpeg)

    def test_shutil_which_fallback(self):
        """Should fall back to shutil.which when nothing else works."""
        with patch.dict(os.environ, {}, clear=False):
            env = os.environ.copy()
            env.pop("ECHOTRACE_FFMPEG", None)
            with patch.dict(os.environ, env, clear=True), \
                 patch("pathlib.Path.is_file", return_value=False), \
                 patch("shutil.which", return_value="/some/other/ffmpeg"):
                result = _find_ffmpeg()
                assert result == "/some/other/ffmpeg"

    def test_raises_when_not_found(self):
        """Should raise RuntimeError with install instructions when ffmpeg is missing."""
        with patch.dict(os.environ, {}, clear=False):
            env = os.environ.copy()
            env.pop("ECHOTRACE_FFMPEG", None)
            with patch.dict(os.environ, env, clear=True), \
                 patch("pathlib.Path.is_file", return_value=False), \
                 patch("shutil.which", return_value=None):
                with pytest.raises(RuntimeError, match="ffmpeg not found"):
                    _find_ffmpeg()

    def test_result_is_cached(self, tmp_path):
        """Second call should return cached result without re-scanning."""
        fake_ffmpeg = tmp_path / "ffmpeg"
        fake_ffmpeg.touch()
        with patch.dict(os.environ, {"ECHOTRACE_FFMPEG": str(fake_ffmpeg)}):
            first = _find_ffmpeg()
        # Even after removing env var, cached value persists
        with patch.dict(os.environ, {}, clear=True), \
             patch("pathlib.Path.is_file", return_value=False), \
             patch("shutil.which", return_value=None):
            second = _find_ffmpeg()
        assert first == second == str(fake_ffmpeg)


class TestRunFfmpeg:
    def test_calls_subprocess_with_resolved_binary(self):
        """_run_ffmpeg should call subprocess.run with the resolved ffmpeg path."""
        media_mod._ffmpeg_bin = "/resolved/ffmpeg"
        with patch("subprocess.run") as mock_run:
            _run_ffmpeg(["-y", "-i", "input.wav", "output.wav"])
            mock_run.assert_called_once_with(
                ["/resolved/ffmpeg", "-y", "-i", "input.wav", "output.wav"],
                check=True,
            )

    def test_propagates_subprocess_error(self):
        """CalledProcessError from ffmpeg should propagate."""
        media_mod._ffmpeg_bin = "/resolved/ffmpeg"
        with patch("subprocess.run", side_effect=subprocess.CalledProcessError(1, "ffmpeg")):
            with pytest.raises(subprocess.CalledProcessError):
                _run_ffmpeg(["-version"])
