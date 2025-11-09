-- Create optimized indexes for search, filtering, and sorting operations
-- These indexes dramatically improve query performance for the application

-- Estimated time: 20-30 minutes for all indexes

\timing on

-- =============================================================================
-- 1. FUZZY TEXT SEARCH INDEXES (using pg_trgm)
-- =============================================================================

-- Label search: Enables fast fuzzy matching on label names
-- Example: "Blue Note" matches "Blue Note Records", "blue note", etc.
CREATE INDEX IF NOT EXISTS idx_label_name_trgm
ON label USING gin(name gin_trgm_ops);

-- Artist search: Enables fast fuzzy matching on artist names
-- Example: "Miles Davis" matches "Davis, Miles", "miles davis", etc.
CREATE INDEX IF NOT EXISTS idx_artist_name_trgm
ON artist USING gin(name gin_trgm_ops);

-- =============================================================================
-- 2. RELEASE SORTING AND FILTERING INDEXES
-- =============================================================================

-- Shadow catalog number: Primary sorting mechanism for label releases
-- Enables fast ORDER BY shadow_catno queries
CREATE INDEX IF NOT EXISTS idx_release_shadow_catno
ON release(shadow_catno);

-- Label filtering: Fast lookup of all releases for a specific label
-- Used in: SELECT * FROM release_label WHERE label_id = ?
CREATE INDEX IF NOT EXISTS idx_release_label_label_id
ON release_label(label_id);

-- Composite index for label releases query (most common query)
-- Optimizes: SELECT * FROM release WHERE label_id = ? ORDER BY shadow_catno
-- Note: INCLUDE columns reduce need for heap lookups
CREATE INDEX IF NOT EXISTS idx_release_label_shadow
ON release_label(label_id, release_id);

-- Artist releases: Fast lookup by artist
CREATE INDEX IF NOT EXISTS idx_release_artist_artist_id
ON release_artist(artist_id, release_id);

-- =============================================================================
-- 3. TRACK AND CREDIT INDEXES
-- =============================================================================

-- Track lookup: Fast joins from release to tracks
-- Optimizes: SELECT * FROM release_track WHERE release_id = ? ORDER BY sequence
CREATE INDEX IF NOT EXISTS idx_release_track_release_seq
ON release_track(release_id, sequence);

-- Credit lookup: Fast joins from track to credits
-- Optimizes: SELECT * FROM release_track_artist WHERE release_id = ? AND track_sequence = ?
CREATE INDEX IF NOT EXISTS idx_release_track_artist_track
ON release_track_artist(release_id, track_sequence);

-- Credit role filtering: Fast search for writers/composers/producers
-- Enables queries like: WHERE role ILIKE '%Written By%'
CREATE INDEX IF NOT EXISTS idx_release_track_artist_role
ON release_track_artist USING gin(role gin_trgm_ops);

-- Credit artist lookup: Fast joins to artist table for credits
-- Handles the LEFT JOIN artist ON release_track_artist.artist_id = artist.id pattern
CREATE INDEX IF NOT EXISTS idx_release_track_artist_artist_id
ON release_track_artist(artist_id) WHERE artist_id IS NOT NULL;

-- =============================================================================
-- SUMMARY
-- =============================================================================

DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

    RAISE NOTICE '✓ Search optimization indexes created successfully';
    RAISE NOTICE '  Total application indexes: %', idx_count;
END $$;

\timing off
