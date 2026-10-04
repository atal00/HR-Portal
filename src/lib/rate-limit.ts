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

/**
 * Token Bucket Rate Limiter
 * 
 * Capacity: 5 tokens
 * Initial: 5 tokens
 * Consumption: 1 token per failed login attempt
 * Refill: Exactly 1 token every 15 minutes (continuous elapsed time calculation)
 * Maximum: 5 tokens
 * Success: Immediately resets bucket to 5 tokens
 */
export interface TokenBucketRecord {
  tokens: number;
  lastRefill: number; // ms timestamp
}

export class TokenBucketRateLimiter {
  private store = new Map<string, TokenBucketRecord>();
  private readonly capacity: number;
  private readonly refillIntervalMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(capacity: number = 5, refillMinutes: number = 15) {
    this.capacity = capacity;
    this.refillIntervalMs = refillMinutes * 60 * 1000;

    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Refills tokens based on continuous elapsed time since last refill.
   */
  private updateBucket(record: TokenBucketRecord, now: number = Date.now()): void {
    if (record.tokens >= this.capacity) {
      record.lastRefill = now;
      return;
    }

    const elapsed = now - record.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);
      if (tokensToAdd > 0) {
        record.tokens = Math.min(this.capacity, record.tokens + tokensToAdd);
        record.lastRefill += tokensToAdd * this.refillIntervalMs;
        if (record.tokens >= this.capacity) {
          record.lastRefill = now;
        }
      }
    }
  }

  /**
   * Inspect current bucket state without consuming tokens.
   */
  public check(key: string, now: number = Date.now()): {
    allowed: boolean;
    remainingTokens: number;
    lockoutSeconds: number;
  } {
    const record = this.store.get(key);
    if (!record) {
      return {
        allowed: true,
        remainingTokens: this.capacity,
        lockoutSeconds: 0,
      };
    }

    this.updateBucket(record, now);

    if (record.tokens < 1) {
      const elapsedSinceRefill = now - record.lastRefill;
      const timeUntilNextTokenMs = Math.max(0, this.refillIntervalMs - elapsedSinceRefill);
      const lockoutSeconds = Math.max(1, Math.ceil(timeUntilNextTokenMs / 1000));
      return {
        allowed: false,
        remainingTokens: 0,
        lockoutSeconds,
      };
    }

    return {
      allowed: true,
      remainingTokens: record.tokens,
      lockoutSeconds: 0,
    };
  }

  /**
   * Consume exactly 1 token on failed login attempt.
   */
  public consume(key: string, now: number = Date.now()): {
    isLocked: boolean;
    remainingTokens: number;
    lockoutSeconds: number;
  } {
    let record = this.store.get(key);
    if (!record) {
      record = {
        tokens: this.capacity,
        lastRefill: now,
      };
      this.store.set(key, record);
    }

    this.updateBucket(record, now);

    if (record.tokens > 0) {
      record.tokens -= 1;
      // If we just consumed from capacity, mark lastRefill at this moment
      if (record.tokens === this.capacity - 1 && record.lastRefill > now) {
        record.lastRefill = now;
      }
    }

    const isLocked = record.tokens < 1;
    let lockoutSeconds = 0;
    if (isLocked) {
      const elapsedSinceRefill = now - record.lastRefill;
      const timeUntilNextTokenMs = Math.max(0, this.refillIntervalMs - elapsedSinceRefill);
      lockoutSeconds = Math.max(1, Math.ceil(timeUntilNextTokenMs / 1000));
    }

    return {
      isLocked,
      remainingTokens: record.tokens,
      lockoutSeconds,
    };
  }

  /**
   * Reset bucket immediately to full capacity (5 tokens) upon successful authentication.
   */
  public reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Test/Diagnostic helper to query raw state.
   */
  public getState(key: string, now: number = Date.now()): { tokens: number; lastRefill: number } {
    const record = this.store.get(key);
    if (!record) {
      return { tokens: this.capacity, lastRefill: now };
    }
    this.updateBucket(record, now);
    return { tokens: record.tokens, lastRefill: record.lastRefill };
  }

  /**
   * Test/Diagnostic helper to simulate passage of time or token counts.
   */
  public setBucket(key: string, tokens: number, lastRefill: number): void {
    this.store.set(key, {
      tokens: Math.min(this.capacity, Math.max(0, tokens)),
      lastRefill,
    });
  }

  private cleanup(): void {
    const now = Date.now();
    const maxRetention = 2 * this.capacity * this.refillIntervalMs; // 2.5 hours
    for (const [key, record] of this.store.entries()) {
      this.updateBucket(record, now);
      if (record.tokens >= this.capacity && (now - record.lastRefill) > maxRetention) {
        this.store.delete(key);
      }
    }
  }
}

// Global singletons to preserve across Next.js dev server hot-reloads
const globalForLimiter = globalThis as unknown as {
  rateLimiter: InMemoryRateLimiter;
  loginTokenBucket: TokenBucketRateLimiter;
};

export const rateLimiter = globalForLimiter.rateLimiter || new InMemoryRateLimiter();
export const loginTokenBucket = globalForLimiter.loginTokenBucket || new TokenBucketRateLimiter(5, 15);

if (process.env.NODE_ENV !== 'production') {
  globalForLimiter.rateLimiter = rateLimiter;
  globalForLimiter.loginTokenBucket = loginTokenBucket;
}
