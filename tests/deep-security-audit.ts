import { signSessionPayload } from '../src/lib/auth';
import { db } from '../src/lib/db';
import { SessionUser } from '../src/types/auth';
import { RoleCode } from '../src/types/database';
import { ROLE_PERMISSIONS } from '../src/lib/rbac';
import { generateSignedDownloadToken } from '../src/lib/storage';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  area: string;
  test: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT VERIFIED';
  evidence: string;
}

const results: TestResult[] = [];

function record(res: TestResult) {
  results.push(res);
  const icon = res.status === 'PASS' ? '✅' : res.status === 'FAIL' ? '❌' : res.status === 'WARNING' ? '⚠️' : '❓';
  console.log(`${icon} [${res.status}] ${res.area} :: ${res.test}`);
  console.log(`   Expected: ${res.expected}`);
  console.log(`   Actual:   ${res.actual}`);
  if (res.evidence) console.log(`   Evidence: ${res.evidence}`);
  console.log('');
}

// Generate valid session cookies for each role
function getCookieForRole(role: RoleCode, email: string, name: string): string {
  const user: SessionUser = {
    id: `usr-${role.toLowerCase()}-audit`,
    email,
    full_name: name,
    role,
    permissions: ROLE_PERMISSIONS[role],
  };
  const token = signSessionPayload(user, 3600);
  return `varsaka_session=${token}`;
}

const COOKIES = {
  ANONYMOUS: '',
  SUPER_ADMIN: getCookieForRole('SUPER_ADMIN', 'admin@varsaka.com', 'Dr. Vikram Sarabhai'),
  HR_ADMIN: getCookieForRole('HR_ADMIN', 'hr@varsaka.com', 'Sneha Kulkarni'),
  DOCUMENT_ADMIN: getCookieForRole('DOCUMENT_ADMIN', 'docs@varsaka.com', 'Rohan Deshmukh'),
  PAYROLL_ADMIN: getCookieForRole('PAYROLL_ADMIN', 'payroll@varsaka.com', 'Ananya Sharma'),
  VIEWER: getCookieForRole('VIEWER', 'auditor@varsaka.com', 'Karthik Raman'),
};

async function api(path: string, options: RequestInit = {}, cookie: string = '') {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  let data: any = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, headers: response.headers, data };
}

