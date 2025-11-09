#!/bin/bash
# Import Discogs data to PostgreSQL
# Run from: /Users/ryantaylor/workspace/metadata-search/bin
#
# Prerequisites:
# 1. PostgreSQL database created: CREATE DATABASE discogs;
# 2. User created: CREATE USER metadata_user WITH PASSWORD 'your_password';
# 3. Grant permissions: GRANT ALL PRIVILEGES ON DATABASE discogs TO metadata_user;
# 4. Configure tools/discogs-xml2db/postgresql/postgresql.conf with connection details
#
# Estimated runtime: 6-11 hours for full dataset (745M rows)

set -e  # Exit on any error
set -u  # Exit on undefined variable

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the repository root (parent of bin/)
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to repository root
cd "$REPO_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check we're in the right directory
if [ ! -d "tools/discogs-xml2db" ]; then
    error "Repository structure error: tools/discogs-xml2db not found"
    error "Expected to run from: $REPO_ROOT/bin/"
    exit 1
fi

if [ ! -d "data/2025_11" ]; then
    error "CSV directory not found: data/2025_11"
    exit 1
fi

# Check config file exists
if [ ! -f "tools/discogs-xml2db/postgresql/postgresql.conf" ]; then
    error "Configuration file not found: tools/discogs-xml2db/postgresql/postgresql.conf"
    error "Please create it with your database connection details"
    exit 1
fi

info "Starting Discogs database import..."
info "This will take approximately 6-11 hours"
echo ""

# Step 0: Truncate existing data (if tables exist)
info "Step 0/7: Checking for existing data..."
if python3 -c "
from tools.discogs-xml2db.postgresql.dbconfig import connect_db, Config
try:
    config = Config('tools/discogs-xml2db/postgresql/postgresql.conf')
    db = connect_db(config)
    cursor = db.cursor()
    cursor.execute(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'release')\")
    exists = cursor.fetchone()[0]
    cursor.close()
    db.close()
    exit(0 if exists else 1)
except:
    exit(1)
" 2>/dev/null; then
    warn "═══════════════════════════════════════════════════════"
    warn "EXISTING TABLES FOUND!"
    warn "═══════════════════════════════════════════════════════"
    warn "To prevent duplicate data, all tables will be truncated."
    warn "This will DELETE all existing data in the database!"
    warn ""
    read -p "$(echo -e ${YELLOW}Continue with truncation? [y/N]:${NC} )" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Truncating all tables..."
        python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/TruncateAllTables.sql
        info "✓ All tables truncated - ready for fresh import"
    else
        error "Import cancelled by user"
        exit 1
    fi
else
    info "No existing tables found - will create fresh database"
fi
echo ""

# Step 1: Create tables (or skip if already exist)
info "Step 1/7: Creating database tables..."
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateTables.sql 2>/dev/null || info "(Tables already exist)"
info "✓ Tables ready"

# Step 1.5: Fix NULL constraints
info "Step 1.5/7: Fixing NOT NULL constraints for artist_id and company_id..."
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/FixNullConstraints.sql
info "✓ Constraints fixed (allowing NULL for unlinked artists/companies)"

# Step 1.75: Create import progress tracking table
info "Step 1.75/7: Setting up import progress tracking..."
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateImportProgressTable.sql 2>/dev/null || info "(Table already exists)"
info "✓ Import progress tracking ready"

# Step 2: Import CSV files (with resumable import)
info "Step 2/7: Importing CSV files (this will take 3-6 hours)..."
info "Importing 27 CSV files with 745M total rows..."
info "Using resumable importer - will automatically resume if interrupted"

# Count total files for progress
TOTAL_FILES=$(ls data/2025_11/*.csv 2>/dev/null | wc -l | tr -d ' ')
info "Found $TOTAL_FILES CSV files to import"
echo ""

# Use resumable importer instead of regular importcsv.py
python3 tools/discogs-xml2db/postgresql/importcsv_resumable.py data/2025_11/*.csv

info "✓ CSV import complete"

# Step 3: Create primary keys
info "Step 3/7: Creating primary keys (30-90 minutes)..."
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreatePrimaryKeys.sql
info "✓ Primary keys created"

# Step 4: Create foreign key constraints
info "Step 4/7: Creating foreign key constraints (10-30 minutes)..."
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateFKConstraints.sql
info "✓ Foreign key constraints created"

# Step 5: Create indexes
info "Step 5/7: Creating indexes (this will take 2-4 hours)..."
warn "Index creation is the longest step - be patient!"
python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateIndexes.sql
info "✓ Indexes created"

# Step 6: Verify import
info "Step 6/7: Verifying import..."

# Run verification queries
python3 -c "
from tools.discogs-xml2db.postgresql.dbconfig import connect_db, Config
import os

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
print(f'{'Table':<30} {'Rows':>15} {'Size':>10}')
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
        'release_company',
        COUNT(*) FILTER (WHERE company_id IS NULL),
        COUNT(*),
        ROUND(100.0 * COUNT(*) FILTER (WHERE company_id IS NULL) / COUNT(*), 2)
    FROM release_company;
''')

print('\n=== NULL Foreign Key Distribution ===')
print(f'{'Table':<20} {'NULL Count':>15} {'Total':>15} {'NULL %':>10}')
print('-' * 65)
for row in cursor.fetchall():
    table, null_count, total, pct = row
    print(f'{table:<20} {null_count:>15,} {total:>15,} {pct:>9.2f}%')

cursor.close()
db.close()
"

info "✓ Verification complete"

info "═══════════════════════════════════════════════════════"
info "Import completed successfully!"
info "═══════════════════════════════════════════════════════"
info ""
info "Database: discogs"
info "User: metadata_user"
info "Host: localhost"
info ""
info "Key statistics:"
info "  - NULL artist_id expected: ~1,860,013 records across 3 tables"
info "  - NULL company_id expected: ~2,705 records"
info "  - NULL label_id expected: ~3,416 records"
info ""
info "Next steps:"
info "  1. Run bin/optimize-database.sh to add search optimizations (30-60 min)"
info "  2. Query the database to verify data integrity"
info "  3. See .claude/docs/ for query examples"
info "  4. Remember to use LEFT JOIN when querying artist/label relationships"
info ""
info "Note: If import was interrupted, simply re-run bin/import-discogs.sh"
info "      The resumable importer will automatically continue from where it stopped"
