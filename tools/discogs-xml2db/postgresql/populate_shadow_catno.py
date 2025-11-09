#!/usr/bin/env python3
"""
Populate shadow_catno column in release table for optimized sorting.

This script ports the "Shadow Catalog Number" algorithm from the Next.js application
(app/api/discogs/label/[id]/releases/route.ts) to normalize catalog numbers for
consistent sorting and deduplication.

Algorithm:
1. Convert to uppercase
2. Move trailing single digit to main body (e.g., "ABC-1" → "ABC1")
3. Strip all non-alphanumeric characters
4. Separate letter/number groups with tabs
5. Zero-pad number groups to 16 digits

Examples:
  "ABC-123"   → "ABC\t0000000000000123"
  "ABC 123"   → "ABC\t0000000000000123" (same as above)
  "ABC-123A"  → "ABC\t0000000000000123\tA"
  "abc-1"     → "ABC\t0000000000000001"
  "TECH001"   → "TECH\t0000000000000001"

Runtime: 15-20 minutes for ~49M releases
"""

import sys
import re
from dbconfig import connect_db, Config

def generate_shadow_catno(catno):
    """
    Generate shadow catalog number for sorting and deduplication.

    Port of the TypeScript algorithm from:
    app/api/discogs/label/[id]/releases/route.ts:79-129
    """
    if not catno or catno.strip() == '':
        return None

    # Step 1: Convert to uppercase
    catno = catno.upper()

    # Step 2: Handle trailing single digit (e.g., "ABC-1" → "ABC1")
    # Match: any char, hyphen/space, single digit at end
    catno = re.sub(r'(.)[-\s](\d)$', r'\1\2', catno)

    # Step 3: Strip all non-alphanumeric characters
    catno = re.sub(r'[^A-Z0-9]', '', catno)

    if not catno:
        return None

    # Step 4: Separate into letter/number segments and pad numbers
    # Split into alternating letter and number groups
    segments = re.findall(r'[A-Z]+|\d+', catno)

    if not segments:
        return None

    # Step 5: Pad number groups to 16 digits, keep letter groups as-is
    padded_segments = []
    for segment in segments:
        if segment.isdigit():
            # Pad numbers to 16 digits for consistent sorting
            padded_segments.append(segment.zfill(16))
        else:
            # Keep letters as-is
            padded_segments.append(segment)

    # Join with tabs for sorting (tabs sort before letters/numbers)
    return '\t'.join(padded_segments)


def populate_shadow_catnos(batch_size=10000):
    """
    Populate shadow_catno for all releases in batches.

    Args:
        batch_size: Number of releases to process per batch (default: 10000)
    """
    print("Connecting to database...")
    config = Config('tools/discogs-xml2db/postgresql/postgresql.conf')
    db = connect_db(config)
    cursor = db.cursor()

    # Get total count for progress tracking
    print("Counting releases to process...")
    cursor.execute("""
        SELECT COUNT(*)
        FROM release_label
        WHERE catno IS NOT NULL AND catno != ''
    """)
    total_count = cursor.fetchone()[0]
    print(f"Found {total_count:,} releases with catalog numbers to process\n")

    # Process in batches
    processed = 0
    updated = 0
    skipped = 0

    print("Processing releases in batches...")
    print(f"Batch size: {batch_size:,} releases")
    print("-" * 60)

    while processed < total_count:
        # Fetch batch of releases with catalog numbers
        cursor.execute("""
            SELECT rl.release_id, rl.catno
            FROM release_label rl
            WHERE rl.catno IS NOT NULL
              AND rl.catno != ''
            ORDER BY rl.release_id
            LIMIT %s OFFSET %s
        """, (batch_size, processed))

        batch = cursor.fetchall()
        if not batch:
            break

        # Generate shadow catalog numbers for batch
        updates = []
        for release_id, catno in batch:
            shadow_catno = generate_shadow_catno(catno)
            if shadow_catno:
                updates.append((shadow_catno, release_id))

        # Bulk update using prepared statement
        if updates:
            cursor.executemany("""
                UPDATE release
                SET shadow_catno = %s
                WHERE id = %s
            """, updates)
            db.commit()
            updated += len(updates)

        skipped += len(batch) - len(updates)
        processed += len(batch)

        # Progress update
        pct = (processed / total_count) * 100
        print(f"Progress: {processed:,} / {total_count:,} ({pct:.1f}%) - "
              f"Updated: {updated:,} | Skipped: {skipped:,}")

    cursor.close()
    db.close()

    print("-" * 60)
    print(f"\n✓ Shadow catalog number population complete!")
    print(f"  Total processed: {processed:,}")
    print(f"  Successfully updated: {updated:,}")
    print(f"  Skipped (invalid/empty): {skipped:,}")


def test_algorithm():
    """Test the shadow catalog number algorithm with known examples."""
    test_cases = [
        ("ABC-123", "ABC\t0000000000000123"),
        ("ABC 123", "ABC\t0000000000000123"),
        ("ABC-123A", "ABC\t0000000000000123\tA"),
        ("abc-1", "ABC\t0000000000000001"),
        ("TECH001", "TECH\t0000000000000001"),
        ("", None),
        (None, None),
        ("XYZ-456-B", "XYZ\t0000000000000456\tB"),
        ("12345", "\t0000000000012345"),
    ]

    print("Testing shadow catalog number algorithm...")
    print("-" * 60)

    all_passed = True
    for input_val, expected in test_cases:
        result = generate_shadow_catno(input_val)
        passed = result == expected
        status = "✓" if passed else "✗"

        print(f"{status} Input: {repr(input_val):20} → {repr(result)}")
        if not passed:
            print(f"  Expected: {repr(expected)}")
            all_passed = False

    print("-" * 60)
    if all_passed:
        print("✓ All tests passed!\n")
    else:
        print("✗ Some tests failed!\n")
        sys.exit(1)


if __name__ == '__main__':
    # Check for test flag
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        test_algorithm()
    else:
        # Run population
        try:
            populate_shadow_catnos()
        except KeyboardInterrupt:
            print("\n\n⚠ Interrupted by user")
            print("Progress has been saved. Re-run to continue from last batch.")
            sys.exit(1)
        except Exception as e:
            print(f"\n✗ Error: {e}")
            sys.exit(1)
