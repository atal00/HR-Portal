export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { checkAndExecuteStartupRetention } = await import('./lib/retention');
    // Autonomous server-side fallback: single throttled startup check after 5s grace period
    setTimeout(() => {
      checkAndExecuteStartupRetention().catch((err) => {
        console.error('[LOG RETENTION] Startup fallback failed:', err);
      });
    }, 5000);
  }
}
