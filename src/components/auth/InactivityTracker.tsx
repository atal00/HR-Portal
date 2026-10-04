'use client';

import React, { useEffect, useRef } from 'react';
import {
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE_NAME,
  AUTH_CHANNEL_NAME,
  LOGOUT_SIGNAL_KEY,
} from '@/lib/inactivity-constants';

const THROTTLE_MS = 10 * 1000; // 10 seconds throttle for activity recording
const CHECK_INTERVAL_MS = 10 * 1000; // Check inactivity every 10 seconds
const STORAGE_KEY = LAST_ACTIVITY_COOKIE_NAME;
const CHANNEL_NAME = AUTH_CHANNEL_NAME;

function setClientActivityCookie(timestamp: number) {
  if (typeof document === 'undefined') return;
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${LAST_ACTIVITY_COOKIE_NAME}=${timestamp}; path=/; SameSite=Lax; max-age=86400;${isSecure ? ' Secure;' : ''}`;
}

function clearClientActivityCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${LAST_ACTIVITY_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax;`;
}

export const InactivityTracker: React.FC = () => {
  const isLoggingOutRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastRecordedRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initialize BroadcastChannel for cross-tab coordination
    try {
      if ('BroadcastChannel' in window) {
        channelRef.current = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current.onmessage = (event) => {
          if (!event.data) return;
          if (event.data.type === 'LOGOUT') {
            isLoggingOutRef.current = true;
            const targetUrl = event.data.reason === 'inactivity' ? '/login?reason=inactivity' : '/login';
            window.location.href = targetUrl;
          } else if (event.data.type === 'ACTIVITY') {
            const timestamp = event.data.timestamp;
            if (typeof timestamp === 'number') {
              lastRecordedRef.current = Math.max(lastRecordedRef.current, timestamp);
            }
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported or error initializing:', e);
    }

    // 2. Perform Logout
    const triggerAutoLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(LOGOUT_SIGNAL_KEY, String(Date.now()));
        clearClientActivityCookie();
        if (channelRef.current) {
          channelRef.current.postMessage({ type: 'LOGOUT', reason: 'inactivity' });
        }
      } catch {
        // Silently ignore storage or channel access errors during logout
      }

      try {
        await fetch('/api/auth/logout', { method: 'POST', keepalive: true });
      } catch {
        // Continue redirecting even if network error occurs
      }

      window.location.href = '/login?reason=inactivity';
    };

    // 3. Activity Recording (Throttled)
    const recordActivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      if (now - lastRecordedRef.current < THROTTLE_MS) {
        return; // Throttled
      }
      lastRecordedRef.current = now;

      try {
        localStorage.setItem(STORAGE_KEY, String(now));
        setClientActivityCookie(now);
        if (channelRef.current) {
          channelRef.current.postMessage({ type: 'ACTIVITY', timestamp: now });
        }
      } catch {
        // Silently ignore storage update errors
      }
    };

    // 4. Inactivity Expiration Check
    const checkInactivity = async () => {
      if (isLoggingOutRef.current) return;

      let storedTime = 0;
      try {
        const val = localStorage.getItem(STORAGE_KEY);
        if (val) storedTime = parseInt(val, 10);
      } catch {
        // Fallback to cookie if localStorage fails
      }

      // Fallback: Read cookie if localStorage missing
      if (!storedTime) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + LAST_ACTIVITY_COOKIE_NAME + '=([^;]*)'));
        if (match && match[1]) {
          storedTime = parseInt(match[1], 10);
        }
      }

      if (!storedTime) {
        // Initialize current activity
        recordActivity();
        return;
      }

      const elapsed = Date.now() - storedTime;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        await triggerAutoLogout();
      }
    };

    // Initial check on mount: If page refreshed or opened after expiry, immediately logout!
    checkInactivity();

    // 5. Setup Activity Listeners
    // Track meaningful interactions: click, keydown, pointerdown, scroll, touchstart
    // Mousemove is intentionally excluded to prevent excessive processing
    const activityEvents = ['click', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    const eventOptions: AddEventListenerOptions = { passive: true, capture: true };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, recordActivity, eventOptions);
    });

    // 6. Wake / Visibility / Focus Listener (Handles laptop lid close/open, sleeping tabs)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 7. Cross-Tab Storage Event Fallback Listener
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === LOGOUT_SIGNAL_KEY && !isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
        window.location.href = '/login?reason=inactivity';
      } else if (e.key === STORAGE_KEY) {
        if (!e.newValue) {
          // Cleared in another tab -> logout
          if (!isLoggingOutRef.current) {
            isLoggingOutRef.current = true;
            window.location.href = '/login?reason=inactivity';
          }
        } else {
          const ts = parseInt(e.newValue, 10);
          if (!isNaN(ts)) {
            lastRecordedRef.current = Math.max(lastRecordedRef.current, ts);
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 8. Periodic Polling Timer
    const timerId = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // 9. Teardown & Cleanup
    return () => {
      clearInterval(timerId);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, recordActivity, eventOptions);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageEvent);
      if (channelRef.current) {
        try {
          channelRef.current.close();
        } catch {
          // Channel close error ignored on cleanup
        }
      }
    };
  }, []);

  return null; // Invisible monitor component
};
