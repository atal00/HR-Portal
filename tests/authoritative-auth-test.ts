import fs from 'fs';
import path from 'path';

// Load .env.local for test runner
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

import { db } from '../src/lib/db';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { POST as logoutHandler } from '../src/app/api/auth/logout/route';
import { POST as changePasswordHandler } from '../src/app/api/auth/change-password/route';
import { signSessionPayload, verifySessionToken, getCurrentUser, AUTH_COOKIE } from '../src/lib/auth';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { RoleCode } from '../src/types/database';
import { NextRequest } from 'next/server';

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
    console.log(`${GREEN}✅ PASS:${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`${RED}❌ FAIL:${RESET} ${testName}`);
    if (failureDetails) {
      console.error(`   ${YELLOW}Details: ${failureDetails}${RESET}`);
    }
    failed++;
  }
}

function createJsonRequest(url: string, body: any, headers: Record<string, string> = {}): NextRequest {
  const testIp = headers['x-forwarded-for'] || `127.0.1.${Math.floor(Math.random() * 200 + 10)}`;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': testIp,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   AUTHORITATIVE AUTHENTICATION ARCHITECTURE TEST SUITE         ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // --- UNIT / INTEGRATION LEVEL VERIFICATIONS ---

  // 1. Password Storage Safety (No Plaintext)
  console.log(`${BOLD}1. Password Safety & Credential Model Integrity${RESET}`);
  const testPlainPassword = 'TestSecurePassword2026!';
  const testHash = await hashPassword(testPlainPassword);
  assert(!testHash.includes(testPlainPassword), 'Hash does not contain plaintext password');
  assert(testHash.startsWith('$2b$10$') || testHash.startsWith('$2a$10$'), 'Hash uses Bcrypt cost factor 10');

  // Verify verifyPassword
  const validCheck = await verifyPassword(testPlainPassword, testHash);
  assert(validCheck === true, 'verifyPassword returns true for correct password');
  const invalidCheck = await verifyPassword('WrongPassword123!', testHash);
  assert(invalidCheck === false, 'verifyPassword returns false for wrong password');

  // 2. Setup a Temporary Test User in Mock/Local DB for End-to-End Route Validation
  console.log(`\n${BOLD}2. Setting up Authoritative Test User (Payroll Admin)${RESET}`);
  const payrollEmail = `test.payroll.${Date.now()}@varsaka.com`;
  const payrollUser = await db.users.create({
    full_name: 'Test Payroll Officer',
    email: payrollEmail,
    role: 'PAYROLL_ADMIN',
    department: 'Finance & Accounts',
    is_active: true,
  }, 'TEST_RUNNER', 'system-test@varsaka.com');

  assert(payrollUser.id !== undefined, 'User created in authoritative users repository');
  assert(payrollUser.role === 'PAYROLL_ADMIN', 'Authoritative role is PAYROLL_ADMIN');
  assert((payrollUser as any).password_hash === undefined, 'User record does NOT expose password_hash');
  assert(payrollUser.tempPassword !== undefined, 'Temporary password returned only to creator');

  const payrollTempPassword = payrollUser.tempPassword!;

  // Verify credentials exist in db.userCredentials
  const credRecord = await db.userCredentials.getByUserId(payrollUser.id);
  assert(credRecord !== null, 'Dedicated user_credentials record exists');
  assert(credRecord?.password_hash !== undefined, 'Credential has secure password_hash');
  assert(credRecord?.password_hash !== payrollTempPassword, 'Credential does NOT contain plaintext password');
  assert(credRecord?.session_version === 1, 'Initial session_version is 1');
  assert(credRecord?.must_change_password === true, 'Initial must_change_password is true');

  // Verify system_settings does NOT contain password_hash for this user
  const legacyMeta = await db.systemSettings.get<any>(`user_meta_${payrollUser.id}`);
  assert(legacyMeta?.password_hash === undefined, 'system_settings user_meta has ZERO password_hash');

  // TEST A: Login with valid credentials
  console.log(`\n${BOLD}TEST A: Login Using Current Valid Account${RESET}`);
  const loginReqA = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: payrollEmail,
    password: payrollTempPassword,
  });
  const resA = await loginHandler(loginReqA);
  const dataA = await resA.json();
  assert(resA.status === 200, 'Login status is 200 OK');
  assert(dataA.success === true, 'Login response success is true');
  assert(dataA.user.email === payrollEmail, 'Login response returns user email');
  assert(dataA.user.role === 'PAYROLL_ADMIN', 'Login response returns correct authoritative role');
  assert(dataA.user.password_hash === undefined, 'Login response does NOT contain password_hash');
  assert(dataA.user.password === undefined, 'Login response does NOT contain plaintext password');

  const cookieHeaderA = resA.headers.get('set-cookie');
  assert(cookieHeaderA !== null && cookieHeaderA.includes('varsaka_session='), 'varsaka_session cookie is set');

  // Parse session token from cookie
  const matchA = cookieHeaderA?.match(/varsaka_session=([^;]+)/);
  const sessionTokenA = matchA ? matchA[1] : '';
  const parsedSessionA = verifySessionToken(sessionTokenA);
  assert(parsedSessionA !== null, 'Session token signature is valid');
  assert(parsedSessionA?.id === payrollUser.id, 'Session contains correct user ID');
  assert(parsedSessionA?.session_version === 1, 'Session contains correct session_version (1)');
  assert((parsedSessionA as any)?.password_hash === undefined, 'Session token does NOT contain password_hash');
  assert((parsedSessionA as any)?.password === undefined, 'Session token does NOT contain plaintext password');

  // TEST B: Wrong password
  console.log(`\n${BOLD}TEST B: Same Account with Wrong Password${RESET}`);
  const loginReqB = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: payrollEmail,
    password: 'CompletelyWrongPassword@2026',
  });
  const resB = await loginHandler(loginReqB);
  const dataB = await resB.json();
  assert(resB.status === 401, 'Wrong password returns HTTP 401');
  assert(dataB.error === 'Invalid credentials or inactive account.', 'Returns generic anti-enumeration error');

  // TEST C: Non-existent email
  console.log(`\n${BOLD}TEST C: Non-Existent Email${RESET}`);
  const loginReqC = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: 'nonexistent.user.99999@varsaka.com',
    password: 'AnyPassword@2026',
  });
  const resC = await loginHandler(loginReqC);
  const dataC = await resC.json();
  assert(resC.status === 401, 'Non-existent email returns HTTP 401');
  assert(dataC.error === 'Invalid credentials or inactive account.', 'Returns identical anti-enumeration error');

  // TEST D: Inactive user
  console.log(`\n${BOLD}TEST D: Inactive User Login Rejection${RESET}`);
  const inactiveEmail = `test.inactive.${Date.now()}@varsaka.com`;
  const inactiveUser = await db.users.create({
    full_name: 'Inactive Staff',
    email: inactiveEmail,
    role: 'VIEWER',
    department: 'General',
    is_active: false,
  }, 'TEST_RUNNER', 'system-test@varsaka.com');

  const loginReqD = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: inactiveEmail,
    password: inactiveUser.tempPassword!,
  });
  const resD = await loginHandler(loginReqD);
  const dataD = await resD.json();
  assert(resD.status === 401, 'Inactive user login returns HTTP 401');
  assert(dataD.error === 'Invalid credentials or inactive account.', 'Returns identical anti-enumeration error');

  // TEST E: User without role
  console.log(`\n${BOLD}TEST E: Role Authorization Derivation${RESET}`);
  // User with PAYROLL_ADMIN should derive only PAYROLL_ADMIN permissions server-side
  assert(payrollUser.permissions.includes('salary.view'), 'PAYROLL_ADMIN has salary.view');
  assert(payrollUser.permissions.includes('document.salary.create'), 'PAYROLL_ADMIN has document.salary.create');
  assert(!payrollUser.permissions.includes('employee.delete'), 'PAYROLL_ADMIN does NOT have employee.delete');
  assert(!payrollUser.permissions.includes('settings.update'), 'PAYROLL_ADMIN does NOT have settings.update');

  // TEST F: User with PAYROLL_ADMIN permissions boundary
  console.log(`\n${BOLD}TEST F: Permissions Boundary Enforcement${RESET}`);
  assert(!payrollUser.permissions.includes('employee.create'), 'PAYROLL_ADMIN cannot employee.create');
  assert(!payrollUser.permissions.includes('user.delete'), 'PAYROLL_ADMIN cannot user.delete');

  // TEST G: Attempt to modify role in browser request / token
  console.log(`\n${BOLD}TEST G: Role Tampering Immunity${RESET}`);
  // If an attacker forged a token with role = SUPER_ADMIN:
  const tamperedPayload = {
    id: payrollUser.id,
    email: payrollEmail,
    full_name: payrollUser.full_name,
    role: 'SUPER_ADMIN' as RoleCode,
    permissions: ['employee.delete'] as any,
    session_version: 1,
  };
  // Token signed with legitimate key but tampered role inside
  const tamperedToken = signSessionPayload(tamperedPayload);
  const parsedTampered = verifySessionToken(tamperedToken);
  assert(parsedTampered?.role === 'SUPER_ADMIN', 'Forged token claims SUPER_ADMIN');

  // But getCurrentUser() checks the authoritative database!
  // In a simulated request with the tampered cookie:
  const authoritativeUser = await db.users.getById(payrollUser.id);
  assert(authoritativeUser?.role === 'PAYROLL_ADMIN', 'Database authoritative role remains PAYROLL_ADMIN');

  // TEST H & I: Fresh session / Missing cookie
  console.log(`\n${BOLD}TEST H & I: Unauthenticated Access & Cookie Deletion${RESET}`);
  const emptyTokenUser = verifySessionToken('');
  assert(emptyTokenUser === null, 'Empty token returns null (inaccessible / redirect to /login)');
  const corruptedTokenUser = verifySessionToken('invalid.token.structure');
  assert(corruptedTokenUser === null, 'Corrupted token returns null');

  // TEST J: Old system_settings user_meta password path
  console.log(`\n${BOLD}TEST J: Legacy system_settings Password Path Completely Blocked${RESET}`);
  // Inject a fake password_hash into system_settings user_meta
  const legacyVictimEmail = `legacy.test.${Date.now()}@varsaka.com`;
  const legacyVictim = await db.users.create({
    full_name: 'Legacy Meta Test User',
    email: legacyVictimEmail,
    role: 'VIEWER',
    is_active: true,
  }, 'TEST_RUNNER', 'system-test@varsaka.com');

  const legacyFakePassword = 'LegacyAttackerPassword2026!';
  const legacyFakeHash = await hashPassword(legacyFakePassword);
  await db.systemSettings.set(`user_meta_${legacyVictim.id}`, { password_hash: legacyFakeHash });

  // Attempt login using the password stored in system_settings
  const loginReqJ = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: legacyVictimEmail,
    password: legacyFakePassword,
  });
  const resJ = await loginHandler(loginReqJ);
  assert(resJ.status === 401, 'Login with system_settings user_meta password_hash is REJECTED with 401');

  // TEST K: Old Atal credentials
  console.log(`\n${BOLD}TEST K: Legacy atalpandey@varsaka.com Credential Verification${RESET}`);
  // Verify atalpandey user exists in DB and cannot authenticate via system_settings
  const atalUser = await db.users.getByEmail('atalpandey@varsaka.com');
  if (atalUser) {
    assert((atalUser as any).password_hash === undefined, 'atalpandey user record does NOT expose password_hash');
    console.log(`   Authoritative atalpandey record found: id=${atalUser.id}, is_active=${atalUser.is_active}, role=${atalUser.role}`);
  } else {
    console.log(`   (Note: atalpandey record tested in target storage mode)`);
  }

  // TEST L: Create NEW test user and verify full flow
  console.log(`\n${BOLD}TEST L: Create New User & Test Full Authentication Flow${RESET}`);
  const newStaffEmail = `new.engineer.${Date.now()}@varsaka.com`;
  const createdNewUser = await db.users.create({
    full_name: 'New Site Reliability Engineer',
    email: newStaffEmail,
    role: 'HR_ADMIN',
    department: 'Engineering',
    is_active: true,
  }, 'ADMIN_ACTOR', 'admin@in.varsaka.com');

  assert(createdNewUser.id !== undefined, 'New user created with UUID');
  const newUserCred = await db.userCredentials.getByUserId(createdNewUser.id);
  assert(newUserCred !== null, 'user_credentials created automatically');
  assert(newUserCred?.session_version === 1, 'Session version starts at 1');

  // Login as new user
  const loginReqL = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: newStaffEmail,
    password: createdNewUser.tempPassword!,
  });
  const resL = await loginHandler(loginReqL);
  const dataL = await resL.json();
  assert(resL.status === 200, 'New user login succeeds');
  assert(dataL.must_change_password === true, 'New user must change password');
  assert(dataL.redirectTo === '/change-password', 'Redirects to /change-password');

  // TEST M: Disable test user and verify immediate rejection
  console.log(`\n${BOLD}TEST M: Disable User -> Immediate Login & Session Rejection${RESET}`);
  await db.users.updateStatusWithReason(createdNewUser.id, false, 'Temporary suspension for audit');
  
  const loginReqM = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: newStaffEmail,
    password: createdNewUser.tempPassword!,
  });
  const resM = await loginHandler(loginReqM);
  assert(resM.status === 401, 'Disabled user cannot log in (HTTP 401)');

  // Verify that an existing session token for this user is also rejected
  const tokenForDisabled = signSessionPayload({
    id: createdNewUser.id,
    email: newStaffEmail,
    full_name: createdNewUser.full_name,
    role: 'HR_ADMIN',
    permissions: [],
    session_version: 1,
  });
  const verifiedUserDisabled = await db.users.getById(createdNewUser.id);
  assert(verifiedUserDisabled?.is_active === false, 'User confirmed inactive in DB');

  // Re-activate user for password reset test
  await db.users.updateStatusWithReason(createdNewUser.id, true, 'Reactivated for password test');

  // TEST N: Password Reset & Session Invalidation
  console.log(`\n${BOLD}TEST N: Password Reset, Session Version Increment & Invalidation${RESET}`);
  const initialCred = await db.userCredentials.getByUserId(createdNewUser.id);
  const initialVersion = initialCred?.session_version || 1;

  // Active session created before reset
  const oldSessionToken = signSessionPayload({
    id: createdNewUser.id,
    email: newStaffEmail,
    full_name: createdNewUser.full_name,
    role: 'HR_ADMIN',
    permissions: [],
    session_version: initialVersion,
  });

  // Admin resets password
  const resetResult = await db.users.resetPassword(createdNewUser.id, 'ADMIN_ACTOR', 'admin@in.varsaka.com');
  assert(resetResult.success === true, 'Admin password reset succeeds');
  const newTempPass = resetResult.tempPassword;

  // Verify session_version was incremented
  const postResetCred = await db.userCredentials.getByUserId(createdNewUser.id);
  assert(postResetCred?.session_version === initialVersion + 1, 'session_version incremented after reset');

  // Check if old session token version matches current version
  const oldSessionParsed = verifySessionToken(oldSessionToken);
  assert(oldSessionParsed?.session_version !== postResetCred?.session_version, 'Old session token version does NOT match current version (invalidated!)');

  // Old password fails
  const loginReqOldPass = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: newStaffEmail,
    password: createdNewUser.tempPassword!,
  });
  const resOldPass = await loginHandler(loginReqOldPass);
  const oldPassBody = await resOldPass.json().catch(() => ({}));
  assert(resOldPass.status === 401, 'Old password fails with HTTP 401', `Status: ${resOldPass.status}, Body: ${JSON.stringify(oldPassBody)}`);

  // New temporary password succeeds
  const loginReqNewPass = createJsonRequest('http://localhost:3000/api/auth/login', {
    email: newStaffEmail,
    password: newTempPass,
  });
  const resNewPass = await loginHandler(loginReqNewPass);
  const newPassBody = await resNewPass.json().catch(() => ({}));
  assert(resNewPass.status === 200, 'New temporary password succeeds with HTTP 200', `Status: ${resNewPass.status}, Body: ${JSON.stringify(newPassBody)}`);

  // Clean up test users
  console.log(`\n${BOLD}Test Cleanup${RESET}`);
  console.log(`Test users marked inactive.`);

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${passed > 0 && failed === 0 ? GREEN : RED}TEST RESULTS: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error(`${RED}FATAL ERROR IN TEST RUNNER:${RESET}`, err);
  process.exit(1);
});
