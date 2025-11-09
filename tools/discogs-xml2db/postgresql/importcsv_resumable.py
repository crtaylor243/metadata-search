#!/usr/bin/env python3
"""
Resumable CSV importer for Discogs database.

This script provides idempotent CSV imports with automatic resume capability.
If an import fails due to network issues, re-running the script will:
- Skip tables that were successfully imported
- Retry failed tables
- Track progress in the import_progress table

Features:
- Automatic retry with exponential backoff
- Network failure detection and recovery
- Progress tracking across runs
- Row count verification
- Detailed logging

Usage:
    python3 importcsv_resumable.py file1.csv file2.csv ...
    python3 importcsv_resumable.py --force file1.csv  # Ignore progress, start fresh
"""

import bz2
import sys
import os
import pathlib
import time
import subprocess
from datetime import datetime
from psycopg2 import sql, OperationalError, DatabaseError

from dbconfig import connect_db, Config

# Add parent path for imports
parent_path = str(pathlib.Path(__file__).absolute().parent.parent)
sys.path.insert(1, parent_path)
from discogsxml2db.exporter import csv_headers  # noqa


# Configuration
MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 30]  # seconds between retries
CONNECTION_TIMEOUT = 30  # seconds


def count_csv_rows(filename):
    """
    Count rows in CSV file (excluding header and blank lines).

    Args:
        filename: Path to CSV file

    Returns:
        Number of data rows (excluding header line)
    """
    try:
        if filename.endswith('.bz2'):
            # Use bzcat + grep for compressed files (count non-empty lines)
            result = subprocess.run(
                "bzcat '{}' | grep -c '^.'".format(filename),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True
            )
            line_count = int(result.stdout.strip())
        else:
            # Count non-empty lines only
            result = subprocess.run(
                "grep -c '^.' '{}'".format(filename),
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True
            )
            line_count = int(result.stdout.strip())

        # Subtract 1 for header row
        return max(0, line_count - 1)
    except subprocess.CalledProcessError:
        # grep returns exit code 1 if no matches, which is fine for empty files
        return 0
    except Exception as e:
        print(f"  Note: Could not count rows accurately ({e})")
        return None


def get_table_row_count(db, table_name):
    """
    Get current row count for a table.

    Args:
        db: Database connection
        table_name: Name of table to count

    Returns:
        Number of rows, or 0 if table doesn't exist
    """
    try:
        cursor = db.cursor()
        cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(
            sql.Identifier(table_name)
        ))
        count = cursor.fetchone()[0]
        cursor.close()
        return count
    except Exception:
        return 0


