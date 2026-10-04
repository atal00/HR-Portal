/**
 * MANDATORY SECURITY REMEDIATION VERIFICATION SUITE: P1 TO P5
 * 
 * Tests and proves compliance for:
 * P1: Secret Fallback Hardening (SESSION_SECRET & Storage)
 * P2: Mock Auth Test Guard (__mockAuthUser strictly locked to NODE_ENV === 'test')
 * P3: Bulk Document Action Hardening (50-item cap, deduplication, regex validation, rate limiting)
 * P4: Database Error Sanitization (Zero PostgreSQL/Supabase driver errors leak to clients)
 * P5: Resource Existence Oracle Elimination (Documents & Tasks return identical 404s)
 */

import { NextRequest } from 'next/server';
import { getSessionSecret, signSessionPayload, verifySessionToken, requireAuthUser } from '@/lib/auth';
import { getStorageDownloadSecret, generateSignedDownloadToken, verifySignedDownloadToken } from '@/lib/storage';
import { POST as bulkActionRoute } from '@/app/api/documents/bulk-action/route';
import { GET as getDocumentRoute, DELETE as deleteDocumentRoute } from '@/app/api/documents/[id]/route';
import { GET as getTaskRoute, PATCH as patchTaskRoute } from '@/app/api/tasks/[id]/route';
import { formatSafeApiError } from '@/lib/errors';
import { DatabaseError, handleDbError, db } from '@/lib/db';
import { SessionUser } from '@/types/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('P1 TO P5 MANDATORY SECURITY REMEDIATION VERIFICATION');
  console.log('================================================================\n');

  // Backup original env vars
  const origNodeEnv = process.env.NODE_ENV;
  const origSessionSecret = process.env.SESSION_SECRET;

  // ====================================================================
  // P1: SECRET FALLBACK HARDENING
  // ====================================================================
  console.log('--- P1: SECRET FALLBACK HARDENING ---');

  // Test P1.1: Missing SESSION_SECRET in production fails closed
  try {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    
    let caughtAuth = false;
    try {
      getSessionSecret();
    } catch (e: any) {
      caughtAuth = true;
      assert(
        e.message.includes('FATAL CONFIGURATION ERROR') && e.message.includes('SESSION_SECRET'),
        'P1.1a: getSessionSecret() throws fatal configuration error in production when missing'
      );
    }
    assert(caughtAuth, 'P1.1b: getSessionSecret() failed closed in production');

    let caughtStorage = false;
    try {
      getStorageDownloadSecret();
    } catch (e: any) {
      caughtStorage = true;
      assert(
        e.message.includes('FATAL CONFIGURATION ERROR') && e.message.includes('SESSION_SECRET'),
        'P1.1c: getStorageDownloadSecret() throws fatal configuration error in production when missing'
      );
    }
    assert(caughtStorage, 'P1.1d: getStorageDownloadSecret() failed closed in production');

    // Test P1.2: Weak/Placeholder SESSION_SECRET in production fails closed
    process.env.SESSION_SECRET = 'short-secret';
    let caughtWeak = false;
    try {
      getSessionSecret();
    } catch (e: any) {
      caughtWeak = true;
      assert(
        e.message.includes('32-character') || e.message.includes('insufficient'),
        'P1.2: SESSION_SECRET shorter than 32 characters fails closed in production'
      );
    }
    assert(caughtWeak, 'P1.2b: Weak secret failed closed');

    // Test P1.3: Valid SESSION_SECRET in production works properly
    process.env.SESSION_SECRET = 'a-very-long-production-grade-secret-key-32chars!';
    const validSecret = getSessionSecret();
    assert(
      validSecret === 'a-very-long-production-grade-secret-key-32chars!',
      'P1.3: Valid SESSION_SECRET accepted in production'
    );

    const token = await signSessionPayload({
      sub: 'usr-p1-test',
      email: 'p1@varsaka.com',
      name: 'P1 Test',
      role: 'SUPER_ADMIN',
    });
    assert(typeof token === 'string' && token.length > 20, 'P1.4: Session token signed with valid secret');

    const verified = await verifySessionToken(token);
    assert(verified?.sub === 'usr-p1-test', 'P1.5: Session token verified with valid secret');

  } finally {
    // Restore for subsequent test phases
    (process.env as any).NODE_ENV = 'test';
    process.env.SESSION_SECRET = origSessionSecret || 'test-session-secret-for-remediation-suite-32chars';
  }

  // ====================================================================
  // P2: LOCK __mockAuthUser TO TEST ENVIRONMENT
  // ====================================================================
  console.log('\n--- P2: LOCK __mockAuthUser TO TEST ENVIRONMENT ---');

  const mockUserPayload: SessionUser = {
    id: 'attacker-id-999',
    email: 'attacker@evil.com',
    full_name: 'Malicious Injected User',
    role: 'SUPER_ADMIN',
  };

  (global as any).__mockAuthUser = mockUserPayload;

  // Test P2.1: In production, __mockAuthUser MUST NEVER authenticate
  try {
    (process.env as any).NODE_ENV = 'production';
    let prodBypassed = false;
    try {
      await requireAuthUser();
      prodBypassed = true;
    } catch (err: any) {
      assert(err.status === 401, 'P2.1a: requireAuthUser throws 401 in production despite __mockAuthUser');
    }
    assert(!prodBypassed, 'P2.1b: __mockAuthUser is completely ignored in production');
  } finally {
    (process.env as any).NODE_ENV = 'test';
  }

  // Test P2.2: In development, __mockAuthUser is NOT honored
  try {
    (process.env as any).NODE_ENV = 'development';
    let devBypassed = false;
    try {
      await requireAuthUser();
      devBypassed = true;
    } catch (err: any) {
      assert(err.status === 401, 'P2.2a: requireAuthUser throws 401 in development despite __mockAuthUser');
    }
    assert(!devBypassed, 'P2.2b: __mockAuthUser is completely ignored in development');
  } finally {
    (process.env as any).NODE_ENV = 'test';
  }

  // Test P2.3: In test, __mockAuthUser is honored for test harnesses
  try {
    (process.env as any).NODE_ENV = 'test';
    const authedUser = await requireAuthUser();
    assert(authedUser.id === 'attacker-id-999', 'P2.3: __mockAuthUser is permitted strictly in NODE_ENV=test');
  } finally {
    delete (global as any).__mockAuthUser;
  }

  // ====================================================================
  // P3: HARDEN BULK DOCUMENT ACTION
  // ====================================================================
  console.log('\n--- P3: HARDEN BULK DOCUMENT ACTION ---');

  // Authenticate as Super Admin for bulk tests
  (global as any).__mockAuthUser = {
    id: 'usr-admin-bulk',
    email: 'admin@varsaka.com',
    full_name: 'Admin Bulk Tester',
    role: 'SUPER_ADMIN',
  };

  // Test P3.1: 51 items rejected with HTTP 400
  const overLimitIds = Array.from({ length: 51 }, (_, i) => `doc-test-id-${i + 1}`);
  const reqOverLimit = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.1.1' },
    body: JSON.stringify({
      action: 'APPROVE',
      documentIds: overLimitIds,
    }),
  });
  const resOverLimit = await bulkActionRoute(reqOverLimit);
  const dataOverLimit = await resOverLimit.json();
  assert(resOverLimit.status === 400, 'P3.1a: 51 document IDs rejected with HTTP 400 (got ' + resOverLimit.status + ')');
  assert(dataOverLimit.error.includes('maximum of 50'), 'P3.1b: Error message specifies 50 item maximum');

  // Test P3.2: 50 valid items accepted by length check
  const exactly50Ids = Array.from({ length: 50 }, (_, i) => `doc-valid-id-${i + 1}`);
  const reqExactly50 = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.1.2' },
    body: JSON.stringify({
      action: 'APPROVE',
      documentIds: exactly50Ids,
    }),
  });
  const resExactly50 = await bulkActionRoute(reqExactly50);
  assert(resExactly50.status === 200, 'P3.2: Exactly 50 items accepted for processing with HTTP 200');

  // Test P3.3: Duplicate IDs deduplicated
  const dupIds = ['doc-dup-1', 'doc-dup-1', 'doc-dup-2', 'doc-dup-2', 'doc-dup-1'];
  const reqDup = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.1.3' },
    body: JSON.stringify({
      action: 'APPROVE',
      documentIds: dupIds,
    }),
  });
  const resDup = await bulkActionRoute(reqDup);
  const dataDup = await resDup.json();
  assert(resDup.status === 200, 'P3.3a: Duplicate ID request succeeds');
  assert(dataDup.summary.total === 2, `P3.3b: 5 items with 2 distinct IDs deduplicated to total: 2 (got ${dataDup.summary.total})`);

  // Test P3.4: Invalid ID format rejected with HTTP 400
  const malformedIds = ['valid-id-1', 'invalid id with spaces; DROP TABLE--'];
  const reqMalformed = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.1.4' },
    body: JSON.stringify({
      action: 'APPROVE',
      documentIds: malformedIds,
    }),
  });
  const resMalformed = await bulkActionRoute(reqMalformed);
  const dataMalformed = await resMalformed.json();
  assert(resMalformed.status === 400, 'P3.4a: Malformed document ID rejected with HTTP 400');
  assert(dataMalformed.error.includes('Invalid document ID format'), 'P3.4b: Error message specifies invalid format');

  // Test P3.5: Rate limiting triggers HTTP 429
  let hitRateLimit = false;
  let retryAfterHeader: string | null = null;
  const spamIp = '198.51.100.42';

  for (let i = 0; i < 7; i++) {
    const reqSpam = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': spamIp },
      body: JSON.stringify({
        action: 'APPROVE',
        documentIds: ['doc-rl-1'],
      }),
    });
    const resSpam = await bulkActionRoute(reqSpam);
    if (resSpam.status === 429) {
      hitRateLimit = true;
      retryAfterHeader = resSpam.headers.get('Retry-After');
      break;
    }
  }
  assert(hitRateLimit, 'P3.5a: Rapid bulk action requests trigger HTTP 429 rate limit');
  assert(retryAfterHeader !== null && parseInt(retryAfterHeader) > 0, 'P3.5b: Rate limit response includes valid Retry-After header');

  // ====================================================================
  // P4: SANITIZE RAW DATABASE/SUPABASE ERRORS
  // ====================================================================
  console.log('\n--- P4: DATABASE ERROR SANITIZATION ---');

  // Test P4.1: DatabaseError in production produces generic message
  try {
    (process.env as any).NODE_ENV = 'production';
    const rawPgError = {
      message: 'relation "public.documents" does not exist',
      details: 'Table documents was dropped by internal migration',
      hint: 'Check schema public',
      code: '42P01',
    };

    let caughtDbError: any = null;
    try {
      handleDbError('documents.list', rawPgError);
    } catch (err: any) {
      caughtDbError = err;
    }

    assert(caughtDbError instanceof DatabaseError, 'P4.1a: handleDbError throws DatabaseError instance');
    assert(
      caughtDbError.message === 'Unable to complete the requested operation.',
      'P4.1b: DatabaseError message is generic in production: "Unable to complete the requested operation."'
    );
    assert(
      !caughtDbError.message.includes('public.documents') && !caughtDbError.message.includes('42P01'),
      'P4.1c: DatabaseError in production NEVER exposes table names, SQL details, or error codes'
    );

    // Test P4.2: formatSafeApiError sanitizes raw database errors
    const safeRes = formatSafeApiError(rawPgError);
    assert(
      safeRes.error === 'Unable to complete the requested operation.',
      'P4.2a: formatSafeApiError converts raw Postgres error to generic safe message'
    );
    assert(safeRes.status === 500, 'P4.2b: formatSafeApiError forces status 500 for database error');

    // Test P4.3: formatSafeApiError preserves legitimate user-facing application errors
    const userAppError = { message: 'Invalid credentials provided.', status: 401 };
    const safeAppRes = formatSafeApiError(userAppError);
    assert(
      safeAppRes.error === 'Invalid credentials provided.',
      'P4.3a: formatSafeApiError preserves valid application error message'
    );
    assert(safeAppRes.status === 401, 'P4.3b: formatSafeApiError preserves 401 status');

  } finally {
    (process.env as any).NODE_ENV = 'test';
  }

  // ====================================================================
  // P5: RESOURCE EXISTENCE ORACLE ELIMINATION
  // ====================================================================
  console.log('\n--- P5: RESOURCE EXISTENCE ORACLE ELIMINATION ---');

  // Create mock document in mock storage/database
  const mockSalarySlip = {
    id: 'doc-confidential-salary-999',
    document_number: 'VAR-PAY-2026-999',
    document_type: 'SALARY_SLIP',
    title: 'Executive Salary Slip',
    employee_id: 'emp-exec-1',
    status: 'APPROVED',
  };

  // Temporarily stub db.documents.getById to test oracle response
  const origGetDocById = db.documents.getById;
  (db.documents as any).getById = async (id: string) => {
    if (id === 'doc-confidential-salary-999') return mockSalarySlip;
    return null;
  };

  try {
    // Caller without salary.view (e.g. VIEWER or regular employee)
    (global as any).__mockAuthUser = {
      id: 'usr-viewer-unauthed',
      email: 'viewer@varsaka.com',
      full_name: 'Regular Staff',
      role: 'VIEWER',
    };

    // Test P5.1: Unauthorized query for EXISTING salary document
    const reqExist = new NextRequest('http://localhost:3000/api/documents/doc-confidential-salary-999');
    const resExist = await getDocumentRoute(reqExist, { params: Promise.resolve({ id: 'doc-confidential-salary-999' }) });
    const dataExist = await resExist.json();

    // Test P5.2: Unauthorized query for NON-EXISTENT document
    const reqNonExist = new NextRequest('http://localhost:3000/api/documents/doc-non-existent-888');
    const resNonExist = await getDocumentRoute(reqNonExist, { params: Promise.resolve({ id: 'doc-non-existent-888' }) });
    const dataNonExist = await resNonExist.json();

    assert(resExist.status === 404, 'P5.1a: Unauthorized existing document returns HTTP 404');
    assert(dataExist.error === 'Document not found', 'P5.1b: Unauthorized existing document returns "Document not found"');
    assert(resNonExist.status === 404, 'P5.2a: Unauthorized non-existent document returns HTTP 404');
    assert(dataNonExist.error === 'Document not found', 'P5.2b: Unauthorized non-existent document returns "Document not found"');
    assert(
      resExist.status === resNonExist.status && dataExist.error === dataNonExist.error,
      'P5.3: Document Existence Oracle ELIMINATED: Existing vs Non-existent responses are completely identical'
    );

    // Test P5.4: Authorized query (SUPER_ADMIN) works normally
    (global as any).__mockAuthUser = {
      id: 'usr-admin-p5',
      email: 'admin@varsaka.com',
      full_name: 'Admin P5',
      role: 'SUPER_ADMIN',
    };

    const reqAuthedExist = new NextRequest('http://localhost:3000/api/documents/doc-confidential-salary-999');
    const resAuthedExist = await getDocumentRoute(reqAuthedExist, { params: Promise.resolve({ id: 'doc-confidential-salary-999' }) });
    const dataAuthedExist = await resAuthedExist.json();
    assert(resAuthedExist.status === 200, 'P5.4a: Authorized user querying existing document returns HTTP 200');
    assert(dataAuthedExist.id === 'doc-confidential-salary-999', 'P5.4b: Authorized user receives document payload');

    const reqAuthedNonExist = new NextRequest('http://localhost:3000/api/documents/doc-non-existent-888');
    const resAuthedNonExist = await getDocumentRoute(reqAuthedNonExist, { params: Promise.resolve({ id: 'doc-non-existent-888' }) });
    assert(resAuthedNonExist.status === 404, 'P5.4c: Authorized user querying non-existent document receives 404');

  } finally {
    (db.documents as any).getById = origGetDocById;
  }

  // ====================================================================
  // P5: TASK EXISTENCE ORACLE ELIMINATION
  // ====================================================================
  console.log('\n--- P5: TASK EXISTENCE ORACLE ELIMINATION ---');

  const mockSecretTask = {
    id: 'task-secret-audit-999',
    title: 'Secret Internal Investigation',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigned_to: 'usr-super-admin-1',
    created_by: 'usr-super-admin-1',
  };

  const origGetTaskById = db.tasks.getById;
  (db.tasks as any).getById = async (id: string) => {
    if (id === 'task-secret-audit-999') return mockSecretTask;
    return null;
  };

  try {
    // Caller who is regular employee, NOT assignee and NOT creator
    (global as any).__mockAuthUser = {
      id: 'usr-regular-staff-2',
      email: 'staff@varsaka.com',
      full_name: 'Staff Member',
      role: 'EMPLOYEE',
    };

    // Test P5.5: Unauthorized GET for EXISTING task
    const reqTaskExist = new NextRequest('http://localhost:3000/api/tasks/task-secret-audit-999');
    const resTaskExist = await getTaskRoute(reqTaskExist, { params: Promise.resolve({ id: 'task-secret-audit-999' }) });
    const dataTaskExist = await resTaskExist.json();

    // Test P5.6: Unauthorized GET for NON-EXISTENT task
    const reqTaskNonExist = new NextRequest('http://localhost:3000/api/tasks/task-non-existent-888');
    const resTaskNonExist = await getTaskRoute(reqTaskNonExist, { params: Promise.resolve({ id: 'task-non-existent-888' }) });
    const dataTaskNonExist = await resTaskNonExist.json();

    assert(resTaskExist.status === 404, 'P5.5a: Unauthorized existing task returns HTTP 404');
    assert(dataTaskExist.error === 'Task not found.', 'P5.5b: Unauthorized existing task returns "Task not found."');
    assert(resTaskNonExist.status === 404, 'P5.6a: Unauthorized non-existent task returns HTTP 404');
    assert(dataTaskNonExist.error === 'Task not found.', 'P5.6b: Unauthorized non-existent task returns "Task not found."');
    assert(
      resTaskExist.status === resTaskNonExist.status && dataTaskExist.error === dataTaskNonExist.error,
      'P5.7: Task Existence Oracle ELIMINATED: Existing vs Non-existent responses are completely identical'
    );

    // Test P5.8: Unauthorized PATCH for existing task returns 404 (does not reveal existence via 403)
    const reqTaskPatch = new NextRequest('http://localhost:3000/api/tasks/task-secret-audit-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const resTaskPatch = await patchTaskRoute(reqTaskPatch, { params: Promise.resolve({ id: 'task-secret-audit-999' }) });
    const dataTaskPatch = await resTaskPatch.json();
    assert(resTaskPatch.status === 404, 'P5.8a: Unauthorized PATCH to existing task returns HTTP 404');
    assert(dataTaskPatch.error === 'Task not found.', 'P5.8b: Unauthorized PATCH returns generic "Task not found."');

    // Test P5.9: Authorized party (Assignee / Super Admin) accesses task normally
    (global as any).__mockAuthUser = {
      id: 'usr-super-admin-1',
      email: 'admin@varsaka.com',
      full_name: 'Task Admin',
      role: 'SUPER_ADMIN',
    };

    const reqTaskAuthed = new NextRequest('http://localhost:3000/api/tasks/task-secret-audit-999');
    const resTaskAuthed = await getTaskRoute(reqTaskAuthed, { params: Promise.resolve({ id: 'task-secret-audit-999' }) });
    const dataTaskAuthed = await resTaskAuthed.json();
    assert(resTaskAuthed.status === 200, 'P5.9a: Authorized user querying existing task returns HTTP 200');
    assert(dataTaskAuthed.task.id === 'task-secret-audit-999', 'P5.9b: Authorized user receives task details');

  } finally {
    (db.tasks as any).getById = origGetTaskById;
    delete (global as any).__mockAuthUser;
  }

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
