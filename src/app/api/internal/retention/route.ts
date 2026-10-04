import { NextRequest, NextResponse } from 'next/server';
import { runRollingLogRetention } from '@/lib/retention';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Validates whether the incoming request is authorized to invoke or query log retention.
 * Allowed:
 * 1. Dedicated CRON_SECRET matching header (x-cron-secret or Authorization: Bearer <secret>)
 *    Fails closed if CRON_SECRET environment variable is missing.
 * 2. Authenticated SUPER_ADMIN session
 *
 * In ALL cases, the atomic 20-hour database throttle and 7-day retention period apply.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-cron-secret');

  // Scheduler authentication: requires dedicated CRON_SECRET
  if (cronSecret && cronSecret.trim().length > 0) {
    if (cronHeader && cronHeader === cronSecret) return true;
    if (authHeader && authHeader === `Bearer ${cronSecret}`) return true;
  }

  // Super Admin session authentication
  try {
    const sessionUser = await requireAuthUser();
    if (sessionUser && sessionUser.role === 'SUPER_ADMIN') {
      return true;
    }
  } catch {
    // Not an authenticated session
  }

  return false;
}

/**
 * POST /api/internal/retention
 *
 * Authoritative trigger for 7-day rolling retention.
 * - Enforces an atomic 20-hour database-backed throttle in PostgreSQL.
 * - Always enforces exactly 7 days retention.
 * - External query parameters (e.g. ?force=..., ?days=...) are completely ignored.
 * - Returns safe generic error messages on failure (never leaks DB/driver details).
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRON_SECRET or Super Admin session required.' },
        { status: 401 }
      );
    }

    // Always executes fixed 7-day retention under atomic 20-hour database throttle
    const result = await runRollingLogRetention();

    return NextResponse.json({
      success: true,
      policy: '7_DAY_ROLLING_RETENTION',
      skipped: result.skipped,
      reason: result.reason || null,
      last_executed_at: result.last_executed_at,
      retention_days: 7,
      cutoff_used: result.cutoff_used,
      audit_logs_purged: result.audit_logs_purged,
      security_logs_purged: result.security_logs_purged,
    });
  } catch (error: any) {
    // Safe error response: Log internal error on server, return safe generic message to client
    console.error('[LOG RETENTION API ERROR] POST execution failed:', error?.message || error);
    return NextResponse.json(
      { error: 'Retention execution failed.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/retention
 *
 * Read-only health check to inspect current retention telemetry metadata in public.system_settings.
 * Never executes deletion, never modifies system settings.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid CRON_SECRET or Super Admin session required.' },
        { status: 401 }
      );
    }

    const status = await db.logRetention.getStatus();
    return NextResponse.json({
      success: true,
      policy: '7_DAY_ROLLING_RETENTION',
      retention_days: 7,
      throttle_window_hours: 20,
      current_status: status,
    });
  } catch (error: any) {
    console.error('[LOG RETENTION API ERROR] GET status failed:', error?.message || error);
    return NextResponse.json(
      { error: 'Unable to retrieve retention status.' },
      { status: 500 }
    );
  }
}
