-- EchoTrace Database Schema
-- SQLite with FTS5 for full-text search

-- Media files table
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,
  duration REAL,
  created_at TEXT NOT NULL
);

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcript (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  language TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Segments table (individual transcript segments with timestamps)
CREATE TABLE IF NOT EXISTS segment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transcript_id INTEGER NOT NULL REFERENCES transcript(id) ON DELETE CASCADE,
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL
);

-- Jobs table (transcription processing queue)
CREATE TABLE IF NOT EXISTS job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  engine TEXT NOT NULL,
  model TEXT NOT NULL,
  device TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  processed_segments INTEGER NOT NULL DEFAULT 0,
  total_segments INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_media_path ON media(path);
CREATE INDEX IF NOT EXISTS idx_transcript_media ON transcript(media_id);
CREATE INDEX IF NOT EXISTS idx_segment_transcript ON segment(transcript_id);
CREATE INDEX IF NOT EXISTS idx_job_status ON job(status);
CREATE INDEX IF NOT EXISTS idx_job_media ON job(media_id);

-- Full-text search virtual table using FTS5
-- This enables fast text search across all transcript segments
CREATE VIRTUAL TABLE IF NOT EXISTS segment_fts USING fts5(
  text,
  content='segment',
  content_rowid='id',
  tokenize='trigram'
);

-- Triggers to keep FTS index in sync with segment table

-- Insert trigger: add new segment to FTS index
CREATE TRIGGER IF NOT EXISTS segment_fts_insert
AFTER INSERT ON segment
BEGIN
  INSERT INTO segment_fts(rowid, text) VALUES (new.id, new.text);
END;

-- Update trigger: update FTS index when segment changes
CREATE TRIGGER IF NOT EXISTS segment_fts_update
AFTER UPDATE ON segment
BEGIN
  UPDATE segment_fts SET text = new.text WHERE rowid = new.id;
END;

-- Delete trigger: remove from FTS index when segment is deleted
CREATE TRIGGER IF NOT EXISTS segment_fts_delete
AFTER DELETE ON segment
BEGIN
  DELETE FROM segment_fts WHERE rowid = old.id;
END;
