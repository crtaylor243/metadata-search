#!/usr/bin/env python3
"""
Verify Discogs database import
Run from: /Users/ryantaylor/workspace/metadata-search/bin
"""
import sys
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
# Get the repository root (parent of bin/)
repo_root = os.path.join(script_dir, '..')

# Change to repository root
os.chdir(repo_root)

# Add tools directory to path
sys.path.insert(0, os.path.join(repo_root, 'tools', 'discogs-xml2db'))

from postgresql.dbconfig import connect_db, Config

config = Config('tools/discogs-xml2db/postgresql/postgresql.conf')
db = connect_db(config)
cursor = db.cursor()

# Get table sizes
cursor.execute('''
    SELECT
        schemaname, tablename,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC
    LIMIT 15;
''')

print('\n=== Top 15 Tables by Row Count ===')
print(f'{"Table":<30} {"Rows":>15} {"Size":>10}')
print('-' * 60)
for row in cursor.fetchall():
    schema, table, count, size = row
    print(f'{table:<30} {count:>15,} {size:>10}')

# Check for NULL artist_id distribution
cursor.execute('''
    SELECT
        'master_artist' as table_name,
        COUNT(*) FILTER (WHERE artist_id IS NULL) as null_count,
        COUNT(*) as total_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE artist_id IS NULL) / COUNT(*), 4) as null_pct
    FROM master_artist
    UNION ALL
    SELECT
        'release_artist',
        COUNT(*) FILTER (WHERE artist_id IS NULL),
        COUNT(*),
        ROUND(100.0 * COUNT(*) FILTER (WHERE artist_id IS NULL) / COUNT(*), 2)
    FROM release_artist
    UNION ALL
    SELECT
        'release_track_artist',
        COUNT(*) FILTER (WHERE artist_id IS NULL),
        COUNT(*),
        ROUND(100.0 * COUNT(*) FILTER (WHERE artist_id IS NULL) / COUNT(*), 2)
    FROM release_track_artist
    UNION ALL
    SELECT
        'release_company',
        COUNT(*) FILTER (WHERE company_id IS NULL),
        COUNT(*),
        ROUND(100.0 * COUNT(*) FILTER (WHERE company_id IS NULL) / COUNT(*), 2)
    FROM release_company;
''')

print('\n=== NULL Foreign Key Distribution ===')
print(f'{"Table":<20} {"NULL Count":>15} {"Total":>15} {"NULL %":>10}')
print('-' * 65)
for row in cursor.fetchall():
    table, null_count, total, pct = row
    print(f'{table:<20} {null_count:>15,} {total:>15,} {pct:>9.2f}%')

# Check foreign key constraints
cursor.execute('''
    SELECT
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as references_table
    FROM pg_constraint
    WHERE contype = 'f'
    ORDER BY conrelid::regclass::text;
''')

print('\n=== Foreign Key Constraints ===')
print(f'{"Constraint":<40} {"Table":<25} {"References":>20}')
print('-' * 90)
count = 0
for row in cursor.fetchall():
    constraint, table, ref_table = row
    print(f'{constraint:<40} {table:<25} {ref_table:>20}')
    count += 1

print(f'\nTotal foreign keys: {count}')
print('Expected: ~15 foreign keys')

if count < 15:
    print('\n⚠️  WARNING: Some foreign keys are missing!')
    print('This is likely due to orphaned records in the data.')
    print('See CleanOrphanedRecords.sql to fix.')
else:
    print('\n✓ All foreign keys created successfully!')

cursor.close()
db.close()
