-- Migration 003: Search filter indexes
-- Adds indexes to support filtered search queries (date range, language, duration).

CREATE INDEX IF NOT EXISTS idx_transcript_language ON transcript (language);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media (created_at);
CREATE INDEX IF NOT EXISTS idx_media_duration ON media (duration);
CREATE INDEX IF NOT EXISTS idx_media_file_type ON media (file_type);
