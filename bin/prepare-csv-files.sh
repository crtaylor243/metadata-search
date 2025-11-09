#!/bin/bash
# Prepare CSV files for import by fixing data quality issues
# Run from: /Users/ryantaylor/workspace/metadata-search/bin
#
# This script must be run BEFORE bin/import-discogs.sh
#
# What it does:
# 1. Truncates excessively long track titles that exceed PostgreSQL index limits
#
# Estimated runtime: 5-10 minutes

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

if [ ! -d "data/2025_11" ]; then
    error "CSV directory not found: data/2025_11"
    exit 1
fi

info "═══════════════════════════════════════════════════════"
info "Preparing CSV files for database import"
info "═══════════════════════════════════════════════════════"
echo ""

# Step 1: Truncate long track titles
step "1/1: Truncating long track titles in release_track.csv..."
info "PostgreSQL btree indexes are limited to 2704 bytes per entry"
info "This step truncates any track titles exceeding this limit"
echo ""

# First run in dry-run mode to show what would change
info "Running analysis (dry-run mode)..."
python3 tools/discogs-xml2db/postgresql/truncate_long_titles.py \
    data/2025_11/release_track.csv \
    --dry-run

echo ""
warn "═══════════════════════════════════════════════════════"
warn "ABOUT TO MODIFY CSV FILE"
warn "═══════════════════════════════════════════════════════"
warn "This will truncate long track titles in release_track.csv"
warn "A backup will be saved as release_track.csv.backup"
warn ""
read -p "$(echo -e ${YELLOW}Continue with truncation? [y/N]:${NC} )" -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Cancelled by user"
    exit 1
fi

echo ""
info "Truncating long titles..."
python3 tools/discogs-xml2db/postgresql/truncate_long_titles.py \
    data/2025_11/release_track.csv

echo ""
info "═══════════════════════════════════════════════════════"
info "CSV preparation complete!"
info "═══════════════════════════════════════════════════════"
echo ""
info "Next steps:"
info "  1. Run bin/import-discogs.sh to import the data"
info "  2. Backup file saved: data/2025_11/release_track.csv.backup"
echo ""
