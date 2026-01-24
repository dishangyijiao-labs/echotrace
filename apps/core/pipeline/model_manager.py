"""Whisper model download and management"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from faster_whisper import WhisperModel


# HuggingFace cache directory
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "huggingface" / "hub"


def get_model_cache_path(model_size: str) -> Path:
    """Get the expected cache path for a model"""
    # faster-whisper downloads to: ~/.cache/huggingface/hub/models--Systran--faster-whisper-{model_size}
    model_name = f"models--Systran--faster-whisper-{model_size}"
    return DEFAULT_CACHE_DIR / model_name


def is_model_downloaded(model_size: str) -> bool:
    """Check if a model is already downloaded"""
    cache_path = get_model_cache_path(model_size)
    return cache_path.exists() and any(cache_path.iterdir())


def download_model(
    model_size: str,
    device: str = "cpu",
    progress_callback: Optional[callable] = None
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
                progress_callback(f"Model '{model_size}' already downloaded")
            return True
        
        if progress_callback:
            progress_callback(f"Downloading model '{model_size}'... This may take a few minutes.")
        
        # This will trigger the download
        compute_type = "float16" if device == "cuda" else "int8"
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        # Test the model to ensure it's properly loaded
        del model
        
        if progress_callback:
            progress_callback(f"Model '{model_size}' downloaded successfully!")
        
        return True
    
    except Exception as e:
        if progress_callback:
            progress_callback(f"Error downloading model: {str(e)}")
        return False


def get_model_info(model_size: str) -> dict:
    """Get information about a model"""
    model_sizes = {
        "tiny": {"size_mb": 75, "params": "39M", "speed": "~32x"},
        "base": {"size_mb": 142, "params": "74M", "speed": "~16x"},
        "small": {"size_mb": 466, "params": "244M", "speed": "~6x"},
        "medium": {"size_mb": 1500, "params": "769M", "speed": "~2x"},
        "large-v2": {"size_mb": 2900, "params": "1550M", "speed": "~1x"},
        "large-v3": {"size_mb": 2900, "params": "1550M", "speed": "~1x"},
    }
    
    info = model_sizes.get(model_size, {})
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
