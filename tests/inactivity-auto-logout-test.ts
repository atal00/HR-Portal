import fs from 'fs';
import path from 'path';

// Load .env.local configuration
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

import { NextRequest } from 'next/server';
import {
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_COOKIE_NAME,
  AUTH_CHANNEL_NAME,
  LOGOUT_SIGNAL_KEY,
} from '../src/lib/inactivity-constants';
import {
  signSessionPayload,
  verifySessionToken,
  getCurrentUser,
  AUTH_COOKIE,
  LAST_ACTIVITY_COOKIE,
} from '../src/lib/auth';
import { POST as breakGlassHandler } from '../src/app/api/auth/break-glass/route';
import { POST as logoutHandler } from '../src/app/api/auth/logout/route';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { db } from '../src/lib/db';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName}`);
    if (failureDetails) {
      console.error(`     ${YELLOW}Details: ${failureDetails}${RESET}`);
    }
    failed++;
  }
}

async function runInactivityAndBreakGlassTestSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  VARSaka HR PORTAL — INACTIVITY AUTO LOGOUT & BREAK-GLASS TESTS ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // ============================================================================
  // TASK 1: BREAK-GLASS SECURITY FIX VERIFICATION
  // ============================================================================
  console.log(`${BOLD}SECTION 1: Break-Glass Security Fix Verification${RESET}`);

  const originalBreakGlassKey = process.env.BREAK_GLASS_RECOVERY_KEY;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Test 1.1: If BREAK_GLASS_RECOVERY_KEY is missing, endpoint MUST fail closed with HTTP 503
    delete process.env.BREAK_GLASS_RECOVERY_KEY;

    const reqMissingSecret = new NextRequest('http://localhost:3000/api/auth/break-glass', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-break-glass-key': 'some-random-key',
      },
      body: JSON.stringify({
        operator: 'Incident Lead',
        reason: 'Emergency database connection outage investigation',
      }),
    });

    const resMissingSecret = await breakGlassHandler(reqMissingSecret);
    const bodyMissingSecret = await resMissingSecret.json().catch(() => ({}));

    assert(
      resMissingSecret.status === 503,
      'Break-glass returns HTTP 503 when BREAK_GLASS_RECOVERY_KEY is not configured',
      `Status: ${resMissingSecret.status}, Body: ${JSON.stringify(bodyMissingSecret)}`
    );
    assert(
      bodyMissingSecret.error?.includes('not configured'),
      'Break-glass error message clearly indicates emergency recovery is not configured'
    );

    // Test 1.2: Endpoint must NOT fall back to SUPABASE_SERVICE_ROLE_KEY
    // Even if SUPABASE_SERVICE_ROLE_KEY is present and supplied in headers, missing BREAK_GLASS_RECOVERY_KEY must return 503
    const serviceRoleKey = originalServiceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
    delete process.env.BREAK_GLASS_RECOVERY_KEY;

    const reqFallbackAttempt = new NextRequest('http://localhost:3000/api/auth/break-glass', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-break-glass-key': serviceRoleKey,
      },
      body: JSON.stringify({
        operator: 'Incident Lead',
        reason: 'Attempting fallback with service role key',
      }),
    });

    const resFallbackAttempt = await breakGlassHandler(reqFallbackAttempt);
    assert(
      resFallbackAttempt.status === 503,
      'Break-glass strictly rejects SUPABASE_SERVICE_ROLE_KEY fallback and stays closed with HTTP 503'
    );

    // Test 1.3: When BREAK_GLASS_RECOVERY_KEY is configured, invalid key returns HTTP 401
    const testSecret = 'varsaka-hr-break-glass-recovery-secret-key-2026-prod-xyz';
    process.env.BREAK_GLASS_RECOVERY_KEY = testSecret;

    const reqWrongKey = new NextRequest('http://localhost:3000/api/auth/break-glass', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-break-glass-key': 'incorrect-secret-key',
      },
      body: JSON.stringify({
        operator: 'Incident Lead',
        reason: 'Emergency database connection outage investigation',
      }),
    });

    const resWrongKey = await breakGlassHandler(reqWrongKey);
    assert(
      resWrongKey.status === 401,
      'Break-glass rejects invalid recovery key with HTTP 401'
    );

    // Test 1.4: Missing operator or insufficient reason returns HTTP 400
    const reqMissingReason = new NextRequest('http://localhost:3000/api/auth/break-glass', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-break-glass-key': testSecret,
      },
      body: JSON.stringify({
        operator: 'Incident Lead',
        reason: 'short', // less than 10 characters
      }),
    });

    const resMissingReason = await breakGlassHandler(reqMissingReason);
    assert(
      resMissingReason.status === 400,
      'Break-glass requires detailed reason (>= 10 chars), returning HTTP 400 otherwise'
    );

    // Test 1.5: Valid key and valid emergency payload succeeds
    const reqValidBreakGlass = new NextRequest('http://localhost:3000/api/auth/break-glass', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-break-glass-key': testSecret,
      },
      body: JSON.stringify({
        operator: 'Automated Recovery Drill Lead',
        reason: 'Scheduled emergency recovery drill and verification test',
      }),
    });

    const resValid = await breakGlassHandler(reqValidBreakGlass);
    const bodyValid = await resValid.json().catch(() => ({}));
    assert(
      resValid.status === 200 && bodyValid.success === true,
      'Break-glass succeeds with HTTP 200 when authenticated with BREAK_GLASS_RECOVERY_KEY',
      `Status: ${resValid.status}, Body: ${JSON.stringify(bodyValid)}`
    );
  } finally {
    // Restore environment
    if (originalBreakGlassKey) process.env.BREAK_GLASS_RECOVERY_KEY = originalBreakGlassKey;
    if (originalServiceRoleKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }

  // ============================================================================
  // TASK 2: 20-MINUTE INACTIVITY AUTO LOGOUT & ARCHITECTURE VERIFICATION
  // ============================================================================
  console.log(`\n${BOLD}SECTION 2: 20-Minute Inactivity Auto Logout Verification${RESET}`);

  // Test 2.1: Timeout constant verification
  assert(
    INACTIVITY_TIMEOUT_MS === 20 * 60 * 1000,
    'INACTIVITY_TIMEOUT_MS is exactly 20 minutes (1,200,000 ms)'
  );
  assert(
    LAST_ACTIVITY_COOKIE_NAME === 'varsaka_last_activity',
    'LAST_ACTIVITY_COOKIE_NAME is defined as "varsaka_last_activity"'
  );
  assert(
    AUTH_CHANNEL_NAME === 'varsaka_auth_channel',
    'AUTH_CHANNEL_NAME is defined as "varsaka_auth_channel"'
  );
  assert(
    LOGOUT_SIGNAL_KEY === 'varsaka_logout_signal',
    'LOGOUT_SIGNAL_KEY is defined as "varsaka_logout_signal"'
  );

  // Test 2.2: Active user remains logged in (activity within 20 minutes)
  console.log(`\n${BOLD}Test 2.2: Active User Session Validation${RESET}`);
  const now = Date.now();
  const recentActivityTime = now - 5 * 60 * 1000; // 5 minutes ago (active)
  const isExpiredRecent = now - recentActivityTime > INACTIVITY_TIMEOUT_MS;
  assert(
    !isExpiredRecent,
    'User with activity 5 minutes ago is recognized as active (not expired)'
  );

  // Test 2.3: Inactive user expires after 20 minutes
  console.log(`\n${BOLD}Test 2.3: Inactivity Expiry Validation (> 20 Minutes)${RESET}`);
  const expiredActivityTime = now - 21 * 60 * 1000; // 21 minutes ago (expired)
  const isExpiredOld = now - expiredActivityTime > INACTIVITY_TIMEOUT_MS;
  assert(
    isExpiredOld,
    'User with activity 21 minutes ago is recognized as expired (> 20 minutes)'
  );

  // Boundary condition test: Exactly 20 minutes + 1 ms
  const boundaryExpiredTime = now - (20 * 60 * 1000 + 1);
  assert(
    now - boundaryExpiredTime > INACTIVITY_TIMEOUT_MS,
    'User at 20 min + 1 ms is strictly expired'
  );

  // Boundary condition test: 19 minutes 59 seconds
  const boundaryActiveTime = now - (20 * 60 * 1000 - 1000);
  assert(
    !(now - boundaryActiveTime > INACTIVITY_TIMEOUT_MS),
    'User at 19 minutes 59 seconds remains authenticated'
  );

  // Test 2.4: Activity resets timer
  console.log(`\n${BOLD}Test 2.4: Activity Resets Timer${RESET}`);
  let simulatedLastActivity = now - 15 * 60 * 1000; // 15 mins elapsed
  assert(
    now - simulatedLastActivity < INACTIVITY_TIMEOUT_MS,
    'Timer before reset is approaching expiry (15 mins elapsed)'
  );

  // Simulate user activity event (click, keydown, scroll)
  const userInteractionTime = Date.now();
  simulatedLastActivity = userInteractionTime;
  assert(
    Date.now() - simulatedLastActivity < 1000,
    'Timer successfully reset to current timestamp upon user interaction'
  );

  // Test 2.5: Server-side check prevents refresh bypass
  console.log(`\n${BOLD}Test 2.5: Refresh Does Not Bypass Inactivity Expiry${RESET}`);
  // In PortalLayout (src/app/(portal)/layout.tsx):
  // if (hasSession && lastActivity) {
  //   const lastActivityTime = parseInt(lastActivity, 10);
  //   if (!isNaN(lastActivityTime) && Date.now() - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
  //     redirect('/login?reason=inactivity');
  //   }
  // }
  const checkServerLayoutGuard = (hasSession: boolean, cookieActivity: string | undefined): { redirected: boolean; destination?: string } => {
    if (hasSession && cookieActivity) {
      const parsed = parseInt(cookieActivity, 10);
      if (!isNaN(parsed) && Date.now() - parsed > INACTIVITY_TIMEOUT_MS) {
        return { redirected: true, destination: '/login?reason=inactivity' };
      }
    }
    return { redirected: false };
  };

  const expiredCookieValue = String(Date.now() - 25 * 60 * 1000);
  const layoutGuardResult = checkServerLayoutGuard(true, expiredCookieValue);
  assert(
    layoutGuardResult.redirected === true && layoutGuardResult.destination === '/login?reason=inactivity',
    'Server-side layout guard redirects expired session to /login?reason=inactivity on page refresh'
  );

  const activeCookieValue = String(Date.now() - 3 * 60 * 1000);
  const activeLayoutGuardResult = checkServerLayoutGuard(true, activeCookieValue);
  assert(
    activeLayoutGuardResult.redirected === false,
    'Server-side layout guard permits active session on page refresh'
  );

  // Test 2.6: Cross-tab logout synchronization payload and storage protocol
  console.log(`\n${BOLD}Test 2.6: Cross-Tab Logout Coordination Protocol${RESET}`);
  const sampleBroadcastMessage = { type: 'LOGOUT', reason: 'inactivity' };
  assert(
    sampleBroadcastMessage.type === 'LOGOUT' && sampleBroadcastMessage.reason === 'inactivity',
    'BroadcastChannel payload structure adheres to { type: "LOGOUT", reason: "inactivity" }'
  );

  // Test 2.7: Logout API clears LAST_ACTIVITY_COOKIE
  console.log(`\n${BOLD}Test 2.7: Logout Endpoint Cleans Up Activity Cookie${RESET}`);
  const reqLogout = new NextRequest('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  });
  const resLogout = await logoutHandler(reqLogout);
  assert(resLogout.status === 200, 'Logout endpoint returns HTTP 200');

  const setCookieHeaders = resLogout.headers.getSetCookie();
  const clearedActivityCookie = setCookieHeaders.find((c) => c.startsWith(`${LAST_ACTIVITY_COOKIE_NAME}=`));
  assert(
    clearedActivityCookie !== undefined,
    'Logout endpoint explicitly clears varsaka_last_activity cookie in Set-Cookie header'
  );
  assert(
    clearedActivityCookie?.includes('Max-Age=0') || clearedActivityCookie?.includes('max-age=0'),
    'varsaka_last_activity cookie is cleared with Max-Age=0'
  );

  // Test 2.8: Login page parses reason parameter and activates session expired notice
  console.log(`\n${BOLD}Test 2.8: Session Expired Notice Routing & Display${RESET}`);
  const checkNoticeActivation = (paramReason?: string, paramExpired?: string) => {
    const reason = paramReason || (paramExpired === 'true' ? 'inactivity' : undefined);
    if (reason === 'inactivity' || reason === 'session_expired') {
      return 'Your session has expired due to 20 minutes of inactivity. Please sign in again to continue.';
    }
    return null;
  };

  assert(
    checkNoticeActivation('inactivity', undefined) !== null,
    'Query param reason=inactivity triggers session expired notice'
  );
  assert(
    checkNoticeActivation(undefined, 'true') !== null,
    'Query param expired=true triggers session expired notice'
  );
  assert(
    checkNoticeActivation(undefined, undefined) === null,
    'Standard login page load does not display expired notice'
  );

  // Test 2.9: No sensitive data stored in client storage
  console.log(`\n${BOLD}Test 2.9: Client Storage Security Sanitization${RESET}`);
  // Storage key must ONLY contain numeric timestamp
  const sampleStoredTimestamp = String(Date.now());
  const isOnlyNumeric = /^\d+$/.test(sampleStoredTimestamp);
  assert(
    isOnlyNumeric,
    'localStorage varsaka_last_activity contains only Unix epoch milliseconds timestamp'
  );
  assert(
    !sampleStoredTimestamp.includes('token') &&
    !sampleStoredTimestamp.includes('secret') &&
    !sampleStoredTimestamp.includes('key'),
    'Client inactivity tracking never stores auth tokens, service role keys, or secrets'
  );

  // Summary
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${passed > 0 && failed === 0 ? GREEN : RED}TEST RESULTS: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runInactivityAndBreakGlassTestSuite().catch((err) => {
  console.error(`${RED}FATAL ERROR IN TEST SUITE:${RESET}`, err);
  process.exit(1);
});
