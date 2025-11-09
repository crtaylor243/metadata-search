-- Label Search Query
-- Find labels by name using partial text matching (case-insensitive)
--
-- Usage:
--   Replace 'blue note' with your search term
--   Supports partial matches: 'blue' will find 'Blue Note', 'Blue Thumb', etc.
--
-- Returns:
--   - Label ID (for use in other queries)
--   - Label name
--   - Parent label name (if exists)
--   - Contact info (if available)
--   - Profile description
--   - Data quality rating
--   - Number of releases on this label

-- Example search term (replace this value)
\set search_term 'blue note'

-- Main query
SELECT
    l.id,
    l.name,
    parent.name as parent_label,
    l.contactinfo,
    l.profile,
    l.data_quality,
    COUNT(rl.release_id) as release_count
FROM
    label l
    LEFT JOIN label parent ON l.parent_id = parent.id
    LEFT JOIN release_label rl ON l.id = rl.label_id
WHERE
    -- Case-insensitive partial match on label name
    l.name ILIKE '%' || :'search_term' || '%'
GROUP BY
    l.id,
    l.name,
    parent.name,
    l.contactinfo,
    l.profile,
    l.data_quality
ORDER BY
    -- Prioritize exact matches first, then by release count
    CASE WHEN LOWER(l.name) = LOWER(:'search_term') THEN 0 ELSE 1 END,
    release_count DESC,
    l.name
LIMIT 50;

-- Alternative: Search by profile text as well
-- Uncomment to enable profile searching
/*
SELECT
    l.id,
    l.name,
    parent.name as parent_label,
    l.profile,
    COUNT(rl.release_id) as release_count,
    -- Show which field matched
    CASE
        WHEN l.name ILIKE '%' || :'search_term' || '%' THEN 'name'
        WHEN l.profile ILIKE '%' || :'search_term' || '%' THEN 'profile'
    END as matched_field
FROM
    label l
    LEFT JOIN label parent ON l.parent_id = parent.id
    LEFT JOIN release_label rl ON l.id = rl.label_id
WHERE
    l.name ILIKE '%' || :'search_term' || '%'
    OR l.profile ILIKE '%' || :'search_term' || '%'
GROUP BY
    l.id,
    l.name,
    parent.name,
    l.profile
ORDER BY
    matched_field,
    release_count DESC
LIMIT 50;
*/

-- Example results for 'blue note':
--
--  id   |       name        | parent_label | contactinfo | profile | data_quality | release_count
-- ------+-------------------+--------------+-------------+---------+--------------+---------------
--  1234 | Blue Note         | NULL         | ...         | ...     | Correct      | 15,234
--  5678 | Blue Note Records | Blue Note    | ...         | ...     | Correct      | 8,421
--  9012 | Blue Thumb        | NULL         | ...         | ...     | Correct      | 1,523
