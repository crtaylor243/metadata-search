-- Clean up orphaned records that prevent foreign key creation
-- Run this BEFORE CreateFKConstraints.sql

-- 1. Remove labels with non-existent parent labels
DELETE FROM label
WHERE parent_id IS NOT NULL
  AND parent_id NOT IN (SELECT id FROM label);

-- 2. Remove release_artist records with non-existent artists
DELETE FROM release_artist
WHERE artist_id IS NOT NULL
  AND artist_id NOT IN (SELECT id FROM artist);

-- 3. Remove release_label records with non-existent labels
DELETE FROM release_label
WHERE label_id IS NOT NULL
  AND label_id NOT IN (SELECT id FROM label);

-- 4. Remove release_track_artist records with non-existent artists
DELETE FROM release_track_artist
WHERE artist_id IS NOT NULL
  AND artist_id NOT IN (SELECT id FROM artist);

-- 5. Remove release_company records with non-existent companies (labels)
DELETE FROM release_company
WHERE company_id IS NOT NULL
  AND company_id NOT IN (SELECT id FROM label);

-- Show summary of deletions
SELECT
    'Orphaned records cleaned' as status,
    'Foreign keys can now be created' as next_step;
