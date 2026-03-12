-- Migration 004: Rebuild FTS index with trigram tokenizer
-- Ensures the segment_fts table uses the trigram tokenizer for proper CJK/Chinese
-- substring matching. Older databases may have been created with the default
-- unicode61 tokenizer which cannot segment Chinese text (no spaces between words).
-- The trigram tokenizer enables substring matching for any language.

-- Drop existing triggers first
DROP TRIGGER IF EXISTS segment_fts_insert;
DROP TRIGGER IF EXISTS segment_fts_update;
DROP TRIGGER IF EXISTS segment_fts_delete;

-- Drop and recreate the FTS table with trigram tokenizer
DROP TABLE IF EXISTS segment_fts;

CREATE VIRTUAL TABLE segment_fts USING fts5(
  text,
  content='segment',
  content_rowid='id',
  tokenize='trigram'
);

-- Repopulate from existing segment data
INSERT INTO segment_fts(rowid, text) SELECT id, text FROM segment;

-- Recreate triggers
CREATE TRIGGER segment_fts_insert
AFTER INSERT ON segment
BEGIN
  INSERT INTO segment_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER segment_fts_update
AFTER UPDATE ON segment
BEGIN
  UPDATE segment_fts SET text = new.text WHERE rowid = new.id;
END;

CREATE TRIGGER segment_fts_delete
AFTER DELETE ON segment
BEGIN
  DELETE FROM segment_fts WHERE rowid = old.id;
END;
