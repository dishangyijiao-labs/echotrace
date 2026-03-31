"""Whisper model download and management"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Callable, Optional

from faster_whisper import WhisperModel


# HuggingFace cache directory
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "huggingface" / "hub"

# App bundle model directory (for packaged apps)
APP_ROOT = Path(__file__).resolve().parent.parent
BUNDLE_MODEL_DIR = APP_ROOT / "models"


def get_bundled_model_path(model_size: str) -> Optional[Path]:
    """Get path to bundled model if available"""
    bundled_path = BUNDLE_MODEL_DIR / model_size
    if bundled_path.exists() and any(bundled_path.iterdir()):
        return bundled_path
    return None


def get_model_cache_path(model_size: str) -> Path:
    """Get the expected cache path for a model"""
    # faster-whisper downloads to: ~/.cache/huggingface/hub/models--Systran--faster-whisper-{model_size}
    model_name = f"models--Systran--faster-whisper-{model_size}"
    return DEFAULT_CACHE_DIR / model_name


def copy_bundled_model_to_cache(model_size: str) -> bool:
    """Copy bundled model to user cache directory if available"""
    bundled_path = get_bundled_model_path(model_size)
    if not bundled_path:
        return False
    
    cache_path = get_model_cache_path(model_size)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        if cache_path.exists():
            # Already exists, skip
            return True
        
        print(f"Copying bundled {model_size} model to cache...")
        shutil.copytree(bundled_path, cache_path)
        print(f"✅ Model copied successfully")
        return True
    except Exception as e:
        print(f"⚠️  Failed to copy bundled model: {e}")
        return False


def is_model_downloaded(model_size: str) -> bool:
    """Check if a model is already downloaded (in cache or bundled)"""
    # First check if bundled model exists
    if get_bundled_model_path(model_size):
        # Try to copy to cache for faster-whisper to use
        copy_bundled_model_to_cache(model_size)
    
    # Check cache directory
    cache_path = get_model_cache_path(model_size)
    return cache_path.exists() and any(cache_path.iterdir())


def download_model(
    model_size: str,
    device: str = "cpu",
    progress_callback: Optional[Callable[[str, float], None]] = None
) -> bool:
    """
    Pre-download a Whisper model
    
    Args:
        model_size: Model size (tiny, base, small, medium, large-v2, large-v3)
        device: Device to use (cpu, cuda, auto)
        progress_callback: Optional callback function for progress updates
    
    Returns:
        True if successful, False otherwise
    """
    try:
        if is_model_downloaded(model_size):
            if progress_callback:
                progress_callback(f"Model '{model_size}' already downloaded", 1.0)
            return True

        if progress_callback:
            progress_callback(f"Downloading model '{model_size}'... This may take a few minutes.", 0.0)

        # This will trigger the download
        compute_type = "float16" if device == "cuda" else "int8"
        model = WhisperModel(model_size, device=device, compute_type=compute_type)

        # Test the model to ensure it's properly loaded
        del model

        if progress_callback:
            progress_callback(f"Model '{model_size}' downloaded successfully!", 0.9)

        return True

    except Exception as e:
        if progress_callback:
            progress_callback(f"Error downloading model: {str(e)}", 0.0)
        return False


def get_model_info(model_size: str) -> Optional[dict]:
    """Get information about a model, or None if the model name is unknown."""
    model_sizes = {
        "tiny": {"size_mb": 75, "params": "39M", "speed": "~32x"},
        "base": {"size_mb": 142, "params": "74M", "speed": "~16x"},
        "small": {"size_mb": 466, "params": "244M", "speed": "~6x"},
        "medium": {"size_mb": 1500, "params": "769M", "speed": "~2x"},
        "large-v2": {"size_mb": 2900, "params": "1550M", "speed": "~1x"},
        "large-v3": {"size_mb": 2900, "params": "1550M", "speed": "~1x"},
    }

    base_info = model_sizes.get(model_size)
    if base_info is None:
        return None

    info = dict(base_info)
    info["downloaded"] = is_model_downloaded(model_size)
    info["cache_path"] = str(get_model_cache_path(model_size))

    return info


def ensure_model_available(model_size: str, device: str = "cpu") -> bool:
    """
    Ensure a model is available, download if necessary
    
    This is a blocking call that will download the model if not present.
    Use download_model() for async/background downloads.
    """
    if is_model_downloaded(model_size):
        return True
    
    print(f"Model '{model_size}' not found. Downloading...")
    return download_model(model_size, device)


if __name__ == "__main__":
    # Test script
    import sys
    
    if len(sys.argv) > 1:
        model = sys.argv[1]
    else:
        model = "base"
    
    print(f"Checking model: {model}")
    info = get_model_info(model)
    print(f"  Downloaded: {info['downloaded']}")
    print(f"  Size: {info.get('size_mb', 'unknown')} MB")
    print(f"  Cache path: {info['cache_path']}")
    
    if not info['downloaded']:
        print(f"\nDownloading {model} model...")
        success = download_model(model, progress_callback=print)
        if success:
            print(f"✅ Model ready!")
        else:
            print(f"❌ Download failed")
