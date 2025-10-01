from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from sqlmodel import Field, Session, SQLModel, create_engine, select


class SourceFile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_path: str = Field(index=True, unique=True)
    audio_path: Optional[str] = None
    status: str = Field(default="pending", index=True)
    duration: Optional[float] = None
    last_error: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ChunkFile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: int = Field(foreign_key="sourcefile.id")
    chunk_path: str = Field(unique=True, index=True)
    status: str = Field(default="pending", index=True)
    transcript_path: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


def build_engine(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{db_path}", echo=False)


def init_db(engine) -> None:
    SQLModel.metadata.create_all(engine)


def register_sources(engine, sources: Iterable[Path]) -> None:
    with Session(engine) as session:
        for path in sources:
            statement = select(SourceFile).where(SourceFile.source_path == str(path))
            existing = session.exec(statement).first()
            if existing:
                continue
            session.add(SourceFile(source_path=str(path)))
        session.commit()


def update_source(engine, source_path: Path, **fields) -> None:
    with Session(engine) as session:
        statement = select(SourceFile).where(SourceFile.source_path == str(source_path))
        record = session.exec(statement).first()
        if not record:
            record = SourceFile(source_path=str(source_path))
            session.add(record)
            session.flush()
        for key, value in fields.items():
            setattr(record, key, value)
        record.updated_at = datetime.utcnow()
        session.add(record)
        session.commit()


def register_chunks(engine, source_id: int, chunk_paths: Iterable[Path]) -> None:
    with Session(engine) as session:
        for chunk in chunk_paths:
            statement = select(ChunkFile).where(ChunkFile.chunk_path == str(chunk))
            existing = session.exec(statement).first()
            if existing:
                continue
            session.add(ChunkFile(source_id=source_id, chunk_path=str(chunk)))
        session.commit()


def fetch_pending_chunks(engine, limit: int = 8) -> list[ChunkFile]:
    with Session(engine) as session:
        statement = select(ChunkFile).where(ChunkFile.status == "pending").limit(limit)
        return list(session.exec(statement).all())


def mark_chunk(engine, chunk_path: Path, status: str, transcript_path: Optional[Path] = None) -> None:
    with Session(engine) as session:
        statement = select(ChunkFile).where(ChunkFile.chunk_path == str(chunk_path))
        record = session.exec(statement).first()
        if not record:
            return
        record.status = status
        if transcript_path:
            record.transcript_path = str(transcript_path)
        record.updated_at = datetime.utcnow()
        session.add(record)
        session.commit()


def iter_sources(engine, status: str = "pending") -> Iterable[SourceFile]:
    with Session(engine) as session:
        statement = select(SourceFile).where(SourceFile.status == status)
        yield from session.exec(statement)

def get_source(engine, source_path: Path) -> SourceFile | None:
    with Session(engine) as session:
        statement = select(SourceFile).where(SourceFile.source_path == str(source_path))
        return session.exec(statement).first()
