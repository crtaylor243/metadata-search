-- Add shadow_catno column to release table for optimized sorting and deduplication
-- This column stores a normalized version of the catalog number for consistent sorting

-- Add column if it doesn't exist
ALTER TABLE release ADD COLUMN IF NOT EXISTS shadow_catno TEXT;

-- Create a temporary index to speed up updates (will be replaced by final index)
CREATE INDEX IF NOT EXISTS idx_release_id_temp ON release(id);

-- Add a comment explaining the column
COMMENT ON COLUMN release.shadow_catno IS 'Normalized catalog number for sorting: uppercase, zero-padded numbers, tab-separated segments';
