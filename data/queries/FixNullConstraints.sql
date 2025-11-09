-- Fix NOT NULL constraints that are too restrictive
-- Run this AFTER CreateTables.sql but BEFORE importing CSV files
--
-- These constraints prevent import of legitimate Discogs data where
-- artist/label/company IDs are not linked but names are present
--
-- Data affected:
-- - master_artist: 131 records with NULL artist_id (0.004%)
-- - release_artist: 789,481 records with NULL artist_id (0.87%)
-- - release_company: 2,705 records with NULL company_id (0.008%)
-- - release_track_artist: 1,070,401 records with NULL artist_id (0.87%)
--
-- See: .claude/schema-fixes-required.md for full analysis

ALTER TABLE master_artist ALTER COLUMN artist_id DROP NOT NULL;
ALTER TABLE release_artist ALTER COLUMN artist_id DROP NOT NULL;
ALTER TABLE release_company ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE release_track_artist ALTER COLUMN artist_id DROP NOT NULL;
