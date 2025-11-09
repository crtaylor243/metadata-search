-- Create import progress tracking table for idempotent CSV imports
-- This table allows imports to resume after network failures or interruptions

CREATE TABLE IF NOT EXISTS import_progress (
    table_name TEXT PRIMARY KEY,
    csv_file TEXT NOT NULL,
    expected_rows BIGINT,
    imported_rows BIGINT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    attempt_count INTEGER DEFAULT 0
);

-- Add helpful comment
COMMENT ON TABLE import_progress IS 'Tracks CSV import progress to enable resumable imports after failures';

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_import_progress_status ON import_progress(status);

-- Display confirmation
DO $$
BEGIN
    RAISE NOTICE '✓ Import progress tracking table created';
END $$;
