-- Create materialized views for pre-computed aggregations
-- These views trade storage space for query performance

-- Estimated time: 5-10 minutes

\timing on

-- =============================================================================
-- FORMAT VARIANTS MATERIALIZED VIEW
-- =============================================================================
-- Pre-aggregates all format variants for each unique shadow catalog number
-- This eliminates the need for expensive GROUP BY operations in label releases queries
--
-- Example: Release "ABC-123" exists as Vinyl, CD, and Digital
-- Instead of grouping 3 rows at query time, we pre-compute and store the aggregation
--
-- Query time improvement: ~10-50x faster for large label catalogs

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_format_variants AS
SELECT
    rl.label_id,
    r.shadow_catno,
    MIN(r.id) as canonical_release_id,
    MIN(r.title) as title,
    MIN(r.released) as earliest_release_date,
    json_agg(
        json_build_object(
            'id', r.id,
            'released', r.released,
            'catno', rl.catno,
            'country', r.country
        ) ORDER BY r.released, r.id
    ) as format_variants,
    COUNT(*) as variant_count
FROM release r
    INNER JOIN release_label rl ON r.id = rl.release_id
WHERE r.shadow_catno IS NOT NULL
    AND rl.label_id IS NOT NULL
GROUP BY rl.label_id, r.shadow_catno;

-- Index for fast lookups by label
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_format_variants_label_shadow
ON mv_format_variants(label_id, shadow_catno);

-- Index for direct canonical release lookups
CREATE INDEX IF NOT EXISTS idx_mv_format_variants_canonical
ON mv_format_variants(canonical_release_id);

-- Add helpful comments
COMMENT ON MATERIALIZED VIEW mv_format_variants IS 'Pre-aggregated format variants grouped by label and shadow catalog number. Refresh after data updates with: REFRESH MATERIALIZED VIEW mv_format_variants;';

-- =============================================================================
-- SUMMARY AND REFRESH INSTRUCTIONS
-- =============================================================================

DO $$
DECLARE
    row_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO row_count FROM mv_format_variants;

    RAISE NOTICE '✓ Materialized views created successfully';
    RAISE NOTICE '  mv_format_variants: % unique catalog numbers', row_count;
    RAISE NOTICE '';
    RAISE NOTICE 'To refresh after data changes:';
    RAISE NOTICE '  REFRESH MATERIALIZED VIEW mv_format_variants;';
    RAISE NOTICE '  (Takes ~5 minutes)';
END $$;

\timing off
