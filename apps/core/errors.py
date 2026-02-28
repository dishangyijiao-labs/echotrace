"""Centralised error codes, response models, and helpers for EchoTrace Core API."""
from __future__ import annotations

import re
import uuid
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None
    request_id: str
    docs_url: Optional[str] = None


class E:
    # Media import
    PATHS_EMPTY = "PATHS_EMPTY"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_MIME = "UNSUPPORTED_MIME"
    PATH_TRAVERSAL = "PATH_TRAVERSAL"

    # Jobs / transcripts
    MEDIA_NOT_FOUND = "MEDIA_NOT_FOUND"
    TRANSCRIPT_NOT_FOUND = "TRANSCRIPT_NOT_FOUND"
    JOB_NOT_FOUND = "JOB_NOT_FOUND"
    NO_SEGMENTS = "NO_SEGMENTS"

    # Export
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    EXPORT_EMPTY = "EXPORT_EMPTY"

    # Models
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    MODEL_DOWNLOAD_FAILED = "MODEL_DOWNLOAD_FAILED"
    DOWNLOAD_IN_PROGRESS = "DOWNLOAD_IN_PROGRESS"

    # RAG / agent
    RAG_NOT_ENABLED = "RAG_NOT_ENABLED"
    UNKNOWN_PROVIDER = "UNKNOWN_PROVIDER"
    UNKNOWN_AGENT = "UNKNOWN_AGENT"

    # Generic
    INTERNAL_ERROR = "INTERNAL_ERROR"


# Patterns that leak server internals
_PATH_RE = re.compile(r"(/[^\s]+)+")
_TRACEBACK_RE = re.compile(r"Traceback \(most recent call last\).*", re.DOTALL)


def sanitize_error(raw: str) -> str:
    """Strip absolute paths and tracebacks from error strings."""
    cleaned = _TRACEBACK_RE.sub("", raw)
    cleaned = _PATH_RE.sub("<path>", cleaned)
    return cleaned.strip() or "An internal error occurred."


def build_error(
    code: str,
    message: str,
    detail: str | None = None,
    docs_url: str | None = None,
) -> ErrorResponse:
    return ErrorResponse(
        code=code,
        message=message,
        detail=detail,
        request_id=str(uuid.uuid4()),
        docs_url=docs_url,
    )


def raise_api_error(
    status_code: int,
    code: str,
    message: str,
    detail: str | None = None,
) -> None:
    """Raise a FastAPI HTTPException with a structured ErrorResponse body."""
    err = build_error(code, message, detail)
    raise HTTPException(status_code=status_code, detail=err.model_dump())
