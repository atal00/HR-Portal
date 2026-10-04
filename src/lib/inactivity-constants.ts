/**
 * Inactivity and Cross-Tab Authentication Synchronization Constants
 * Client-safe (no server dependencies, no node built-ins)
 */

export const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes (1,200,000 ms)
export const LAST_ACTIVITY_COOKIE_NAME = 'varsaka_last_activity';
export const AUTH_CHANNEL_NAME = 'varsaka_auth_channel';
export const LOGOUT_SIGNAL_KEY = 'varsaka_logout_signal';
