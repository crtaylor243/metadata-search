-- Truncate all Discogs tables to remove existing data
-- Run this BEFORE importing to prevent duplicate data
--
-- WARNING: This will delete ALL data in the database!
-- Make sure you have backups if needed.
--
-- IMPORTANT: Using CASCADE to handle foreign key dependencies automatically

-- Show statistics before truncation
DO $$
DECLARE
    total_rows bigint := 0;
    table_count int := 0;
    rec RECORD;
BEGIN
    RAISE NOTICE 'Truncation Statistics:';
    RAISE NOTICE '═══════════════════════════════════════';

    FOR rec IN
        SELECT relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_live_tup > 0
        ORDER BY n_live_tup DESC
    LOOP
        RAISE NOTICE 'Table: %, Rows to delete: %',
            rpad(rec.table_name, 30),
            to_char(rec.row_count, '999,999,999,999');
        total_rows := total_rows + rec.row_count;
        table_count := table_count + 1;
    END LOOP;

    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE 'Total tables with data: %', table_count;
    RAISE NOTICE 'Total rows to delete: %', to_char(total_rows, '999,999,999,999');
    RAISE NOTICE '═══════════════════════════════════════';
END $$;

-- Truncate all tables in one command using CASCADE
-- This automatically handles foreign key dependencies
TRUNCATE TABLE
    artist,
    artist_alias,
    artist_image,
    artist_namevariation,
    artist_url,
    group_member,
    label,
    label_image,
    label_url,
    master,
    master_artist,
    master_genre,
    master_image,
    master_style,
    master_video,
    release,
    release_artist,
    release_company,
    release_format,
    release_genre,
    release_identifier,
    release_image,
    release_label,
    release_style,
    release_track,
    release_track_artist,
    release_video
RESTART IDENTITY CASCADE;

-- Show completion statistics
DO $$
DECLARE
    remaining_rows bigint := 0;
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Truncation Complete:';
    RAISE NOTICE '═══════════════════════════════════════';

    FOR rec IN
        SELECT relname as table_name, n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname = 'public' AND n_live_tup > 0
        ORDER BY n_live_tup DESC
    LOOP
        remaining_rows := remaining_rows + rec.row_count;
    END LOOP;

    IF remaining_rows = 0 THEN
        RAISE NOTICE '✓ All tables empty';
        RAISE NOTICE '✓ All sequences reset to 1';
        RAISE NOTICE '✓ Database ready for fresh import';
    ELSE
        RAISE NOTICE '⚠ Warning: % rows still present', remaining_rows;
    END IF;

    RAISE NOTICE '═══════════════════════════════════════';
END $$;
