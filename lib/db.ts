if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not defined. Please add it to your .env.local file.'
  );
}

// Auto-detect which PostgreSQL driver to use:
// - Neon cloud: Use @neondatabase/serverless (HTTP-based, edge-compatible)
// - Local/other: Use pg (node-postgres, standard TCP connection)
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech');

let sql: any;

if (isNeonDatabase) {
  // Neon cloud database - use serverless driver
  const { neon } = await import('@neondatabase/serverless');
  sql = neon(process.env.DATABASE_URL);
} else {
  // Local or standard PostgreSQL - use node-postgres
  const { default: pg } = await import('pg');
  const { Pool } = pg;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Create a sql template tag function compatible with Neon's API
  sql = async (strings: TemplateStringsArray, ...values: any[]) => {
    const client = await pool.connect();
    try {
      // Build parameterized query ($1, $2, etc.)
      const text = strings.reduce((acc, str, i) => {
        return acc + str + (i < values.length ? `$${i + 1}` : '');
      }, '');

      const result = await client.query(text, values);
      return result.rows;
    } finally {
      client.release();
    }
  };
}

export { sql };

/**
 * Database connection module with auto-detection
 *
 * Automatically chooses the correct PostgreSQL driver:
 * - **Neon cloud** (neon.tech): Uses @neondatabase/serverless (HTTP, edge-compatible)
 * - **Local PostgreSQL**: Uses pg (node-postgres, standard TCP with connection pooling)
 *
 * Both provide the same `sql` template tag API for consistency.
 *
 * Usage:
 * ```typescript
 * import { sql } from '@/lib/db';
 *
 * // Parameterized queries (safe from SQL injection):
 * const artists = await sql`
 *   SELECT * FROM artist
 *   WHERE name ILIKE ${'%Blue%'}
 * `;
 *
 * // Multiple parameters:
 * const releases = await sql`
 *   SELECT * FROM release
 *   WHERE year >= ${2020}
 *   AND country = ${'US'}
 * `;
 * ```
 *
 * Environment:
 * - DATABASE_URL with 'neon.tech' → Neon serverless driver
 * - DATABASE_URL with 'localhost' or other → node-postgres with connection pool
 */
