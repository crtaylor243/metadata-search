import { NextResponse } from 'next/server';
import { checkDatabaseHealth, getDatabaseStats } from '@/lib/db-health';

/**
 * GET /api/db/health
 *
 * Database health check endpoint
 * Tests connection and returns basic stats
 */
export async function GET() {
  try {
    const health = await checkDatabaseHealth();

    if (!health.connected) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection failed',
          error: health.error,
        },
        { status: 503 }
      );
    }

    // Get additional stats if connection is healthy
    const stats = await getDatabaseStats();

    return NextResponse.json({
      status: 'ok',
      message: 'Database is healthy',
      health,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}