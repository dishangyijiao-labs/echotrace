from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List

import pandas as pd
from rich.console import Console
from rich.progress import track

from .cleaning import clean_transcript
from .config import PipelineConfig, load_config
from .manifest import (
    ChunkFile,
    SourceFile,
    build_engine,
    fetch_pending_chunks,
    get_source,
    init_db,
    iter_sources,
    mark_chunk,
    register_chunks,
    register_sources,
    update_source,
)
from .media import chunk_audio, extract_audio, find_media
from .transcribe import load_model, transcribe_file

console = Console()


def _ensure_dirs(cfg: PipelineConfig) -> None:
    cfg.input_dir.mkdir(parents=True, exist_ok=True)
    cfg.staging_dir.mkdir(parents=True, exist_ok=True)
    cfg.output_dir.mkdir(parents=True, exist_ok=True)


def _audio_path(cfg: PipelineConfig, src: Path) -> Path:
    return cfg.staging_dir / "audio" / f"{src.stem}.wav"


def _chunk_dir(cfg: PipelineConfig, src: Path) -> Path:
    return cfg.staging_dir / "chunks" / src.stem


def _transcript_path(cfg: PipelineConfig, chunk_path: Path) -> Path:
    return cfg.staging_dir / "transcripts" / f"{chunk_path.stem}.json"


def _export_paths(cfg: PipelineConfig) -> Dict[str, Path]:
    return {
        "jsonl": cfg.output_dir / "clean.jsonl",
        "parquet": cfg.output_dir / "clean.parquet",
    }


def _dump_json(path: Path, payload: Dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def ingest_sources(cfg: PipelineConfig, engine) -> List[SourceFile]:
    media_paths = list(find_media([cfg.input_dir]))
    if not media_paths:
        console.print("[yellow]No media files discovered in input directory[/yellow]")
    register_sources(engine, media_paths)
    return list(iter_sources(engine, status="pending"))


def process_sources(cfg: PipelineConfig, engine, sources: Iterable[SourceFile]) -> None:
    for source in track(list(sources), description="Extracting audio"):
        src_path = Path(source.source_path)
        audio_path = _audio_path(cfg, src_path)
        try:
            extracted = extract_audio(src_path, audio_path, cfg.ffmpeg)
            chunk_paths = chunk_audio(extracted, _chunk_dir(cfg, src_path), cfg.ffmpeg)
            update_source(engine, src_path, audio_path=str(extracted), status="chunked")
            source_record = get_source(engine, src_path)
            if source_record and source_record.id is not None:
                register_chunks(engine, source_record.id, chunk_paths)
        except Exception as exc:  # noqa: BLE001
            update_source(engine, src_path, status="error", last_error=str(exc))
            console.print(f"[red]Failed to prepare {src_path}: {exc}[/red]")


def transcribe_chunks(cfg: PipelineConfig, engine) -> None:
    model = load_model(cfg.whisper)
    pending = fetch_pending_chunks(engine)
    while pending:
        for chunk in track(pending, description="Transcribing"):
            chunk_path = Path(chunk.chunk_path)
            transcript_path = _transcript_path(cfg, chunk_path)
            try:
                transcript = transcribe_file(model, chunk_path, cfg.whisper)
                cleaned = clean_transcript(transcript, cfg.cleaning)
                _dump_json(transcript_path, cleaned)
                mark_chunk(engine, chunk_path, "done", transcript_path)
            except Exception as exc:  # noqa: BLE001
                mark_chunk(engine, chunk_path, "error")
                console.print(f"[red]Failed to transcribe {chunk_path}: {exc}[/red]")
        pending = fetch_pending_chunks(engine)


def export_outputs(cfg: PipelineConfig, engine) -> None:
    from sqlmodel import Session, select

    exports = defaultdict(list)
    with Session(engine) as session:
        chunk_stmt = select(ChunkFile).where(ChunkFile.status == "done")
        chunks = session.exec(chunk_stmt).all()
        for chunk in chunks:
            if not chunk.transcript_path:
                continue
            payload = json.loads(Path(chunk.transcript_path).read_text())
            for seg in payload.get("segments", []):
                exports[chunk.source_id].append(
                    {
                        "source_id": chunk.source_id,
                        "chunk_path": chunk.chunk_path,
                        "start": seg["start"],
                        "end": seg["end"],
                        "text": seg["text"],
                    }
                )

    records: List[Dict] = []
    for items in exports.values():
        records.extend(items)

    if not records:
        console.print("[yellow]No cleaned records to export[/yellow]")
        return

    exports_dir = _export_paths(cfg)
    jsonl_path = exports_dir["jsonl"]
    parquet_path = exports_dir["parquet"]

    jsonl_path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in records))
    df = pd.DataFrame.from_records(records)
    df.to_parquet(parquet_path, index=False)

    console.print(f"[green]Exported {len(records)} cleaned segments[/green]")


def run_pipeline(config_path: str | Path) -> None:
    cfg = load_config(config_path)
    _ensure_dirs(cfg)
    engine = build_engine(cfg.manifest_db)
    init_db(engine)
    sources = ingest_sources(cfg, engine)
    if not sources:
        return
    process_sources(cfg, engine, sources)
    transcribe_chunks(cfg, engine)
    export_outputs(cfg, engine)