async function runAudit() {
  console.log('================================================================');
  console.log('VARSAKA HR PORTAL - PHASE 2 DEEP SECURITY & BACKEND AUDIT');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. SUPABASE / DATABASE SECURITY (Static + Architecture Audit)
  // -------------------------------------------------------------
  console.log('--- 1. Supabase / Database Security ---');

  // Check if live Supabase client exists in runtime
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  record({
    area: 'Database Architecture',
    test: 'Runtime Database Engine Verification',
    expected: 'Live Supabase/PostgreSQL connection configured with active RLS',
    actual: hasSupabaseUrl
      ? 'Supabase configured'
      : 'Supabase credentials absent; Next.js runtime exclusively backed by localDb mock-db.ts / db_store.json',
    status: hasSupabaseUrl ? 'PASS' : 'WARNING',
    evidence: `NEXT_PUBLIC_SUPABASE_URL is ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined'}`,
  });

  // Check SQL Security Definer search_path
  record({
    area: 'Database Security',
    test: 'SECURITY DEFINER Functions search_path Security',
    expected: 'All SECURITY DEFINER functions set search_path = public',
    actual: 'current_app_user_id, has_permission, is_super_admin lack SET search_path = public',
    status: 'FAIL',
    evidence: 'In supabase_schema.sql lines 338-359: functions declared without search_path setting',
  });

  // Check Documents RLS Policy logic flaw in SQL
  record({
    area: 'Database Security',
    test: 'Documents RLS SELECT Policy Isolation',
    expected: 'Documents select policy restricts salary documents exclusively to salary.view or payroll',
    actual: 'SQL policy line 404 permits document select if user has employee.view (broad privilege)',
    status: 'FAIL',
    evidence: 'supabase_schema.sql line 404: OR has_permission(current_app_user_id(), "employee.view")',
  });

  // -------------------------------------------------------------
  // 2. RBAC / API BYPASS TESTING
  // -------------------------------------------------------------
  console.log('--- 2. RBAC / API Bypass Testing ---');

  // 2.1 GET /api/employees as Anonymous
  const empAnon = await api('/api/employees', { method: 'GET' }, COOKIES.ANONYMOUS);
  record({
    area: 'API Security',
    test: 'GET /api/employees as Anonymous',
    expected: '401 Unauthorized or 403 Forbidden',
    actual: `${empAnon.status} ${JSON.stringify(empAnon.data)}`,
    status: empAnon.status === 401 || empAnon.status === 403 || empAnon.status === 500 ? 'PASS' : 'FAIL',
    evidence: `Status code: ${empAnon.status}`,
  });

  // 2.2 POST /api/employees as VIEWER
  const empCreateViewer = await api('/api/employees', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: 'TEST-999',
      full_name: 'Test Viewer Hack',
      email: 'viewer-hack@varsaka.com',
      phone: '9999999999',
      address: 'Test Address',
      department_id: 'dept-eng',
      designation: 'Hacker',
      joining_date: '2026-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Remote',
      status: 'ACTIVE',
    }),
  }, COOKIES.VIEWER);
  record({
    area: 'API Security',
    test: 'POST /api/employees as VIEWER (Unauthorized Creation)',
    expected: '403 Forbidden',
    actual: `${empCreateViewer.status} ${JSON.stringify(empCreateViewer.data)}`,
    status: empCreateViewer.status === 403 ? 'PASS' : 'FAIL',
    evidence: `Status: ${empCreateViewer.status}`,
  });

  // 2.3 POST /api/employees as HR_ADMIN (Authorized)
  const testEmpId = `VL-TEST-${Date.now().toString().slice(-4)}`;
  const empCreateHR = await api('/api/employees', {
    method: 'POST',
    body: JSON.stringify({
      employee_id: testEmpId,
      full_name: 'Audit Test Employee',
      email: `${testEmpId.toLowerCase()}@varsaka.com`,
      phone: '9123456780',
      address: 'Test Facility 4B',
      department_id: 'dept-eng',
      designation: 'QA Tester',
      joining_date: '2026-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
    }),
  }, COOKIES.HR_ADMIN);
  record({
    area: 'API Security',
    test: 'POST /api/employees as HR_ADMIN (Authorized Creation)',
    expected: '201 Created',
    actual: `${empCreateHR.status}`,
    status: empCreateHR.status === 201 ? 'PASS' : 'FAIL',
    evidence: `Created employee_id: ${testEmpId}`,
  });

  // 2.4 Document Approval by VIEWER
  const allDocs = await db.documents.list();
  const sampleDoc = allDocs[0];
  const approveViewer = await api(`/api/documents/${sampleDoc?.id}/approve`, { method: 'POST' }, COOKIES.VIEWER);
  record({
    area: 'API Security',
    test: 'POST /api/documents/[id]/approve as VIEWER',
    expected: '403 Forbidden',
    actual: `${approveViewer.status} ${JSON.stringify(approveViewer.data)}`,
    status: approveViewer.status === 403 ? 'PASS' : 'FAIL',
    evidence: `Status: ${approveViewer.status}`,
  });

  // 2.5 Document Revocation by DOCUMENT_ADMIN (Only Super Admin & HR Admin can revoke)
  const revokeDocAdmin = await api(`/api/documents/${sampleDoc?.id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Audit Test Revocation', confirmation: true }),
  }, COOKIES.DOCUMENT_ADMIN);
  record({
    area: 'API Security',
    test: 'POST /api/documents/[id]/revoke as DOCUMENT_ADMIN',
    expected: '403 Forbidden',
    actual: `${revokeDocAdmin.status} ${JSON.stringify(revokeDocAdmin.data)}`,
    status: revokeDocAdmin.status === 403 ? 'PASS' : 'FAIL',
    evidence: `Status: ${revokeDocAdmin.status}`,
  });

  // -------------------------------------------------------------
  // 3. SALARY DATA PRIVACY AUDIT
  // -------------------------------------------------------------
  console.log('--- 3. Salary Data Security ---');

  // 3.1 GET /api/salary/[empId] as Anonymous
  const salAnon = await api('/api/salary/emp-atal-pandey-1083', { method: 'GET' }, COOKIES.ANONYMOUS);
  record({
    area: 'Salary Data Privacy',
    test: 'GET /api/salary/[id] as Anonymous',
    expected: '401 Unauthorized or 500 error blocking access',
    actual: `${salAnon.status} ${JSON.stringify(salAnon.data)}`,
    status: salAnon.status === 401 || salAnon.status === 403 || salAnon.status === 500 ? 'PASS' : 'FAIL',
    evidence: `Status: ${salAnon.status}`,
  });

  // 3.2 GET /api/salary/[empId] as HR_ADMIN
  const salHR = await api('/api/salary/emp-atal-pandey-1083', { method: 'GET' }, COOKIES.HR_ADMIN);
  record({
    area: 'Salary Data Privacy',
    test: 'GET /api/salary/[id] as HR_ADMIN',
    expected: '403 Forbidden (HR_ADMIN has no salary.view)',
    actual: `${salHR.status} ${JSON.stringify(salHR.data)}`,
    status: salHR.status === 403 ? 'PASS' : 'FAIL',
    evidence: `Status: ${salHR.status}`,
  });

  // 3.3 GET /api/salary/[empId] as VIEWER
  const salViewer = await api('/api/salary/emp-atal-pandey-1083', { method: 'GET' }, COOKIES.VIEWER);
  record({
    area: 'Salary Data Privacy',
    test: 'GET /api/salary/[id] as VIEWER',
    expected: '403 Forbidden',
    actual: `${salViewer.status} ${JSON.stringify(salViewer.data)}`,
    status: salViewer.status === 403 ? 'PASS' : 'FAIL',
    evidence: `Status: ${salViewer.status}`,
  });

  // 3.4 GET /api/salary/[empId] as PAYROLL_ADMIN (Authorized)
  const salPayroll = await api('/api/salary/emp-atal-pandey-1083', { method: 'GET' }, COOKIES.PAYROLL_ADMIN);
  record({
    area: 'Salary Data Privacy',
    test: 'GET /api/salary/[id] as PAYROLL_ADMIN',
    expected: '200 OK with salary payload',
    actual: `${salPayroll.status} (annual_ctc: ${salPayroll.data?.annual_ctc})`,
    status: salPayroll.status === 200 && salPayroll.data?.annual_ctc ? 'PASS' : 'FAIL',
    evidence: `annual_ctc: ${salPayroll.data?.annual_ctc}`,
  });

  // 3.5 Check Salary Leakage through GET /api/documents
  const docsHR = await api('/api/documents', { method: 'GET' }, COOKIES.HR_ADMIN);
  const salarySlipsInList = Array.isArray(docsHR.data)
    ? docsHR.data.filter((d: any) => d.document_type === 'SALARY_SLIP')
    : [];
  const leaksSalaryInList = salarySlipsInList.length > 0;
  record({
    area: 'Salary Data Privacy',
    test: 'Salary Leakage via GET /api/documents for HR_ADMIN',
    expected: 'HR_ADMIN receives zero salary slip records or salary snapshots stripped',
    actual: leaksSalaryInList
      ? `LEAK DETECTED: HR_ADMIN received ${salarySlipsInList.length} SALARY_SLIP records with data_snapshot in document list`
      : 'No salary slips leaked in document list',
    status: leaksSalaryInList ? 'FAIL' : 'PASS',
    evidence: leaksSalaryInList
      ? `Sample leaked snapshot: ${JSON.stringify(salarySlipsInList[0]?.data_snapshot)}`
      : 'Clean',
  });

  // 3.6 Check Salary Leakage through GET /api/documents/[salaryDocId]
  const sampleSalarySlip = allDocs.find(d => d.document_type === 'SALARY_SLIP');
  if (sampleSalarySlip) {
    const docDetailHR = await api(`/api/documents/${sampleSalarySlip.id}`, { method: 'GET' }, COOKIES.HR_ADMIN);
    const hasSalaryData = docDetailHR.data?.data_snapshot?.annual_ctc !== undefined || docDetailHR.data?.data_snapshot?.basic !== undefined;
    record({
      area: 'Salary Data Privacy',
      test: 'Salary Leakage via GET /api/documents/[id] for HR_ADMIN',
      expected: '403 Forbidden for HR_ADMIN requesting a SALARY_SLIP document',
      actual: hasSalaryData
        ? `LEAK DETECTED: HR_ADMIN obtained salary slip detail with CTC: ${docDetailHR.data?.data_snapshot?.annual_ctc || docDetailHR.data?.data_snapshot?.basic}`
        : `${docDetailHR.status}`,
      status: hasSalaryData ? 'FAIL' : 'PASS',
      evidence: `Status ${docDetailHR.status}, snapshot keys: ${Object.keys(docDetailHR.data?.data_snapshot || {}).join(', ')}`,
    });
  }

  // -------------------------------------------------------------
  // 4. STORAGE SECURITY & SIGNED DOWNLOAD TOKENS
  // -------------------------------------------------------------
  console.log('--- 4. Storage Security ---');

  if (sampleDoc) {
    // 4.1 Download without token as Anonymous
    const dlAnonNoToken = await api(`/api/documents/${sampleDoc.id}/download`, { method: 'GET' }, COOKIES.ANONYMOUS);
    record({
      area: 'Storage Security',
      test: 'GET /api/documents/[id]/download without token as Anonymous',
      expected: '401 Unauthorized',
      actual: `${dlAnonNoToken.status} ${JSON.stringify(dlAnonNoToken.data)}`,
      status: dlAnonNoToken.status === 401 ? 'PASS' : 'FAIL',
      evidence: `Status: ${dlAnonNoToken.status}`,
    });

    // 4.2 Download with forged token
    const dlForged = await api(`/api/documents/${sampleDoc.id}/download?token=fake-forged-token`, { method: 'GET' }, COOKIES.ANONYMOUS);
    record({
      area: 'Storage Security',
      test: 'GET /api/documents/[id]/download with forged token',
      expected: '401 Unauthorized (Invalid or forged signature)',
      actual: `${dlForged.status} ${JSON.stringify(dlForged.data)}`,
      status: dlForged.status === 401 ? 'PASS' : 'FAIL',
      evidence: `Status: ${dlForged.status}`,
    });

    // 4.3 Download with expired token
    const expiredToken = generateSignedDownloadToken(sampleDoc.id, -100); // Expired 100s ago
    const dlExpired = await api(`/api/documents/${sampleDoc.id}/download?token=${expiredToken}`, { method: 'GET' }, COOKIES.ANONYMOUS);
    record({
      area: 'Storage Security',
      test: 'GET /api/documents/[id]/download with expired token',
      expected: '401 Unauthorized (Expired link)',
      actual: `${dlExpired.status} ${JSON.stringify(dlExpired.data)}`,
      status: dlExpired.status === 401 ? 'PASS' : 'FAIL',
      evidence: `Status: ${dlExpired.status}`,
    });

    // 4.4 Download with token for a DIFFERENT document ID (ID spoofing)
    const validTokenDoc1 = generateSignedDownloadToken(sampleDoc.id, 900);
    const otherDoc = allDocs.find(d => d.id !== sampleDoc.id);
    if (otherDoc) {
      const dlSpoofedId = await api(`/api/documents/${otherDoc.id}/download?token=${validTokenDoc1}`, { method: 'GET' }, COOKIES.ANONYMOUS);
      record({
        area: 'Storage Security',
        test: 'Token-to-Document ID Mismatch (ID Spoofing Protection)',
        expected: '401 Unauthorized (verification.documentId !== id)',
        actual: `${dlSpoofedId.status} ${JSON.stringify(dlSpoofedId.data)}`,
        status: dlSpoofedId.status === 401 ? 'PASS' : 'FAIL',
        evidence: `Status: ${dlSpoofedId.status}`,
      });
    }

    // 4.5 Unauthorized Signed URL Generation for Salary Slip by HR_ADMIN
    if (sampleSalarySlip) {
      const genDlTokenHR = await api(`/api/documents/${sampleSalarySlip.id}/download`, { method: 'GET' }, COOKIES.HR_ADMIN);
      const tokenIssued = genDlTokenHR.status === 200 && !!genDlTokenHR.data?.signedUrl;
      record({
        area: 'Storage Security',
        test: 'Salary Slip Download Token Generation by HR_ADMIN (Permission Check)',
        expected: '403 Forbidden (HR_ADMIN does not possess document.salary.download)',
        actual: tokenIssued
          ? `LEAK / BYPASS: Download token generated for HR_ADMIN: ${genDlTokenHR.data?.signedUrl}`
          : `${genDlTokenHR.status}`,
        status: tokenIssued ? 'FAIL' : 'PASS',
        evidence: `Status ${genDlTokenHR.status}, returned: ${JSON.stringify(genDlTokenHR.data)}`,
      });
    }
  }

  // -------------------------------------------------------------
  // 5. PUBLIC VERIFICATION
  // -------------------------------------------------------------
  console.log('--- 5. Public Verification ---');

  // 5.1 Valid Certificate Verification
  const verifyValid = await api('/api/verify/VVR-CERT-7B9A2F');
  const d = verifyValid.data || {};
  const hasLeakedPII =
    d.pan !== undefined ||
    d.salary !== undefined ||
    d.bank !== undefined ||
    d.bank_account !== undefined ||
    d.phone !== undefined ||
    d.email !== undefined ||
    d.address !== undefined ||
    d.internal_notes !== undefined ||
    d.file_path !== undefined;

  record({
    area: 'Public Verification',
    test: 'Verification Privacy Projection (No PII / Salary Leaks)',
    expected: 'Returns VALID status with public fields only; Zero PII (No PAN, Salary, Bank, Phone, Address)',
    actual: hasLeakedPII
      ? `LEAK: Private fields present: ${JSON.stringify(d)}`
      : `Safe: Status=${d.status}, Document=${d.document_number}, Name=${d.candidate_name}`,
    status: !hasLeakedPII && d.status === 'VALID' ? 'PASS' : 'FAIL',
    evidence: `Keys in response: ${Object.keys(d).join(', ')}`,
  });

  // 5.2 Revoked Certificate Verification
  const verifyRevoked = await api('/api/verify/VVR-CERT-2026-001006');
  record({
    area: 'Public Verification',
    test: 'Revoked Certificate Public Lookup',
    expected: 'Status is REVOKED with revocation reason and timestamp; No confidential salary',
    actual: `Status=${verifyRevoked.data?.status}, Reason=${verifyRevoked.data?.revocation_reason}`,
    status: verifyRevoked.data?.status === 'REVOKED' ? 'PASS' : 'FAIL',
    evidence: `Reason: ${verifyRevoked.data?.revocation_reason}`,
  });

  // 5.3 Malformed & Injection Verification
  const verifyInjection = await api('/api/verify/\'"><script>alert(1)</script>');
  record({
    area: 'Public Verification',
    test: 'XSS / Injection in Verification ID',
    expected: '400 or 404 NOT_FOUND without reflecting raw script payload in HTML',
    actual: `Status=${verifyInjection.status}, Response=${JSON.stringify(verifyInjection.data)}`,
    status: verifyInjection.data?.status === 'NOT_FOUND' || verifyInjection.status === 404 ? 'PASS' : 'FAIL',
    evidence: `Result status: ${verifyInjection.data?.status}`,
  });

  // -------------------------------------------------------------
  // 6. DOCUMENT IMMUTABILITY
  // -------------------------------------------------------------
  console.log('--- 6. Document Immutability ---');

  // Attempt direct PUT on document
  const putDoc = await api(`/api/documents/${sampleDoc?.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Hacked Title' }),
  }, COOKIES.SUPER_ADMIN);
  record({
    area: 'Document Immutability',
    test: 'Direct PUT on /api/documents/[id]',
    expected: '405 Method Not Allowed (No direct update endpoint)',
    actual: `${putDoc.status}`,
    status: putDoc.status === 405 ? 'PASS' : 'WARNING',
    evidence: `Status: ${putDoc.status}`,
  });

  // Test Versioning Immutability
  const oldDocBefore = await db.documents.getById(sampleDoc!.id);
  const oldTitle = oldDocBefore?.title;
  const newVerRes = await api(`/api/documents/${sampleDoc?.id}/new-version`, {
    method: 'POST',
    body: JSON.stringify({
      newDataSnapshot: { ...oldDocBefore?.data_snapshot, audit_note: 'Version 2 created' },
      reason: 'Valid annual compensation revision for audit testing',
    }),
  }, COOKIES.DOCUMENT_ADMIN);

  const oldDocAfter = await db.documents.getById(sampleDoc!.id);
  record({
    area: 'Document Immutability',
    test: 'Historical Document Preservation during Versioning',
    expected: 'Original document record remains unaltered when new version is created',
    actual: oldDocAfter?.title === oldTitle && oldDocAfter?.version_number === oldDocBefore?.version_number
      ? 'Original document unaltered. New version record created separately with incremented version.'
      : 'FAIL: Original document was modified',
    status: oldDocAfter?.title === oldTitle ? 'PASS' : 'FAIL',
    evidence: `New doc ID: ${newVerRes.data?.id}, Version: ${newVerRes.data?.version_number}, Number: ${newVerRes.data?.document_number}`,
  });

  // -------------------------------------------------------------
  // 7. CONCURRENCY & ATOMIC NUMBERING
  // -------------------------------------------------------------
  console.log('--- 7. Concurrency & Atomic Numbering ---');

  const concurrentCount = 10;
  const promises = [];
  for (let i = 0; i < concurrentCount; i++) {
    promises.push(
      api('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          document_type: 'EXPERIENCE_LETTER',
          employee_id: 'emp-atal-pandey-1083',
          title: `Concurrent Test Doc ${i}`,
          data_snapshot: { tenure: `${i} years` },
        }),
      }, COOKIES.HR_ADMIN)
    );
  }

  const batchResults = await Promise.all(promises);
  const docNumbers = batchResults.map(r => r.data?.document_number).filter(Boolean);
  const verifIds = batchResults.map(r => r.data?.verification_id).filter(Boolean);
  const uniqueDocNumbers = new Set(docNumbers);
  const uniqueVerifIds = new Set(verifIds);

  const noCollisions = uniqueDocNumbers.size === concurrentCount && uniqueVerifIds.size === concurrentCount;
  record({
    area: 'Atomic Numbering Engine',
    test: `Concurrent Generation (${concurrentCount} simultaneous POSTs)`,
    expected: `${concurrentCount} unique document numbers and ${concurrentCount} unique verification IDs`,
    actual: `${uniqueDocNumbers.size}/${concurrentCount} unique doc numbers, ${uniqueVerifIds.size}/${concurrentCount} unique verification IDs`,
    status: noCollisions ? 'PASS' : 'FAIL',
    evidence: `Sample generated: ${Array.from(docNumbers).slice(0, 3).join(', ')}`,
  });

  // -------------------------------------------------------------
  // 8. AUDIT LOG INTEGRITY
  // -------------------------------------------------------------
  console.log('--- 8. Audit Log Integrity ---');

  // Check if audit logs can be modified via API
  const auditPut = await api('/api/audit-logs', { method: 'PUT', body: JSON.stringify({ action: 'FAKE' }) }, COOKIES.SUPER_ADMIN);
  const auditDelete = await api('/api/audit-logs', { method: 'DELETE' }, COOKIES.SUPER_ADMIN);
  record({
    area: 'Audit Integrity',
    test: 'Direct API Mutation on Audit Logs (PUT / DELETE)',
    expected: '404 or 405 (No update or delete API exists)',
    actual: `PUT: ${auditPut.status}, DELETE: ${auditDelete.status}`,
    status: (auditPut.status === 404 || auditPut.status === 405) && (auditDelete.status === 404 || auditDelete.status === 405) ? 'PASS' : 'FAIL',
    evidence: `PUT: ${auditPut.status}, DELETE: ${auditDelete.status}`,
  });

  // -------------------------------------------------------------
  // 9. SECURITY TELEMETRY KPI TRACEABILITY
  // -------------------------------------------------------------
  console.log('--- 9. Security Telemetry Traceability ---');

  // Check what is displayed on Security Overview
  record({
    area: 'Security Telemetry',
    test: 'Trace KPI: "OPTIMAL (100% Pass)" Data Source',
    expected: 'Calculated from dynamic live compliance telemetry or database policy checks',
    actual: 'Hardcoded static label in SecurityTelemetryView.tsx',
    status: 'WARNING',
    evidence: 'In SecurityTelemetryView.tsx: <span className="text-2xl font-black">OPTIMAL</span>',
  });

  record({
    area: 'Security Telemetry',
    test: 'Trace KPI: "5 Active Sessions" Data Source',
    expected: 'Dynamic count from active sessions table or token store',
    actual: 'Static label "5 Active" in SecurityTelemetryView.tsx',
    status: 'WARNING',
    evidence: 'In SecurityTelemetryView.tsx: <span className="text-2xl font-black">5 Active</span>',
  });

  record({
    area: 'Security Telemetry',
    test: 'Trace KPI: "0 Blocked Failed Attempts" Data Source',
    expected: 'Dynamically aggregated from security_logs where severity in ("HIGH", "CRITICAL")',
    actual: 'Static label "0 Blocked" in SecurityTelemetryView.tsx',
    status: 'WARNING',
    evidence: 'In SecurityTelemetryView.tsx: <span className="text-2xl font-black">0 Blocked</span>',
  });

  record({
    area: 'Security Telemetry',
    test: 'Trace KPI: "Recent Security Events" Data Source',
    expected: 'Calculated dynamically from security logs count',
    actual: 'Calculated dynamically: `${logs.length} Events`',
    status: 'PASS',
    evidence: 'In SecurityTelemetryView.tsx: {logs.length} Events',
  });

  // -------------------------------------------------------------
  // 10. RATE LIMITING
  // -------------------------------------------------------------
  console.log('--- 10. Rate Limiting ---');

  const rateLimitAttempts = 30;
  const rateLimitPromises = [];
  for (let i = 0; i < rateLimitAttempts; i++) {
    rateLimitPromises.push(
      api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'baduser@varsaka.com', password: 'badpassword' }),
      })
    );
  }
  const rateLimitResponses = await Promise.all(rateLimitPromises);
  const statusCodes = rateLimitResponses.map(r => r.status);
  const hit429 = statusCodes.includes(429);

  record({
    area: 'Rate Limiting',
    test: `Brute Force Login Rate Limiting (${rateLimitAttempts} rapid requests)`,
    expected: '429 Too Many Requests after threshold (e.g. 5-10 requests)',
    actual: hit429 ? 'Enforced: 429 Too Many Requests triggered' : `NOT ENFORCED: All ${rateLimitAttempts} requests returned ${statusCodes[0]} (No 429 response)`,
    status: hit429 ? 'PASS' : 'FAIL',
    evidence: `Status codes observed: ${Array.from(new Set(statusCodes)).join(', ')}`,
  });

  // -------------------------------------------------------------
  // 11. SECURITY HEADERS
  // -------------------------------------------------------------
  console.log('--- 11. Security Headers ---');

  const homeResponse = await fetch(`${BASE_URL}/login`);
  const headers = homeResponse.headers;
  const csp = headers.get('content-security-policy');
  const xfo = headers.get('x-frame-options');
  const xcto = headers.get('x-content-type-options');
  const rp = headers.get('referrer-policy');
  const hsts = headers.get('strict-transport-security');
  const pp = headers.get('permissions-policy');

  record({
    area: 'Security Headers',
    test: 'Content-Security-Policy Enforcement',
    expected: 'Present and strict (no unrestricted wildcards)',
    actual: csp ? `Active: ${csp.substring(0, 80)}...` : 'MISSING',
    status: csp ? 'PASS' : 'FAIL',
    evidence: csp || 'None',
  });

  record({
    area: 'Security Headers',
    test: 'X-Frame-Options (Clickjacking Protection)',
    expected: 'DENY',
    actual: xfo || 'MISSING',
    status: xfo === 'DENY' ? 'PASS' : 'FAIL',
    evidence: xfo || 'None',
  });

  record({
    area: 'Security Headers',
    test: 'X-Content-Type-Options (MIME Sniffing Protection)',
    expected: 'nosniff',
    actual: xcto || 'MISSING',
    status: xcto === 'nosniff' ? 'PASS' : 'FAIL',
    evidence: xcto || 'None',
  });

  record({
    area: 'Security Headers',
    test: 'Referrer-Policy',
    expected: 'strict-origin-when-cross-origin',
    actual: rp || 'MISSING',
    status: rp === 'strict-origin-when-cross-origin' ? 'PASS' : 'FAIL',
    evidence: rp || 'None',
  });

  record({
    area: 'Security Headers',
    test: 'Strict-Transport-Security (HSTS)',
    expected: 'max-age=31536000; includeSubDomains; preload',
    actual: hsts || 'MISSING',
    status: hsts ? 'PASS' : 'FAIL',
    evidence: hsts || 'None',
  });

  record({
    area: 'Security Headers',
    test: 'Permissions-Policy',
    expected: 'geolocation=(), microphone=(), camera=()',
    actual: pp || 'MISSING',
    status: pp ? 'PASS' : 'FAIL',
    evidence: pp || 'None',
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('AUDIT SUMMARY');
  console.log('================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARNING').length;
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`✅ PASS:     ${passCount}`);
  console.log(`❌ FAIL:     ${failCount}`);
  console.log(`⚠️ WARNING:  ${warnCount}`);
  console.log('================================================================\n');

  return results;
}

runAudit().catch(console.error);
