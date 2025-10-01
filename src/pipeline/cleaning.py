from __future__ import annotations

import re
from typing import Dict

from langdetect import detect
from unidecode import unidecode

from .config import CleaningConfig

_DISFLUENCY = re.compile(r"(呃|嗯|啊|uh|um)+", re.IGNORECASE)
_SPACE = re.compile(r"\s+")


def _normalize(text: str, cfg: CleaningConfig) -> str:
    if cfg.strip_disfluencies:
        text = _DISFLUENCY.sub(" ", text)
    if cfg.normalize_punctuation:
        text = (
            text.replace("，", ",")
            .replace("。", ".")
            .replace("？", "?")
            .replace("！", "!")
        )
    text = _SPACE.sub(" ", text)
    return text.strip()


def _keep(text: str, cfg: CleaningConfig) -> bool:
    if not cfg.min_chars <= len(text) <= cfg.max_chars:
        return False
    try:
        detected = detect(text)
    except Exception:
        return False
    normalized_lang = detected.lower()
    return normalized_lang in {lang.lower() for lang in cfg.allowed_languages}


def clean_transcript(transcript: Dict, cfg: CleaningConfig) -> Dict:
    cleaned_segments = []
    seen = set()
    for seg in transcript.get("segments", []):
        text = _normalize(seg["text"], cfg)
        if not text:
            continue
        translated = unidecode(text)
        repeat_ratio = len(set(translated.split())) / max(len(translated.split()), 1)
        if repeat_ratio < cfg.drop_repeated_ratio:
            continue
        if not _keep(text, cfg):
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned_segments.append({**seg, "text": text})
    transcript["segments"] = cleaned_segments
    return transcript
