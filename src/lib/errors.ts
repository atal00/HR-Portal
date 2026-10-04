/**
 * Centralized API Error Formatter & Sanitizer
 * 
 * In production, prevents technical PostgreSQL/Supabase driver errors,
 * database schema details (table names, constraints, columns), and stack traces
 * from leaking to API clients, while preserving server-side diagnostic logging.
 */

export function formatSafeApiError(error: any): { error: string; status: number } {
  const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  const rawMsg = error?.message || String(error || 'Internal Server Error');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.STORAGE_MODE === 'supabase' ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('varsaka.com') === true;

  // Always log internal 500 errors server-side with full diagnostic context
  if (status >= 500) {
    console.error('[SERVER ERROR]:', rawMsg);
  }

  if (isProd) {
    // Check if error is internal database/driver error or unexpected 500
    const isSensitive =
      error?.isDatabaseError ||
      status >= 500 ||
      /supabase|postgres|relation|column|violates|duplicate key|syntax error|pg_|foreign key|check constraint|database error/i.test(rawMsg);

    if (isSensitive) {
      return {
        error: 'Unable to complete the requested operation.',
        status,
      };
    }
  }

  // Preserve user-facing application/validation messages (e.g. 400, 401, 403, 404, 429)
  return {
    error: rawMsg,
    status,
  };
}
