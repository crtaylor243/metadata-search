-- Update table statistics for query planner optimization
-- ANALYZE collects statistics about table contents to help PostgreSQL choose optimal query plans

-- Estimated time: 2-5 minutes

\timing on

-- =============================================================================
-- ANALYZE KEY TABLES
-- =============================================================================
-- Focus on tables with new columns/indexes or heavy query usage

ANALYZE VERBOSE label;
ANALYZE VERBOSE artist;
ANALYZE VERBOSE release;
ANALYZE VERBOSE release_label;
ANALYZE VERBOSE release_artist;
ANALYZE VERBOSE release_track;
ANALYZE VERBOSE release_track_artist;

-- =============================================================================
-- ANALYZE MATERIALIZED VIEWS
-- =============================================================================

ANALYZE VERBOSE mv_format_variants;

-- =============================================================================
-- SUMMARY
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ Table statistics updated successfully';
    RAISE NOTICE '  Query planner now has accurate data for optimization';
END $$;

\timing off
