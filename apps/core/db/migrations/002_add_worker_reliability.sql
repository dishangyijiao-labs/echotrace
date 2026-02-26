-- Migration 002: Worker reliability columns
-- Adds worker_id to job table for traceability and an index for stale-job queries.

-- Add worker_id column (safe to run even if it already exists via ALTER TABLE guard below)
ALTER TABLE job ADD COLUMN worker_id TEXT;

-- Index to speed up stale-job queries and status polling
CREATE INDEX IF NOT EXISTS idx_job_status_updated ON job (status, updated_at);
