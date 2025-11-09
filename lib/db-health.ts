import { sql } from '@/lib/db';

/**
 * Database health check - verifies connection and schema
 *
 * This performs a simple query to:
 * 1. Test database connectivity
 * 2. Verify the release table exists
 * 3. Get a sample count of records
 *
 * Call this on app startup to fail fast if DB is misconfigured
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  schemaExists: boolean;
  releaseCount: number;
  error?: string;
}> {
  try {
    // Simple query to test connection and schema
    const result = await sql`
      SELECT COUNT(*) as count
      FROM release
      LIMIT 1
    `;

    const count = parseInt(result[0]?.count || '0', 10);

    console.log('✅ Database health check passed');
    console.log(`   - Connected: true`);
    console.log(`   - Schema exists: true`);
    console.log(`   - Release count: ${count.toLocaleString()}`);

    return {
      connected: true,
      schemaExists: true,
      releaseCount: count,
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error);

    return {
      connected: false,
      schemaExists: false,
      releaseCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get database statistics for debugging
 */
export async function getDatabaseStats() {
  try {
    const stats = await sql`
      SELECT
        (SELECT COUNT(*) FROM artist) as artist_count,
        (SELECT COUNT(*) FROM label) as label_count,
        (SELECT COUNT(*) FROM release) as release_count,
        (SELECT COUNT(*) FROM release_track) as track_count
    `;

    const result = {
      artists: parseInt(stats[0]?.artist_count || '0', 10),
      labels: parseInt(stats[0]?.label_count || '0', 10),
      releases: parseInt(stats[0]?.release_count || '0', 10),
      tracks: parseInt(stats[0]?.track_count || '0', 10),
    };

    console.log('📊 Database statistics:');
    console.log(`   - Artists: ${result.artists.toLocaleString()}`);
    console.log(`   - Labels: ${result.labels.toLocaleString()}`);
    console.log(`   - Releases: ${result.releases.toLocaleString()}`);
    console.log(`   - Tracks: ${result.tracks.toLocaleString()}`);

    return result;
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      artists: 0,
      labels: 0,
      releases: 0,
      tracks: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}