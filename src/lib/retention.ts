import { db } from './db';

/**
 * Consolidated Log Retention Module
 *
 * Provides single-point execution functions for the 7-day rolling retention policy.
 * All operations execute through the authoritative db.logRetention.executePolicy() engine,
 * which enforces an atomic database-backed 20-hour throttle in public.system_settings.
 *
 * Retention period is immutably 7 days.
 * Throttle is immutably 20 hours.
 * Zero in-process setInterval timers: Replaced by scheduled webhook (/api/internal/retention)
 * and single throttled startup checks.
 */

export async function runRollingLogRetention() {
  try {
    return await db.logRetention.executePolicy();
  } catch (error: any) {
    console.error('[LOG RETENTION ERROR] Retention execution failed:', error?.message || error);
    return {
      skipped: false,
      reason: 'Execution error',
      last_executed_at: new Date().toISOString(),
      retention_days: 7,
      cutoff_used: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      audit_logs_purged: 0,
      security_logs_purged: 0,
      auditLogsDeleted: 0,
      securityLogsDeleted: 0,
      cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      executedAt: new Date().toISOString(),
      error: 'Retention execution failed.',
    };
  }
}

/**
 * Autonomous Server Startup Fallback
 *
 * Invoked once during server initialization (instrumentation.ts) after a short grace period.
 * Evaluates the 20-hour atomic database throttle:
 * - If last_executed_at is < 20 hours old: SKIPS silently (zero redundant work).
 * - If last_executed_at is >= 20 hours old or empty: Executes 7-day rolling retention.
 */
export async function checkAndExecuteStartupRetention() {
  try {
    console.log('[LOG RETENTION] Evaluating startup log retention check (atomic 20-hour throttle rule)...');
    const result = await runRollingLogRetention();
    if (result.skipped) {
      console.log(`[LOG RETENTION] Startup check skipped: ${result.reason}`);
    } else {
      console.log(
        `[LOG RETENTION] Startup check executed: Purged ${result.audit_logs_purged} audit_logs, ` +
        `${result.security_logs_purged} security_logs.`
      );
    }
    return result;
  } catch (err: any) {
    console.error('[LOG RETENTION] Startup retention check encountered error:', err?.message || err);
  }
}
