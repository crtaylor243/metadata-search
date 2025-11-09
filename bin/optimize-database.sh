#!/bin/bash
# Optimize Discogs database for application queries
# Run from: /Users/ryantaylor/workspace/metadata-search/bin
#
# Prerequisites:
# 1. Complete database import via bin/import-discogs.sh
# 2. PostgreSQL connection configured in tools/discogs-xml2db/postgresql/postgresql.conf
#
# What this script does:
# 1. Adds shadow_catno column for optimized catalog number sorting
# 2. Populates shadow catalog numbers for ~49M releases
# 3. Installs pg_trgm extension for fuzzy text search
# 4. Creates optimized indexes for search, filtering, and sorting
# 5. Creates materialized views for pre-computed aggregations
# 6. Updates table statistics for query planner optimization
#
# Estimated runtime: 30-60 minutes
#
# Safe to run multiple times (idempotent)

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
BLUE='\033[0;34m'
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

step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check we're in the right directory
if [ ! -d "tools/discogs-xml2db" ]; then
    error "Repository structure error: tools/discogs-xml2db not found"
    error "Expected to run from: $REPO_ROOT/bin/"
    exit 1
fi

# Check config file exists
if [ ! -f "tools/discogs-xml2db/postgresql/postgresql.conf" ]; then
    error "Configuration file not found: tools/discogs-xml2db/postgresql/postgresql.conf"
    error "Please create it with your database connection details"
    exit 1
fi

# # Check that database has been imported
# info "Checking database connection and import status..."
# if ! python3 -c "
# from tools.discogs-xml2db.postgresql.dbconfig import connect_db, Config
# try:
#     config = Config('tools/discogs-xml2db/postgresql/postgresql.conf')
#     db = connect_db(config)
#     cursor = db.cursor()
#     cursor.execute(\"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'release')\")
#     exists = cursor.fetchone()[0]
#     cursor.close()
#     db.close()
#     exit(0 if exists else 1)
# except Exception as e:
#     print(f'Connection error: {e}')
#     exit(1)
# " 2>/dev/null; then
#     error "Database not initialized. Please run ./import-discogs.sh first"
#     exit 1
# fi

info "═══════════════════════════════════════════════════════"
info "Optimizing Discogs database for application queries"
info "═══════════════════════════════════════════════════════"
echo ""
info "This will:"
info "  • Add shadow catalog number column and populate it"
info "  • Install PostgreSQL extensions (pg_trgm)"
info "  • Create 10+ optimized indexes"
info "  • Create materialized views"
info "  • Update table statistics"
echo ""
info "Estimated time: 30-60 minutes"
info "Database operations will not block reads"
echo ""

# # Step 1: Add shadow_catno column
# step "1/6: Adding shadow catalog number column..."
# python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/AddShadowCatno.sql
# info "✓ Column added"
# echo ""

# Step 2: Populate shadow catalog numbers
step "2/6: Calculating shadow catalog numbers (15-20 minutes)..."
info "This normalizes catalog numbers for consistent sorting"
info "Processing ~49M releases in batches..."
echo ""

# # Optional: Run test first
# # info "Running algorithm tests..."
# # python3 tools/discogs-xml2db/postgresql/populate_shadow_catno.py --test
# # echo ""

info "Starting population..."
python3 tools/discogs-xml2db/postgresql/populate_shadow_catno.py
echo ""
info "✓ Shadow catalog numbers populated"
echo ""

# Step 3: Install PostgreSQL extensions
# step "3/6: Installing PostgreSQL extensions..."
# python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/InstallExtensions.sql
# info "✓ Extensions installed (pg_trgm for fuzzy search)"
# echo ""

# # Step 4: Create optimized indexes
# step "4/6: Creating optimized indexes (20-30 minutes)..."
# info "This is the longest step - indexes dramatically improve query performance"
# info "Creating indexes for:"
# info "  • Fuzzy text search (label/artist names)"
# info "  • Release sorting (shadow catalog numbers)"
# info "  • Track and credit lookups"
# echo ""
# python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateSearchIndexes.sql
# info "✓ Indexes created"
# echo ""

# Step 5: Create materialized views
# step "5/6: Creating materialized views (5-10 minutes)..."
# info "Pre-computing format variant aggregations..."
# echo ""
# python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/CreateMaterializedViews.sql
# info "✓ Materialized views created"
# echo ""

# Step 6: Update table statistics
# step "6/6: Updating query planner statistics (2-5 minutes)..."
# info "Analyzing tables for query optimization..."
# echo ""
# python3 tools/discogs-xml2db/postgresql/psql.py < data/queries/AnalyzeTables.sql
# info "✓ Statistics updated"
# echo ""

# Verification
# info "Running verification checks..."
# python3 -c "
# from tools.discogs-xml2db.postgresql.dbconfig import connect_db, Config

# config = Config('tools/discogs-xml2db/postgresql/postgresql.conf')
# db = connect_db(config)
# cursor = db.cursor()

# # Check shadow_catno population
# cursor.execute('SELECT COUNT(*) FROM release WHERE shadow_catno IS NOT NULL')
# shadow_count = cursor.fetchone()[0]

# # Check indexes
# cursor.execute(\"SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'\")
# index_count = cursor.fetchone()[0]

# # Check materialized view
# cursor.execute('SELECT COUNT(*) FROM mv_format_variants')
# mv_count = cursor.fetchone()[0]

# print(f'✓ Shadow catalog numbers: {shadow_count:,} releases')
# print(f'✓ Application indexes: {index_count} total')
# print(f'✓ Format variants view: {mv_count:,} unique catalogs')

# cursor.close()
# db.close()
# "

# echo ""
# info "═══════════════════════════════════════════════════════"
# info "Database optimization complete!"
# info "═══════════════════════════════════════════════════════"
# echo ""
# info "Optimizations applied:"
# info "  ✓ Shadow catalog numbers for consistent sorting"
# info "  ✓ Fuzzy search indexes (10-50x faster label/artist search)"
# info "  ✓ Release filtering indexes (fast lookups by label/artist)"
# info "  ✓ Track and credit indexes (efficient joins)"
# info "  ✓ Format variant materialized view (pre-aggregated)"
# echo ""
# info "Performance improvements:"
# info "  • Label search: ~10-50x faster"
# info "  • Release sorting: ~20-100x faster"
# info "  • Track queries: ~5-10x faster"
# echo ""
# info "Next steps:"
# info "  1. Database is now optimized for application queries"
# info "  2. To refresh materialized view after updates:"
# info "     REFRESH MATERIALIZED VIEW mv_format_variants;"
# info "  3. Ready to implement database API routes in Next.js app"
# echo ""
