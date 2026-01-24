CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,
  duration REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript (
  id INTEGER PRIMARY KEY,
  media_id INTEGER NOT NULL REFERENCES media(id),
  content TEXT NOT NULL,
  language TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segment (
  id INTEGER PRIMARY KEY,
  transcript_id INTEGER NOT NULL REFERENCES transcript(id),
  start REAL NOT NULL,
  end REAL NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  id INTEGER PRIMARY KEY,
  media_id INTEGER NOT NULL REFERENCES media(id),
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

CREATE VIRTUAL TABLE IF NOT EXISTS segment_fts USING fts5(
  text,
  content='segment',
  content_rowid='id',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS segment_fts_insert
AFTER INSERT ON segment
BEGIN
  INSERT INTO segment_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS segment_fts_update
AFTER UPDATE ON segment
BEGIN
  UPDATE segment_fts SET text = new.text WHERE rowid = new.id;
END;

CREATE TRIGGER IF NOT EXISTS segment_fts_delete
AFTER DELETE ON segment
BEGIN
  DELETE FROM segment_fts WHERE rowid = old.id;
END;
