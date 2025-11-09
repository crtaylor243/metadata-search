-- Label Releases Query
-- Get all releases for a specific label
--
-- Usage:
--   1. First run label_search.sql to find your label
--   2. Copy the label ID from the results
--   3. Replace '1234' below with your label ID
--
-- Returns:
--   - Release details (ID, title, year, country, format)
--   - Artist information
--   - Catalog number
--   - Format details (Vinyl, CD, Digital, etc.)
--   - Genres and styles

-- Example label ID (replace this value)
-- For Blue Note Records: 1234
\set label_id 1234

-- Main query: Get all releases for a label
SELECT
    r.id as release_id,
    r.title,
    r.released,
    r.country,
    r.notes,
    rl.catno as catalog_number,
    -- Get primary artist name(s)
    STRING_AGG(DISTINCT COALESCE(a.name, ra.artist_name), ', ' ORDER BY COALESCE(a.name, ra.artist_name)) as artists,
    -- Get all formats (Vinyl, CD, etc.)
    STRING_AGG(DISTINCT rf.name, ', ') as formats,
    -- Get genres
    STRING_AGG(DISTINCT rg.genre, ', ') as genres,
    -- Get styles
    STRING_AGG(DISTINCT rs.style, ', ') as styles,
    -- Number of tracks
    COUNT(DISTINCT rt.id) as track_count
FROM
    release r
    INNER JOIN release_label rl ON r.id = rl.release_id
    LEFT JOIN release_artist ra ON r.id = ra.release_id
    LEFT JOIN artist a ON ra.artist_id = a.id
    LEFT JOIN release_format rf ON r.id = rf.release_id
    LEFT JOIN release_genre rg ON r.id = rg.release_id
    LEFT JOIN release_style rs ON r.id = rs.release_id
    LEFT JOIN release_track rt ON r.id = rt.release_id
WHERE
    rl.label_id = :label_id
GROUP BY
    r.id,
    r.title,
    r.released,
    r.country,
    r.notes,
    rl.catno
ORDER BY
    r.released DESC NULLS LAST,
    r.title
LIMIT 100;

-- Alternative: Paginated results with more details
/*
SELECT
    r.id as release_id,
    r.title,
    r.released,
    r.country,
    rl.catno as catalog_number,
    l.name as label_name,
    -- Primary artist
    COALESCE(a.name, ra.artist_name) as artist,
    -- Format summary
    ARRAY_AGG(DISTINCT rf.name) as formats,
    -- Total tracks
    COUNT(DISTINCT rt.id) as tracks,
    -- Data quality
    r.data_quality
FROM
    release r
    INNER JOIN release_label rl ON r.id = rl.release_id
    INNER JOIN label l ON rl.label_id = l.id
    LEFT JOIN release_artist ra ON r.id = ra.release_id AND ra.position = 1
    LEFT JOIN artist a ON ra.artist_id = a.id
    LEFT JOIN release_format rf ON r.id = rf.release_id
    LEFT JOIN release_track rt ON r.id = rt.release_id
WHERE
    rl.label_id = :label_id
GROUP BY
    r.id,
    r.title,
    r.released,
    r.country,
    rl.catno,
    l.name,
    a.name,
    ra.artist_name,
    r.data_quality
ORDER BY
    r.released DESC NULLS LAST,
    r.title
LIMIT 100 OFFSET 0;  -- Change OFFSET for pagination
*/

-- Get release count by year
/*
SELECT
    EXTRACT(YEAR FROM r.released) as year,
    COUNT(*) as release_count,
    COUNT(DISTINCT COALESCE(a.name, ra.artist_name)) as unique_artists
FROM
    release r
    INNER JOIN release_label rl ON r.id = rl.release_id
    LEFT JOIN release_artist ra ON r.id = ra.release_id
    LEFT JOIN artist a ON ra.artist_id = a.id
WHERE
    rl.label_id = :label_id
    AND r.released IS NOT NULL
GROUP BY
    year
ORDER BY
    year DESC;
*/

-- Get most prolific artists on this label
/*
SELECT
    COALESCE(a.name, ra.artist_name) as artist_name,
    COUNT(DISTINCT r.id) as release_count,
    MIN(r.released) as first_release,
    MAX(r.released) as latest_release
FROM
    release r
    INNER JOIN release_label rl ON r.id = rl.release_id
    INNER JOIN release_artist ra ON r.id = ra.release_id
    LEFT JOIN artist a ON ra.artist_id = a.id
WHERE
    rl.label_id = :label_id
GROUP BY
    artist_name
HAVING
    COUNT(DISTINCT r.id) > 1
ORDER BY
    release_count DESC,
    artist_name
LIMIT 50;
*/

-- Example output for Blue Note Records:
--
-- release_id |           title            | released   | country | catalog_number |       artists        |     formats      |  genres  | styles | track_count
-- -----------+----------------------------+------------+---------+----------------+----------------------+------------------+----------+--------+-------------
--    1234567 | A Love Supreme              | 1965-02-00 | US      | BST 84211      | John Coltrane        | Vinyl            | Jazz     | Modal  | 4
--    1234568 | Blue Train                  | 1958-09-00 | US      | BLP 1577       | John Coltrane        | Vinyl            | Jazz     | Bop    | 5
--    1234569 | Kind of Blue (Reissue)     | 2020-01-15 | US      | B003456        | Miles Davis          | Vinyl, CD, File  | Jazz     | Modal  | 5