def get_import_status(db, table_name):
    """
    Get import status for a table from progress tracking.

    Args:
        db: Database connection
        table_name: Table to check

    Returns:
        Dictionary with status info, or None if not found
    """
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT table_name, csv_file, expected_rows, imported_rows,
                   status, started_at, completed_at, error_message, attempt_count
            FROM import_progress
            WHERE table_name = %s
        """, (table_name,))

        row = cursor.fetchone()
        cursor.close()

        if row:
            return {
                'table_name': row[0],
                'csv_file': row[1],
                'expected_rows': row[2],
                'imported_rows': row[3],
                'status': row[4],
                'started_at': row[5],
                'completed_at': row[6],
                'error_message': row[7],
                'attempt_count': row[8]
            }
        return None
    except Exception:
        return None


def update_import_status(db, table_name, status, **kwargs):
    """
    Update import status in progress table.

    Args:
        db: Database connection
        table_name: Table being imported
        status: One of 'pending', 'in_progress', 'completed', 'failed'
        **kwargs: Additional fields to update (csv_file, expected_rows, etc.)
    """
    try:
        cursor = db.cursor()

        # Build UPDATE statement dynamically
        update_fields = []
        update_values = []

        update_fields.append('status = %s')
        update_values.append(status)

        if 'csv_file' in kwargs:
            update_fields.append('csv_file = %s')
            update_values.append(kwargs['csv_file'])

        if 'expected_rows' in kwargs:
            update_fields.append('expected_rows = %s')
            update_values.append(kwargs['expected_rows'])

        if 'imported_rows' in kwargs:
            update_fields.append('imported_rows = %s')
            update_values.append(kwargs['imported_rows'])

        if 'error_message' in kwargs:
            update_fields.append('error_message = %s')
            update_values.append(kwargs['error_message'])

        if status == 'in_progress':
            update_fields.append('started_at = %s')
            update_values.append(datetime.now())
            update_fields.append('attempt_count = import_progress.attempt_count + 1')

        if status == 'completed':
            update_fields.append('completed_at = %s')
            update_values.append(datetime.now())

        # Prepare final values tuple for the entire query
        # INSERT values: table_name, status, csv_file, expected_rows
        # UPDATE values: all the update_values we built above
        insert_values = (
            table_name,
            status,
            kwargs.get('csv_file', ''),
            kwargs.get('expected_rows', 0)
        )

        all_values = insert_values + tuple(update_values)

        # UPSERT using ON CONFLICT
        query = f"""
            INSERT INTO import_progress (table_name, status, csv_file, expected_rows)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (table_name) DO UPDATE SET
                {', '.join(update_fields)}
        """

        cursor.execute(query, all_values)
        db.commit()
        cursor.close()
    except Exception as e:
        # Rollback failed transaction
        db.rollback()
        print(f"Warning: Could not update import progress: {e}")
        # Don't raise - progress tracking is secondary to actual import


def test_connection(db):
    """
    Test if database connection is alive.

    Args:
        db: Database connection

    Returns:
        True if connection is healthy, False otherwise
    """
    try:
        cursor = db.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        return True
    except Exception:
        return False


def load_csv_with_retry(filename, db, config, force=False):
    """
    Load CSV with automatic retry on network failures.

    Args:
        filename: Path to CSV file
        db: Database connection
        config: Database config for reconnection
        force: If True, ignore progress and re-import

    Returns:
        True if successful, False if failed after all retries
    """
    base, fname = os.path.split(filename)
    table, ext = fname.split('.', 1)

    print(f"\n{'='*60}")
    print(f"Processing: {fname}")
    print(f"Table: {table}")

    # Check if already imported (unless force mode)
    if not force:
        status = get_import_status(db, table)
        if status and status['status'] == 'completed':
            actual_rows = get_table_row_count(db, table)
            print(f"✓ Already imported: {actual_rows:,} rows")
            print(f"  Completed at: {status['completed_at']}")
            print(f"  Skipping...")
            return True

        if status and status['status'] in ['in_progress', 'failed']:
            print(f"ℹ Previous attempt: {status['status']}")
            if status['error_message']:
                print(f"  Error: {status['error_message']}")
            print(f"  Attempt #{status['attempt_count'] + 1}")

    # Count expected rows
    print("Counting CSV rows...")
    expected_rows = count_csv_rows(filename)
    if expected_rows is not None:
        print(f"Expected rows: {expected_rows:,}")

    # Prepare COPY statement
    if not ext.startswith('csv'):
        print(f"✗ Unsupported file extension: {ext}")
        return False

    copy_sql = sql.SQL("COPY {} ({}) FROM STDIN WITH (FORMAT CSV, HEADER, NULL '\\N')").format(
        sql.Identifier(table),
        sql.SQL(', ').join(map(sql.Identifier, csv_headers[table]))
    )

    # Attempt import with retries
    for attempt in range(MAX_RETRIES):
        try:
            # Test connection health
            if not test_connection(db):
                print(f"⚠ Connection lost, reconnecting...")
                db = connect_db(config)

            # Mark as in progress
            update_import_status(
                db, table, 'in_progress',
                csv_file=filename,
                expected_rows=expected_rows
            )

            # Open CSV file
            if ext == 'csv':
                fp = open(filename, encoding='utf-8')
            elif ext == 'csv.bz2':
                fp = bz2.BZ2File(filename)
            else:
                print(f"✗ Unsupported extension: {ext}")
                return False

            # Perform COPY
            print(f"Importing data (attempt {attempt + 1}/{MAX_RETRIES})...")
            cursor = db.cursor()
            start_time = time.time()

            cursor.copy_expert(copy_sql, fp)
            db.commit()

            elapsed = time.time() - start_time
            cursor.close()
            fp.close()

            # Verify row count
            actual_rows = get_table_row_count(db, table)
            print(f"✓ Import completed in {elapsed:.1f}s")
            print(f"  Imported rows: {actual_rows:,}")

            if expected_rows and actual_rows != expected_rows:
                diff = abs(expected_rows - actual_rows)
                diff_pct = (diff / expected_rows) * 100 if expected_rows > 0 else 0
                # Only warn if difference is significant (> 0.1%)
                if diff_pct > 0.1:
                    print(f"  ⚠ Row count mismatch: expected {expected_rows:,}, imported {actual_rows:,}")
                    print(f"    Difference: {diff:,} rows ({diff_pct:.1f}%)")
                    if diff_pct > 5:
                        print(f"    Likely cause: Malformed CSV rows (unescaped quotes, missing columns, etc.)")
                        print(f"    Note: PostgreSQL COPY silently skips invalid rows")

            # Mark as completed
            update_import_status(
                db, table, 'completed',
                imported_rows=actual_rows
            )

            return True

        except (OperationalError, DatabaseError) as e:
            error_msg = str(e)
            print(f"✗ Database error: {error_msg}")

            # Rollback failed transaction
            try:
                db.rollback()
            except Exception:
                pass  # Connection may be dead

            # Check if it's a network/connection error
            is_network_error = any(phrase in error_msg.lower() for phrase in [
                'server closed',
                'connection',
                'timeout',
                'network',
                'invalid socket'
            ])

            if is_network_error and attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                print(f"⚠ Network error detected, retrying in {delay}s...")

                # Mark as failed with error
                update_import_status(
                    db, table, 'failed',
                    error_message=error_msg[:500]  # Truncate long errors
                )

                time.sleep(delay)

                # Reconnect
                try:
                    db = connect_db(config)
                    print("✓ Reconnected to database")
                except Exception as reconnect_error:
                    print(f"✗ Reconnection failed: {reconnect_error}")
                    continue
            else:
                # Non-network error or final retry
                print(f"✗ Import failed after {attempt + 1} attempts")
                update_import_status(
                    db, table, 'failed',
                    error_message=error_msg[:500]
                )
                return False

        except Exception as e:
            error_msg = str(e)
            print(f"✗ Unexpected error: {error_msg}")

            # Rollback failed transaction
            try:
                db.rollback()
            except Exception:
                pass  # Connection may be dead

            update_import_status(
                db, table, 'failed',
                error_message=error_msg[:500]
            )
            return False

    print(f"✗ Import failed after {MAX_RETRIES} attempts")
    return False


def main():
    """Main entry point."""
    # Parse arguments
    force_mode = '--force' in sys.argv
    filenames = [arg for arg in sys.argv[1:] if not arg.startswith('--')]

    if not filenames:
        print("Usage: importcsv_resumable.py [--force] file1.csv file2.csv ...")
        sys.exit(1)

    print("═" * 60)
    print("RESUMABLE CSV IMPORTER")
    print("═" * 60)
    if force_mode:
        print("⚠ Force mode: Ignoring previous progress")
    print(f"Files to import: {len(filenames)}")
    print("")

    # Connect to database
    root = os.path.realpath(os.path.dirname(__file__))
    config = Config(os.path.join(root, 'postgresql.conf'))

    print("Connecting to database...")
    db = connect_db(config)
    print("✓ Connected")

    # Ensure import_progress table exists
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'import_progress'
            )
        """)
        table_exists = cursor.fetchone()[0]
        cursor.close()

        if not table_exists:
            print("\n⚠ import_progress table not found")
            print("Run: python3 psql.py < sql/CreateImportProgressTable.sql")
            sys.exit(1)
    except Exception as e:
        print(f"✗ Error checking for import_progress table: {e}")
        sys.exit(1)

    # Import each file
    successful = 0
    failed = 0
    skipped = 0

    for filename in filenames:
        abs_path = os.path.abspath(filename)

        if not os.path.exists(abs_path):
            print(f"\n✗ File not found: {filename}")
            failed += 1
            continue

        result = load_csv_with_retry(abs_path, db, config, force=force_mode)

        if result:
            successful += 1
        else:
            failed += 1

    db.close()

    # Summary
    print("\n" + "═" * 60)
    print("IMPORT SUMMARY")
    print("═" * 60)
    print(f"Total files: {len(filenames)}")
    print(f"✓ Successful: {successful}")
    print(f"✗ Failed: {failed}")

    if failed > 0:
        print("\n⚠ Some imports failed. Re-run this script to retry.")
        sys.exit(1)
    else:
        print("\n✓ All imports completed successfully!")
        sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
        print("Progress has been saved. Re-run to continue.")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
