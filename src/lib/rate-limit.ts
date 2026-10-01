/**
 * Varsaka Enterprise Rate Limiting Utility
 * Sliding-window in-memory rate limiter with multi-instance Redis fallback interface.
 * 
 * Note for multi-instance production deployment:
 * In a distributed multi-node / serverless cluster, configure a Redis/Upstash
 * client to back this store. In single-server / local dev, this in-memory sliding
 * window provides strict per-IP / per-account rate limit enforcement.
 */

interface RateLimitRecord {
  timestamps: number[];
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodic garbage collection every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check and record a hit for a key.
   * @param key Unique identifier (e.g., ip:endpoint or ip:action)
   * @param limit Maximum allowed requests within the window
   * @param windowMs Time window in milliseconds
   * @returns { allowed: boolean, remaining: number, resetSeconds: number }
   */
  public check(key: string, limit: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetSeconds: number;
    total: number;
  } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0];
      const resetMs = oldest + windowMs - now;
      const resetSeconds = Math.max(1, Math.ceil(resetMs / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
        total: record.timestamps.length,
      };
    }

    record.timestamps.push(now);
    const resetSeconds = Math.ceil(windowMs / 1000);
    return {
      allowed: true,
      remaining: limit - record.timestamps.length,
      resetSeconds,
      total: record.timestamps.length,
    };
  }

  /**
   * Specifically for login failure tracking: only increments on failure
   */
  public recordFailure(key: string, limit: number, windowMs: number): {
    isLocked: boolean;
    remainingAttempts: number;
    lockoutSeconds: number;
  } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.timestamps.push(now);

    const isLocked = record.timestamps.length >= limit;
    const oldest = record.timestamps[0];
    const resetMs = oldest + windowMs - now;
    const lockoutSeconds = Math.max(1, Math.ceil(resetMs / 1000));

    return {
      isLocked,
      remainingAttempts: Math.max(0, limit - record.timestamps.length),
      lockoutSeconds,
    };
  }

  public isBlocked(key: string, limit: number, windowMs: number): {
    blocked: boolean;
    lockoutSeconds: number;
  } {
    const now = Date.now();
    const windowStart = now - windowMs;

    const record = this.store.get(key);
    if (!record) return { blocked: false, lockoutSeconds: 0 };

    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0];
      const resetMs = oldest + windowMs - now;
      const lockoutSeconds = Math.max(1, Math.ceil(resetMs / 1000));
      return { blocked: true, lockoutSeconds };
    }

    return { blocked: false, lockoutSeconds: 0 };
  }

  public reset(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    const maxWindow = 15 * 60 * 1000; // 15 mins
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > now - maxWindow);
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

// Global singleton to preserve across Next.js dev server hot-reloads
const globalForLimiter = globalThis as unknown as { rateLimiter: InMemoryRateLimiter };
export const rateLimiter = globalForLimiter.rateLimiter || new InMemoryRateLimiter();
if (process.env.NODE_ENV !== 'production') globalForLimiter.rateLimiter = rateLimiter;
