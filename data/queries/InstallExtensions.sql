-- Install PostgreSQL extensions for advanced search capabilities

-- pg_trgm: Trigram matching for fuzzy text search
-- Enables LIKE/ILIKE queries to use GIN indexes for fast searching
-- Example: "Blue Note" matches "blue note records", "Blue Note Records", etc.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Display confirmation
DO $$
BEGIN
    RAISE NOTICE '✓ pg_trgm extension installed/verified';
END $$;
