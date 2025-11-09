#!/usr/bin/env python3
"""
Truncate long track titles in release_track.csv to fit PostgreSQL btree index limits.

PostgreSQL btree indexes have a maximum entry size of 2704 bytes (1/3 of 8KB page).
This script truncates any track titles that exceed this limit.

Run this BEFORE importing CSV files to the database.

Usage:
    python3 truncate_long_titles.py [csv_file] [--dry-run]

Arguments:
    csv_file    Path to release_track.csv (default: data/2025_11/release_track.csv)
    --dry-run   Show what would be changed without modifying the file
"""

import csv
import sys
import os
from pathlib import Path

# Maximum bytes for PostgreSQL btree index (1/3 of 8KB page size)
MAX_TITLE_BYTES = 2704

# Safe truncation limit (leave some room for multi-byte UTF-8 chars)
SAFE_LIMIT_BYTES = 2600


def truncate_title(title: str) -> str:
    """
    Truncate a title to fit within the byte limit while preserving UTF-8 validity.

    Strategy:
    1. If already under limit, return as-is
    2. Otherwise, truncate character-by-character until under limit
    3. Add ellipsis (...) to indicate truncation
    """
    if len(title.encode('utf-8')) <= SAFE_LIMIT_BYTES:
        return title

    # Binary search for safe truncation point
    left, right = 0, len(title)
    result = title

    while left < right:
        mid = (left + right + 1) // 2
        truncated = title[:mid] + '...'
        if len(truncated.encode('utf-8')) <= SAFE_LIMIT_BYTES:
            result = truncated
            left = mid
        else:
            right = mid - 1

    return result


def process_csv(input_path: str, dry_run: bool = False):
    """
    Process release_track.csv and truncate long titles.

    Args:
        input_path: Path to input CSV file
        dry_run: If True, only report changes without modifying file
    """
    input_file = Path(input_path)

    if not input_file.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        return 1

    # Read all rows
    print(f"Reading {input_path}...")
    with open(input_file, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    print(f"Total tracks: {len(rows):,}")

    # Analyze and truncate
    over_limit = []
    truncated_count = 0
    max_bytes = 0

    for i, row in enumerate(rows):
        title = row.get('title', '')
        title_bytes = len(title.encode('utf-8'))

        if title_bytes > max_bytes:
            max_bytes = title_bytes

        if title_bytes > SAFE_LIMIT_BYTES:
            original_title = title
            truncated_title = truncate_title(title)
            row['title'] = truncated_title

            over_limit.append({
                'line': i + 2,  # +2 for 1-based + header
                'track_id': row.get('id', 'unknown'),
                'original_bytes': title_bytes,
                'truncated_bytes': len(truncated_title.encode('utf-8')),
                'original': original_title[:80] + '...' if len(original_title) > 80 else original_title,
                'truncated': truncated_title[:80] + '...' if len(truncated_title) > 80 else truncated_title,
            })
            truncated_count += 1

    # Report findings
    print(f"\n{'='*70}")
    print(f"Analysis Results:")
    print(f"{'='*70}")
    print(f"Maximum title length found: {max_bytes:,} bytes")
    print(f"Titles exceeding {SAFE_LIMIT_BYTES} bytes: {truncated_count:,}")
    print(f"Percentage of tracks affected: {100.0 * truncated_count / len(rows):.4f}%")

    if over_limit:
        print(f"\n{'='*70}")
        print(f"Sample of truncated titles (first 10):")
        print(f"{'='*70}")
        for item in over_limit[:10]:
            print(f"\nLine {item['line']}, Track ID {item['track_id']}:")
            print(f"  Original: {item['original_bytes']} bytes")
            print(f"  Truncated: {item['truncated_bytes']} bytes")
            print(f"  Before: {item['original']}")
            print(f"  After: {item['truncated']}")

    # Write output
    if dry_run:
        print(f"\n{'='*70}")
        print(f"DRY RUN - No changes written to disk")
        print(f"{'='*70}")
        return 0

    if truncated_count == 0:
        print(f"\n{'='*70}")
        print(f"No changes needed - all titles are within the limit")
        print(f"{'='*70}")
        return 0

    # Create backup
    backup_path = input_file.with_suffix('.csv.backup')
    print(f"\nCreating backup: {backup_path}")
    os.rename(input_file, backup_path)

    # Write modified CSV
    print(f"Writing truncated titles to: {input_path}")
    with open(input_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n{'='*70}")
    print(f"✓ Successfully truncated {truncated_count:,} track titles")
    print(f"✓ Original file backed up to: {backup_path}")
    print(f"✓ Modified file saved to: {input_path}")
    print(f"{'='*70}")

    return 0


def main():
    """Main entry point."""
    # Parse arguments
    dry_run = '--dry-run' in sys.argv

    # Get CSV path
    csv_path = 'data/2025_11/release_track.csv'
    for arg in sys.argv[1:]:
        if not arg.startswith('--'):
            csv_path = arg
            break

    # Show usage if --help
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return 0

    # Process CSV
    return process_csv(csv_path, dry_run)


if __name__ == '__main__':
    sys.exit(main())
