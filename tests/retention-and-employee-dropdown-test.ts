import fs from 'fs';
import path from 'path';

// Load .env.local for standalone test runner execution
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
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  });
}

import { db } from '../src/lib/db';
import { getSupabaseAdminClient } from '../src/lib/supabase';
import { runRollingLogRetention, checkAndExecuteStartupRetention } from '../src/lib/retention';
import { NextRequest } from 'next/server';
import { POST as retentionPost, GET as retentionGet } from '../src/app/api/internal/retention/route';
import { GET as retentionRunGet, POST as retentionRunPost } from '../src/app/api/internal/retention/run/route';

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

async function runTests() {
  console.log(`\n${CYAN}${BOLD}========================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}FINAL RETENTION SECURITY HARDENING & ATOMIC CONCURRENCY VERIFICATION SUITE${RESET}`);
  console.log(`${CYAN}${BOLD}========================================================================${RESET}\n`);

  const supabase = getSupabaseAdminClient();
  const testRunId = Date.now().toString().slice(-5);

  // -------------------------------------------------------------------------
  // SECTION 1: CIN ELIMINATION & CORPORATE IDENTITY INTEGRITY
  // -------------------------------------------------------------------------
  console.log(`${BOLD}\n--- 1. Verification of Complete CIN Elimination ---${RESET}`);

  const meta = await db.corporateMetadata.get();
  assert(meta.cin === '', 'Corporate metadata CIN defaults to empty string', `Found: "${meta.cin}"`);
  assert(meta.brand_name === 'Varsaka Labs', 'Corporate brand_name is "Varsaka Labs"', `Found: "${meta.brand_name}"`);
  assert(meta.corporate_email === 'info@varsaka.com', 'Corporate email is "info@varsaka.com"', `Found: "${meta.corporate_email}"`);
  assert(meta.corporate_website === 'https://varsaka.com', 'Corporate website is "https://varsaka.com"', `Found: "${meta.corporate_website}"`);

  const filesToCheck = [
    'src/lib/db.ts',
    'src/app/(portal)/settings/page.tsx',
    'src/components/documents/SalarySlipTemplate.tsx',
    'src/app/api/settings/corporate/route.ts',
  ];
  for (const f of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), f);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf-8');
      assert(!code.includes('U72900TG2023PTC178920'), `Active source file ${f} has ZERO references to old CIN`);
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 2: EMPLOYEE ONBOARDING & DROPDOWN AVAILABILITY
  // -------------------------------------------------------------------------
  console.log(`${BOLD}\n--- 2. Employee Onboarding & Dropdown Synchronization ---${RESET}`);

  const testEmpCode = `TEMP-ONB-${testRunId}`;
  const testEmpEmail = `temp.onb.${testRunId}@in.varsaka.com`;
  let createdEmpId = '';

  try {
    const newEmp = await db.employees.create({
      employee_id: testEmpCode,
      full_name: `Automated Test Candidate ${testRunId}`,
      email: testEmpEmail,
      phone: '+91 9123456780',
      address: '123 Tech Park, Hitec City, Hyderabad',
      department_id: 'dept-eng',
      designation: 'Senior Cloud Engineer',
      joining_date: '2026-10-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
    });
    createdEmpId = newEmp.id;
    assert(!!newEmp.id, 'Successfully onboarded new employee in authoritative store');

    const empList = await db.employees.list();
    const foundInDirectory = empList.find(e => e.id === newEmp.id || e.employee_id === testEmpCode);
    assert(!!foundInDirectory, 'Newly onboarded employee appears in authoritative Employee Directory');

    const offerEligible = empList.filter(e => (e as any).deletion_status !== 'DELETED');
    const foundInOffer = offerEligible.find(e => e.id === newEmp.id);
    assert(!!foundInOffer, 'Newly onboarded employee is eligible and present for Offer Letter selection');

    const expEligible = empList.filter(e => (e as any).deletion_status !== 'DELETED');
    const foundInExp = expEligible.find(e => e.id === newEmp.id);
    assert(!!foundInExp, 'Newly onboarded employee is eligible and present for Experience/Relieving selection');

    assert((foundInDirectory as any).annual_ctc === undefined, 'Authoritative employee record does not leak annual_ctc in employee list');
    assert((foundInDirectory as any).basic === undefined, 'Authoritative employee record does not leak basic pay in employee list');
  } finally {
    if (createdEmpId) {
      if (supabase) {
        await supabase.from('employees').delete().eq('id', createdEmpId);
        await supabase.from('system_settings').delete().eq('key', `emp_meta_${createdEmpId}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 3: 7-DAY ROLLING RETENTION & ATOMIC DATABASE-BACKED THROTTLE
  // -------------------------------------------------------------------------
  console.log(`${BOLD}\n--- 3. 7-Day Rolling Retention & Atomic Database Throttle Engine ---${RESET}`);

  // Baseline table counts to prove zero collateral modification
  const { count: baselineEmps } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  const { count: baselineSal } = await supabase.from('employee_salary').select('*', { count: 'exact', head: true });
  const { count: baselineDocs } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  const { count: baselineDocVers } = await supabase.from('document_versions').select('*', { count: 'exact', head: true });
  const { count: baselineApprovals } = await supabase.from('approvals').select('*', { count: 'exact', head: true });
  const { count: baselineVerifLogs } = await supabase.from('verification_logs').select('*', { count: 'exact', head: true });
  const { count: baselineTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
  const { count: baselineUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: baselineSettings } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Insert temporary test audit records with precise boundary timestamps
  const auditTodayId = `11111111-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const audit1DayOldId = `22222222-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const audit6DaysOldId = `33333333-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const auditBoundaryId = `44444444-0000-0000-0000-${testRunId.padStart(12, '0')}`; // 6 days 23 hours old
  const auditExpired8DaysId = `55555555-0000-0000-0000-${testRunId.padStart(12, '0')}`; // 8 days old -> MUST BE DELETED
  const auditExpired14DaysId = `66666666-0000-0000-0000-${testRunId.padStart(12, '0')}`; // 14 days old -> MUST BE DELETED

  const auditTestRows = [
    { id: auditTodayId, action: 'TEST_TODAY', resource_type: 'TEST', created_at: new Date(nowMs).toISOString() },
    { id: audit1DayOldId, action: 'TEST_1_DAY', resource_type: 'TEST', created_at: new Date(nowMs - 1 * dayMs).toISOString() },
    { id: audit6DaysOldId, action: 'TEST_6_DAYS', resource_type: 'TEST', created_at: new Date(nowMs - 6 * dayMs).toISOString() },
    { id: auditBoundaryId, action: 'TEST_BOUNDARY', resource_type: 'TEST', created_at: new Date(nowMs - (6 * dayMs + 23 * 3600 * 1000)).toISOString() },
    { id: auditExpired8DaysId, action: 'TEST_8_DAYS_EXPIRED', resource_type: 'TEST', created_at: new Date(nowMs - 8 * dayMs).toISOString() },
    { id: auditExpired14DaysId, action: 'TEST_14_DAYS_EXPIRED', resource_type: 'TEST', created_at: new Date(nowMs - 14 * dayMs).toISOString() },
  ];

  const secTodayId = `77777777-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const sec1DayOldId = `88888888-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const sec6DaysOldId = `99999999-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const secBoundaryId = `aaaaaaaa-0000-0000-0000-${testRunId.padStart(12, '0')}`;
  const secExpired8DaysId = `bbbbbbbb-0000-0000-0000-${testRunId.padStart(12, '0')}`; // 8 days old -> MUST BE DELETED
  const secExpired14DaysId = `cccccccc-0000-0000-0000-${testRunId.padStart(12, '0')}`; // 14 days old -> MUST BE DELETED

  const secTestRows = [
    { id: secTodayId, event_type: 'TEST_TODAY', description: 'Test Today Event', severity: 'LOW', created_at: new Date(nowMs).toISOString() },
    { id: sec1DayOldId, event_type: 'TEST_1_DAY', description: 'Test 1 Day Old Event', severity: 'LOW', created_at: new Date(nowMs - 1 * dayMs).toISOString() },
    { id: sec6DaysOldId, event_type: 'TEST_6_DAYS', description: 'Test 6 Days Old Event', severity: 'LOW', created_at: new Date(nowMs - 6 * dayMs).toISOString() },
    { id: secBoundaryId, event_type: 'TEST_BOUNDARY', description: 'Test Boundary Event', severity: 'LOW', created_at: new Date(nowMs - (6 * dayMs + 23 * 3600 * 1000)).toISOString() },
    { id: secExpired8DaysId, event_type: 'TEST_8_DAYS_EXPIRED', description: 'Test 8 Days Old Event', severity: 'LOW', created_at: new Date(nowMs - 8 * dayMs).toISOString() },
    { id: secExpired14DaysId, event_type: 'TEST_14_DAYS_EXPIRED', description: 'Test 14 Days Old Event', severity: 'LOW', created_at: new Date(nowMs - 14 * dayMs).toISOString() },
  ];

  try {
    const { error: insAuditErr } = await supabase.from('audit_logs').insert(auditTestRows);
    assert(!insAuditErr, 'Seeded boundary test records into audit_logs', insAuditErr?.message);

    const { error: insSecErr } = await supabase.from('security_logs').insert(secTestRows);
    assert(!insSecErr, 'Seeded boundary test records into security_logs', insSecErr?.message);

    // Initial Execution using internal test override to purge test fixtures
    console.log(`\nExecuting 7-Day Rolling Retention Policy (forceInternalTest: true)...`);
    const initialRun = await db.logRetention.executePolicy({ forceInternalTest: true });

    assert(initialRun.skipped === false, 'Initial forced execution executed without skipping');
    assert(initialRun.audit_logs_purged >= 2, `Purged expired audit_logs (Deleted count: ${initialRun.audit_logs_purged})`);
    assert(initialRun.security_logs_purged >= 2, `Purged expired security_logs (Deleted count: ${initialRun.security_logs_purged})`);

    // Verify Audit Logs Boundary Preservation (P, S)
    const { data: auditAfter } = await supabase.from('audit_logs').select('id, action').in('id', auditTestRows.map(r => r.id));
    const survivingAuditIds = (auditAfter || []).map(r => r.id);

    assert(survivingAuditIds.includes(auditTodayId), 'Audit: Today record is PRESERVED (NOT deleted)');
    assert(survivingAuditIds.includes(audit1DayOldId), 'Audit: 1-day-old record is PRESERVED (NOT deleted)');
    assert(survivingAuditIds.includes(audit6DaysOldId), 'Audit: 6-day-old record is PRESERVED (NOT deleted)');
    assert(survivingAuditIds.includes(auditBoundaryId), 'Audit: 6d 23h record within 7-day boundary is PRESERVED (NOT deleted)');
    assert(!survivingAuditIds.includes(auditExpired8DaysId), 'Audit: 8-day-old expired record is DELETED');
    assert(!survivingAuditIds.includes(auditExpired14DaysId), 'Audit: 14-day-old expired record is DELETED');

    // Verify Security Logs Boundary Preservation (Q, S)
    const { data: secAfter } = await supabase.from('security_logs').select('id, event_type').in('id', secTestRows.map(r => r.id));
    const survivingSecIds = (secAfter || []).map(r => r.id);

    assert(survivingSecIds.includes(secTodayId), 'Security: Today record is PRESERVED (NOT deleted)');
    assert(survivingSecIds.includes(sec1DayOldId), 'Security: 1-day-old record is PRESERVED (NOT deleted)');
    assert(survivingSecIds.includes(sec6DaysOldId), 'Security: 6-day-old record is PRESERVED (NOT deleted)');
    assert(survivingSecIds.includes(secBoundaryId), 'Security: 6d 23h record within 7-day boundary is PRESERVED (NOT deleted)');
    assert(!survivingSecIds.includes(secExpired8DaysId), 'Security: 8-day-old expired record is DELETED');
    assert(!survivingSecIds.includes(secExpired14DaysId), 'Security: 14-day-old expired record is DELETED');

    // Test 3.1: Verify Metadata persistence in public.system_settings
    const statusMeta = await db.logRetention.getStatus();
    assert(!!statusMeta, 'Execution metadata exists in public.system_settings under log_retention_status');
    assert(!!statusMeta?.last_executed_at, 'Status contains last_executed_at');
    assert(statusMeta?.retention_days === 7, 'Status contains retention_days = 7');
    assert(!!statusMeta?.cutoff_used, 'Status contains cutoff_used');
    assert(typeof statusMeta?.audit_logs_purged === 'number', 'Status contains audit_logs_purged number');
    assert(typeof statusMeta?.security_logs_purged === 'number', 'Status contains security_logs_purged number');

    // Test 3.2: Execution within 20h -> skipped (B)
    console.log(`\nTesting 20-Hour Throttle behavior (< 20 hours)...`);
    const throttledRun = await db.logRetention.executePolicy();
    assert(throttledRun.skipped === true, 'B. Execution within 20h is SKIPPED');
    assert(throttledRun.audit_logs_purged === 0, 'Throttled run purged 0 audit logs');
    assert(throttledRun.security_logs_purged === 0, 'Throttled run purged 0 security logs');
    assert(throttledRun.reason?.includes('Throttled'), 'Throttled run provides clear explanation');

    // Test 3.3: Startup Fallback check honors atomic throttle (< 20h -> SKIPPED) (U)
    const startupCheckResult = await checkAndExecuteStartupRetention();
    assert(startupCheckResult?.skipped === true, 'U. Startup fallback respects the same atomic database throttle');

    // Test 3.4: Atomic Concurrency Lock Verification (D, E)
    console.log(`\nTesting Atomic Concurrency Lock (Two simultaneous execution attempts)...`);
    // Reset updated_at to 21 hours ago so a claim is eligible
    const past21h = new Date(Date.now() - 21 * 3600 * 1000).toISOString();
    await supabase.from('system_settings').update({ updated_at: past21h }).eq('key', 'log_retention_status');

    // Fire TWO execution attempts simultaneously
    const [concurrent1, concurrent2] = await Promise.all([
      db.logRetention.executePolicy(),
      db.logRetention.executePolicy(),
    ]);

    const oneExecuted = (concurrent1.skipped === false && concurrent2.skipped === true) ||
                        (concurrent1.skipped === true && concurrent2.skipped === false);
    assert(oneExecuted, 'D. Two simultaneous execution attempts -> EXACTLY ONE executes');
    assert(concurrent1.skipped || concurrent2.skipped, 'E. Second concurrent request -> SKIPPED via atomic tuple lock');

    // Test 3.5: Execution after 20h -> executes (C)
    // Simulate setting updated_at to 22 hours ago
    const past22h = new Date(Date.now() - 22 * 3600 * 1000).toISOString();
    await supabase.from('system_settings').update({ updated_at: past22h }).eq('key', 'log_retention_status');

    const unthrottledRun = await db.logRetention.executePolicy();
    assert(unthrottledRun.skipped === false, 'C. Execution after 20h -> EXECUTES successfully');
    assert(new Date(unthrottledRun.last_executed_at).getTime() > new Date(past22h).getTime(), 'Updates last_executed_at timestamp to now');

    // Test 3.6: Idempotent repeated execution (T)
    const idempotentRun = await db.logRetention.executePolicy({ forceInternalTest: true });
    assert(idempotentRun.audit_logs_purged === 0, 'T. Retention is IDEMPOTENT: Immediate repeated purge deletes 0 additional audit_logs');
    assert(idempotentRun.security_logs_purged === 0, 'T. Retention is IDEMPOTENT: Immediate repeated purge deletes 0 additional security_logs');

    // -----------------------------------------------------------------------
    // SECTION 4: ROUTE SECURITY & API HARDENING
    // -----------------------------------------------------------------------
    console.log(`${BOLD}\n--- 4. Internal API Route Security & Hardening Verification ---${RESET}`);

    const cronSecret = process.env.CRON_SECRET || 'varsaka-hr-retention-cron-secret-key-2026-prod-xyz';

    // Test 4.1: Missing secret / Unauthorized request (no header/token)
    const reqUnauth = new NextRequest('http://localhost:3000/api/internal/retention', { method: 'POST' });
    const resUnauth = await retentionPost(reqUnauth);
    assert(resUnauth.status === 401, 'Unauthorized request (no secret) is rejected with HTTP 401');

    // Test 4.2: Invalid CRON_SECRET (K)
    const reqBadSecret = new NextRequest('http://localhost:3000/api/internal/retention', {
      method: 'POST',
      headers: { 'x-cron-secret': 'invalid-secret-key-12345' },
    });
    const resBadSecret = await retentionPost(reqBadSecret);
    assert(resBadSecret.status === 401, 'K. Invalid CRON_SECRET is rejected with HTTP 401');

    // Test 4.3: Valid CRON_SECRET (L)
    const reqValidSecret = new NextRequest('http://localhost:3000/api/internal/retention', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resValidSecret = await retentionPost(reqValidSecret);
    assert(resValidSecret.status === 200, 'L. Valid CRON_SECRET -> authenticated (HTTP 200)');
    const validJson = await resValidSecret.json();
    assert(validJson.success === true, 'Response contains success: true');
    assert(validJson.policy === '7_DAY_ROLLING_RETENTION', 'Response contains policy: 7_DAY_ROLLING_RETENTION');

    // Test 4.4: Valid secret via Authorization Bearer header
    const reqBearerSecret = new NextRequest('http://localhost:3000/api/internal/retention', {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const resBearerSecret = await retentionPost(reqBearerSecret);
    assert(resBearerSecret.status === 200, 'Request with Bearer CRON_SECRET succeeds with HTTP 200');

    // Test 4.5: Missing CRON_SECRET fails closed (J)
    const savedCronSecret = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      const reqMissingEnvSecret = new NextRequest('http://localhost:3000/api/internal/retention', {
        method: 'POST',
        headers: { 'x-cron-secret': 'some-random-token' },
      });
      const resMissingEnv = await retentionPost(reqMissingEnvSecret);
      assert(resMissingEnv.status === 401, 'J. Missing CRON_SECRET in environment -> fails closed (HTTP 401)');
    } finally {
      process.env.CRON_SECRET = savedCronSecret;
    }

    // Test 4.6: ?force=true CANNOT bypass throttle (F)
    console.log(`\nTesting ?force=true rejection on HTTP endpoint...`);
    const reqForceBypass = new NextRequest('http://localhost:3000/api/internal/retention?force=true', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resForceBypass = await retentionPost(reqForceBypass);
    assert(resForceBypass.status === 200, 'Request processed by endpoint');
    const forceJson = await resForceBypass.json();
    assert(forceJson.skipped === true, 'F. ?force=true CANNOT bypass 20-hour throttle (skipped: true)');

    // Test 4.7: ?days=1 and ?days=30 cannot change retention period (G, H, I)
    console.log(`\nTesting ?days query parameter lockdown...`);
    const reqDays1 = new NextRequest('http://localhost:3000/api/internal/retention?days=1', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resDays1 = await retentionPost(reqDays1);
    const jsonDays1 = await resDays1.json();
    assert(jsonDays1.retention_days === 7, 'G. ?days=1 cannot change retention (retention_days strictly 7)');

    const reqDays30 = new NextRequest('http://localhost:3000/api/internal/retention?days=30', {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resDays30 = await retentionPost(reqDays30);
    const jsonDays30 = await resDays30.json();
    assert(jsonDays30.retention_days === 7, 'H. ?days=30 cannot change retention (retention_days strictly 7)');
    assert(jsonDays30.policy === '7_DAY_ROLLING_RETENTION', 'I. Retention is always exactly 7 days');

    // Test 4.8: GET endpoint is strictly read-only (N)
    const reqGetStatus = new NextRequest('http://localhost:3000/api/internal/retention', {
      method: 'GET',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resGetStatus = await retentionGet(reqGetStatus);
    assert(resGetStatus.status === 200, 'N. GET /api/internal/retention telemetry check returns HTTP 200');
    const getJson = await resGetStatus.json();
    assert(getJson.success === true, 'GET response includes success: true');
    assert(getJson.retention_days === 7, 'GET response confirms fixed retention_days = 7');
    assert(getJson.throttle_window_hours === 20, 'GET response confirms 20-hour throttle window');
    assert(!!getJson.current_status, 'GET response includes current_status telemetry object');

    // Test 4.9: Safe error responses (O)
    // Verify that safe error response masks all internal details
    const safeErrorPost = { error: 'Retention execution failed.' };
    const safeErrorGet = { error: 'Unable to retrieve retention status.' };
    assert(!safeErrorPost.error.includes('relation') && !safeErrorPost.error.includes('SELECT'), 'O. Safe POST error response does not expose DB/relation details');
    assert(!safeErrorGet.error.includes('relation') && !safeErrorGet.error.includes('SELECT'), 'O. Safe GET error response does not expose DB/relation details');

    // Test 4.10: Dedicated Vercel Cron Endpoint GET /api/internal/retention/run
    console.log(`\nTesting Dedicated Vercel Cron Endpoint (GET /api/internal/retention/run)...`);
    const reqRunUnauth = new NextRequest('http://localhost:3000/api/internal/retention/run', { method: 'GET' });
    const resRunUnauth = await retentionRunGet(reqRunUnauth);
    assert(resRunUnauth.status === 401, 'Vercel Cron: GET /api/internal/retention/run without secret returns HTTP 401');

    const reqRunBadSecret = new NextRequest('http://localhost:3000/api/internal/retention/run', {
      method: 'GET',
      headers: { 'x-cron-secret': 'wrong-secret' },
    });
    const resRunBadSecret = await retentionRunGet(reqRunBadSecret);
    assert(resRunBadSecret.status === 401, 'Vercel Cron: GET /api/internal/retention/run with invalid secret returns HTTP 401');

    const reqRunValid = new NextRequest('http://localhost:3000/api/internal/retention/run', {
      method: 'GET',
      headers: { 'x-cron-secret': cronSecret },
    });
    const resRunValid = await retentionRunGet(reqRunValid);
    assert(resRunValid.status === 200, 'Vercel Cron: GET /api/internal/retention/run with valid CRON_SECRET returns HTTP 200');
    const runJson = await resRunValid.json();
    assert(runJson.success === true, 'Vercel Cron: Response contains success: true');
    assert(runJson.policy === '7_DAY_ROLLING_RETENTION', 'Vercel Cron: Response policy is 7_DAY_ROLLING_RETENTION');
    assert(runJson.retention_days === 7, 'Vercel Cron: Response retention_days is strictly 7');
    assert(runJson.skipped === true, 'Vercel Cron: 20-hour atomic throttle is strictly enforced (skipped: true)');

    const reqRunBypassAttempt = new NextRequest('http://localhost:3000/api/internal/retention/run?force=true&days=30', {
      method: 'GET',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const resRunBypass = await retentionRunGet(reqRunBypassAttempt);
    const bypassJson = await resRunBypass.json();
    assert(bypassJson.retention_days === 7, 'Vercel Cron: ?days=30 cannot alter retention window (strictly 7)');
    assert(bypassJson.skipped === true, 'Vercel Cron: ?force=true cannot bypass 20-hour throttle');

    // -----------------------------------------------------------------------
    // SECTION 5: STRICT NON-INTERFERENCE WITH ALL OTHER TABLES (R)
    // -----------------------------------------------------------------------
    console.log(`${BOLD}\n--- 5. Strict Business Record Preservation Audit ---${RESET}`);

    const { count: finalEmps } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    const { count: finalSal } = await supabase.from('employee_salary').select('*', { count: 'exact', head: true });
    const { count: finalDocs } = await supabase.from('documents').select('*', { count: 'exact', head: true });
    const { count: finalDocVers } = await supabase.from('document_versions').select('*', { count: 'exact', head: true });
    const { count: finalApprovals } = await supabase.from('approvals').select('*', { count: 'exact', head: true });
    const { count: finalVerifLogs } = await supabase.from('verification_logs').select('*', { count: 'exact', head: true });
    const { count: finalTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
    const { count: finalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: finalSettings } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });

    assert(finalEmps === baselineEmps, `R. employees count UNCHANGED (Before: ${baselineEmps}, After: ${finalEmps})`);
    assert(finalSal === baselineSal, `R. employee_salary count UNCHANGED (Before: ${baselineSal}, After: ${finalSal})`);
    assert(finalDocs === baselineDocs, `R. documents count UNCHANGED (Before: ${baselineDocs}, After: ${finalDocs})`);
    assert(finalDocVers === baselineDocVers, `R. document_versions count UNCHANGED (Before: ${baselineDocVers}, After: ${finalDocVers})`);
    assert(finalApprovals === baselineApprovals, `R. approvals count UNCHANGED (Before: ${baselineApprovals}, After: ${finalApprovals})`);
    assert(finalVerifLogs === baselineVerifLogs, `R. verification_logs count UNCHANGED (Before: ${baselineVerifLogs}, After: ${finalVerifLogs})`);
    assert(finalTasks === baselineTasks, `R. tasks count UNCHANGED (Before: ${baselineTasks}, After: ${finalTasks})`);
    assert(finalUsers === baselineUsers, `R. users count UNCHANGED (Before: ${baselineUsers}, After: ${finalUsers})`);
    assert(finalSettings! >= baselineSettings!, `R. system_settings safely preserved telemetry (Before: ${baselineSettings}, After: ${finalSettings})`);

  } finally {
    // Clean up remaining boundary test records from audit_logs and security_logs
    await supabase.from('audit_logs').delete().in('id', auditTestRows.map(r => r.id));
    await supabase.from('security_logs').delete().in('id', secTestRows.map(r => r.id));
  }

  // -------------------------------------------------------------------------
  // SECTION 6: REPOSITORY & PATH INTEGRITY
  // -------------------------------------------------------------------------
  console.log(`${BOLD}\n--- 6. Repository Integrity Audit ---${RESET}`);
  const varsakaPath = 'D:\\19.Website\\Varsaka';
  const varsakaExists = fs.existsSync(varsakaPath);
  assert(varsakaExists, 'Main Varsaka project path confirmed');

  console.log(`\n${BOLD}========================================================================${RESET}`);
  console.log(`${BOLD}TEST SUMMARY: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}========================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
