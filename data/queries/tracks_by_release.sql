-- Tracks by Release Query
-- Get all tracks for a specific release with full credits
--
-- Usage:
--   1. First run releases_by_label.sql to find releases
--   2. Copy the release_id from the results
--   3. Replace '1234567' below with your release ID
--
-- Returns:
--   - Track listing with positions
--   - Track titles and durations
--   - Artists/performers per track
--   - Writers/composers
--   - Producers and other credits
--   - Complete "Contract Schedule" export format

-- Example release ID (replace this value)
-- For "A Love Supreme" by John Coltrane: 1234567
\set release_id 1234567

-- Main query: Complete track listing with all credits
SELECT
    rt.position,
    rt.title as track_title,
    rt.duration,
    -- Primary performers
    STRING_AGG(
        DISTINCT CASE WHEN rta.role IS NULL OR rta.role = ''
        THEN COALESCE(a.name, rta.artist_name)
        ELSE NULL END,
        ', '
    ) as performers,
    -- Writers/Composers
    STRING_AGG(
        DISTINCT CASE WHEN rta.role IN ('Written By', 'Written-By', 'Composer', 'Music By')
        THEN COALESCE(a.name, rta.artist_name)
        ELSE NULL END,
        ', '
    ) as writers,
    -- Producers
    STRING_AGG(
        DISTINCT CASE WHEN rta.role IN ('Producer', 'Produced By', 'Executive Producer')
        THEN COALESCE(a.name, rta.artist_name)
        ELSE NULL END,
        ', '
    ) as producers,
    -- All other credits
    STRING_AGG(
        DISTINCT CASE WHEN rta.role NOT IN ('Written By', 'Written-By', 'Composer', 'Music By', 'Producer', 'Produced By', 'Executive Producer')
            AND rta.role IS NOT NULL AND rta.role != ''
        THEN rta.role || ': ' || COALESCE(a.name, rta.artist_name)
        ELSE NULL END,
        ', '
    ) as other_credits
FROM
    release_track rt
    LEFT JOIN release_track_artist rta ON rt.id = rta.track_id
    LEFT JOIN artist a ON rta.artist_id = a.id
WHERE
    rt.release_id = :release_id
GROUP BY
    rt.id,
    rt.position,
    rt.title,
    rt.duration,
    rt.sequence
ORDER BY
    rt.sequence,
    rt.position;

-- Alternative: "Contract Schedule" export format
-- This matches the format needed for licensing/contract schedules
/*
SELECT
    -- Release info (same for all tracks)
    r.title as album,
    COALESCE(main_artist.name, ra_main.artist_name) as album_artist,
    -- Track info
    rt.position,
    rt.title as recording_title,
    -- Control (writers/composers)
    COALESCE(
        STRING_AGG(
            DISTINCT CASE WHEN rta.role IN ('Written By', 'Written-By', 'Composer', 'Music By')
            THEN COALESCE(a.name, rta.artist_name)
            ELSE NULL END,
            ', '
        ),
        'Unknown'
    ) as control,
    -- Additional info
    rt.duration,
    STRING_AGG(
        DISTINCT CASE WHEN rta.role IN ('Producer', 'Produced By')
        THEN COALESCE(a.name, rta.artist_name)
        ELSE NULL END,
        ', '
    ) as producer
FROM
    release r
    INNER JOIN release_track rt ON r.id = rt.release_id
    LEFT JOIN release_artist ra_main ON r.id = ra_main.release_id AND ra_main.position = 1
    LEFT JOIN artist main_artist ON ra_main.artist_id = main_artist.id
    LEFT JOIN release_track_artist rta ON rt.id = rta.track_id
    LEFT JOIN artist a ON rta.artist_id = a.id
WHERE
    r.id = :release_id
GROUP BY
    r.title,
    main_artist.name,
    ra_main.artist_name,
    rt.id,
    rt.position,
    rt.title,
    rt.duration,
    rt.sequence
ORDER BY
    rt.sequence,
    rt.position;
*/

-- Get release header information
/*
SELECT
    r.id,
    r.title as album_title,
    r.released,
    r.country,
    l.name as label,
    rl.catno as catalog_number,
    STRING_AGG(DISTINCT COALESCE(a.name, ra.artist_name), ', ') as artists,
    STRING_AGG(DISTINCT rf.name, ', ') as formats,
    COUNT(DISTINCT rt.id) as total_tracks
FROM
    release r
    LEFT JOIN release_label rl ON r.id = rl.release_id
    LEFT JOIN label l ON rl.label_id = l.id
    LEFT JOIN release_artist ra ON r.id = ra.release_id
    LEFT JOIN artist a ON ra.artist_id = a.id
    LEFT JOIN release_format rf ON r.id = rf.release_id
    LEFT JOIN release_track rt ON r.id = rt.release_id
WHERE
    r.id = :release_id
GROUP BY
    r.id,
    r.title,
    r.released,
    r.country,
    l.name,
    rl.catno;
*/

-- Get all credits grouped by role
/*
SELECT
    rta.role,
    STRING_AGG(DISTINCT COALESCE(a.name, rta.artist_name), ', ' ORDER BY COALESCE(a.name, rta.artist_name)) as artists,
    COUNT(*) as credit_count
FROM
    release_track rt
    INNER JOIN release_track_artist rta ON rt.id = rta.track_id
    LEFT JOIN artist a ON rta.artist_id = a.id
WHERE
    rt.release_id = :release_id
    AND rta.role IS NOT NULL
    AND rta.role != ''
GROUP BY
    rta.role
ORDER BY
    credit_count DESC,
    rta.role;
*/

-- Example output for "A Love Supreme":
--
-- position |     track_title      | duration | performers    |     writers     | producers | other_credits
-- ---------+----------------------+----------+---------------+-----------------+-----------+---------------
-- A1       | Acknowledgement      | 7:42     | John Coltrane | John Coltrane   | Bob Thiele| Bass: Jimmy Garrison, Drums: Elvin Jones
-- A2       | Resolution           | 7:20     | John Coltrane | John Coltrane   | Bob Thiele| Bass: Jimmy Garrison, Drums: Elvin Jones
-- B1       | Pursuance            | 10:42    | John Coltrane | John Coltrane   | Bob Thiele| Bass: Jimmy Garrison, Drums: Elvin Jones
-- B2       | Psalm                | 7:05     | John Coltrane | John Coltrane   | Bob Thiele| Bass: Jimmy Garrison, Drums: Elvin Jones
