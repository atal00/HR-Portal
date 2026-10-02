import fs from 'fs';
import { performance } from 'perf_hooks';

// Load .env.local
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      if (!process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    }
  }
} catch {}

async function runBenchmark() {
  console.log('====================================================');
  console.log('   VARSAKA HR PORTAL — PERFORMANCE BENCHMARK SUITE   ');
  console.log('====================================================\n');

  const { db } = await import('@/lib/db');
  const { getSupabaseAdminClient } = await import('@/lib/supabase');
  const { signSessionPayload } = await import('@/lib/auth');

  // 1. Measure direct network latency to Supabase
  console.log('--- 1. DIRECT SUPABASE NETWORK ROUND-TRIP LATENCY ---');
  const supabase = getSupabaseAdminClient();
  const pingTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await supabase.from('users').select('id', { count: 'exact', head: true });
    const t1 = performance.now();
    pingTimes.push(t1 - t0);
  }
  const avgPing = pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length;
  console.log(`Pings (5 samples): ${pingTimes.map((t) => t.toFixed(1) + 'ms').join(', ')}`);
  console.log(`Average Supabase Round-Trip Time (RTT): ${avgPing.toFixed(1)}ms\n`);

  // 2. Measure database operations
  console.log('--- 2. DATABASE REPOSITORY OPERATIONS (SUPABASE) ---');

  // Find a test user ID from the database
  const { data: sampleUsers } = await supabase.from('users').select('id, email').limit(1);
  const testUserId = sampleUsers?.[0]?.id;
  const testUserEmail = sampleUsers?.[0]?.email;
  console.log(`Test user: ${testUserEmail} (${testUserId})`);

  let testUser: any = null;
  if (testUserId) {
    // A. users.getById
    const t0 = performance.now();
    const u = await db.users.getById(testUserId);
    testUser = u;
    const t1 = performance.now();
    console.log(`db.users.getById: ${(t1 - t0).toFixed(1)}ms`);

    // B. userCredentials.getByUserId
    const t2 = performance.now();
    await db.userCredentials.getByUserId(testUserId);
    const t3 = performance.now();
    console.log(`db.userCredentials.getByUserId: ${(t3 - t2).toFixed(1)}ms`);

    // C. userMfa.getByUserId
    const t4 = performance.now();
    await db.userMfa.getByUserId(testUserId);
    const t5 = performance.now();
    console.log(`db.userMfa.getByUserId: ${(t5 - t4).toFixed(1)}ms`);
  }

  // D. db.employees.list()
  const t6 = performance.now();
  const emps = await db.employees.list();
  const t7 = performance.now();
  console.log(`db.employees.list (${emps.length} records): ${(t7 - t6).toFixed(1)}ms`);

  // E. db.documents.list()
  const t8 = performance.now();
  const docs = await db.documents.list();
  const t9 = performance.now();
  console.log(`db.documents.list (${docs.length} records): ${(t9 - t8).toFixed(1)}ms`);

  // F. db.auditLogs.list(5)
  const t10 = performance.now();
  const logs = await db.auditLogs.list(5);
  const t11 = performance.now();
  console.log(`db.auditLogs.list(5): ${(t11 - t10).toFixed(1)}ms`);

  // G. db.users.list() [N+1 test]
  const t12 = performance.now();
  const users = await db.users.list();
  const t13 = performance.now();
  console.log(`db.users.list (${users.length} records - CURRENT N+1): ${(t13 - t12).toFixed(1)}ms`);

  // 3. Test Sequential vs Parallel in Dashboard
  console.log('\n--- 3. DASHBOARD SERVER DATA FETCH: SEQUENTIAL VS PARALLEL ---');
  
  // Sequential (Current)
  const s0 = performance.now();
  if (testUserId) await db.users.getById(testUserId);
  if (testUserId) await db.userCredentials.getSessionVersion(testUserId);
  if (testUserId) await db.userMfa.getByUserId(testUserId);
  await db.employees.list();
  await db.documents.list();
  await db.auditLogs.list(5);
  const s1 = performance.now();
  const sequentialTime = s1 - s0;
  console.log(`Current Sequential Execution Time: ${sequentialTime.toFixed(1)}ms`);

  // Parallel (Proposed)
  const p0 = performance.now();
  await Promise.all([
    testUserId ? db.users.getById(testUserId) : Promise.resolve(null),
    testUserId ? db.userMfa.getByUserId(testUserId) : Promise.resolve(null),
    db.employees.list(),
    db.documents.list(),
    db.auditLogs.list(5),
  ]);
  const p1 = performance.now();
  const parallelTime = p1 - p0;
  console.log(`Parallel Execution Time: ${parallelTime.toFixed(1)}ms`);
  console.log(`Improvement: ${(((sequentialTime - parallelTime) / sequentialTime) * 100).toFixed(1)}% faster (${(sequentialTime - parallelTime).toFixed(1)}ms saved per request)\n`);

  // 5. Authenticated Endpoints Benchmark (Local Dev Server)
  console.log('\n--- 5. AUTHENTICATED ENDPOINTS BENCHMARK (LOCAL DEV SERVER) ---');
  if (testUserId && testUserEmail) {
    const sessionToken = signSessionPayload({
      id: testUserId,
      email: testUserEmail,
      full_name: 'System Administrator',
      role: 'SUPER_ADMIN',
      permissions: ['audit.view'],
      session_version: testUser?.session_version ?? 1,
    });
    const authHeaders = {
      Cookie: `varsaka_session=${sessionToken}`,
    };
    const { verifySessionToken } = await import('@/lib/auth');
    console.log('Local verifySessionToken check:', verifySessionToken(sessionToken) ? 'VALID' : 'INVALID');

    // A. /api/auth/me
    try {
      const t0 = performance.now();
      const meRes = await fetch('http://localhost:3000/api/auth/me', { headers: authHeaders });
      const t1 = performance.now();
      console.log(`/api/auth/me: ${(t1 - t0).toFixed(1)}ms (Status: ${meRes.status})`);
    } catch (e: any) {
      console.log(`/api/auth/me error: ${e.message}`);
    }

    // B. /dashboard (RSC / HTML)
    try {
      const t0 = performance.now();
      const dashRes = await fetch('http://localhost:3000/dashboard', { headers: authHeaders });
      const t1 = performance.now();
      console.log(`/dashboard: ${(t1 - t0).toFixed(1)}ms (Status: ${dashRes.status})`);
    } catch (e: any) {
      console.log(`/dashboard error: ${e.message}`);
    }

    // C. /api/documents
    try {
      const t0 = performance.now();
      const docsRes = await fetch('http://localhost:3000/api/documents', { headers: authHeaders });
      const t1 = performance.now();
      console.log(`/api/documents: ${(t1 - t0).toFixed(1)}ms (Status: ${docsRes.status})`);
    } catch (e: any) {
      console.log(`/api/documents error: ${e.message}`);
    }

    // D. /api/employees
    try {
      const t0 = performance.now();
      const empsRes = await fetch('http://localhost:3000/api/employees', { headers: authHeaders });
      const t1 = performance.now();
      console.log(`/api/employees: ${(t1 - t0).toFixed(1)}ms (Status: ${empsRes.status})`);
    } catch (e: any) {
      console.log(`/api/employees error: ${e.message}`);
    }
  }
}

runBenchmark().catch(console.error);
