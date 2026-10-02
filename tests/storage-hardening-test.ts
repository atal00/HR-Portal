import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { createSupabaseSignedDownloadUrl, SUPABASE_DOCUMENTS_BUCKET } from '../src/lib/storage';
import { ASSETS_BUCKET } from '../src/lib/branding';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[k] = v;
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`, details || '');
  }
}

async function runStorageHardeningTests() {
  console.log('================================================================');
  console.log('PHASE 2A: STORAGE RLS HARDENING AUTOMATED VERIFICATION SUITE');
  console.log('Target Bucket:', SUPABASE_DOCUMENTS_BUCKET);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF');
  const tempFileName = `test-verify-${Date.now()}.pdf`;

  // ---------------------------------------------------------------------------
  // SECTION 1: SUPER_ADMIN & SERVICE ROLE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. Authorized Server-Side / Service Role Operations ---');
  
  // 1.1 Service role upload
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .upload(tempFileName, testPdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
  assert(!uploadError && !!uploadData?.path, 'Service role can upload document artifact', uploadError);

  // 1.2 Service role list
  const { data: adminList, error: listError } = await adminClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .list('', { limit: 10 });
  const uploadedFound = adminList?.some((item) => item.name === tempFileName);
  assert(!listError && uploadedFound === true, 'Service role can list and locate uploaded document', listError);

  // 1.3 Service role signed URL creation
  let signedUrl = '';
  try {
    signedUrl = await createSupabaseSignedDownloadUrl(tempFileName, 300);
    assert(!!signedUrl && signedUrl.includes('token='), 'createSupabaseSignedDownloadUrl generates valid signed URL');
  } catch (err: any) {
    assert(false, 'createSupabaseSignedDownloadUrl threw an error', err.message);
  }

  // 1.4 Verify signed URL accessibility
  if (signedUrl) {
    const signedFetch = await fetch(signedUrl);
    assert(signedFetch.status === 200, 'Signed download URL provides authorized document content (HTTP 200)');
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: ANONYMOUS ACCESS RESTRICTION & ENUMERATION MITIGATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Anonymous Access Denial Verifications ---');

  // 2.1 Anonymous Upload must be REJECTED
  const { data: anonUpData, error: anonUpError } = await anonClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .upload(`anon-${tempFileName}`, testPdf, {
      contentType: 'application/pdf',
      upsert: true,
    });
  assert(
    !!anonUpError || !anonUpData,
    'Anonymous document upload is STRICTLY DENIED (RLS policy violation)',
    anonUpError?.message
  );

  // 2.2 Anonymous Direct Download of existing file must be REJECTED
  const { data: anonDownData, error: anonDownError } = await anonClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .download(tempFileName);
  assert(
    !!anonDownError,
    'Anonymous direct download of private document is STRICTLY DENIED',
    anonDownError?.message
  );

  // 2.3 Anonymous Public URL Access must be BLOCKED (Private Bucket)
  const { data: pubUrlData } = anonClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .getPublicUrl(tempFileName);
  const pubFetch = await fetch(pubUrlData.publicUrl);
  assert(
    pubFetch.status === 400 || pubFetch.status === 403 || pubFetch.status === 404,
    'Anonymous public HTTP access returns 400/403/404 on private bucket (no public URL exposure)'
  );

  // 2.4 Anonymous Delete must be BLOCKED
  const { data: anonDelData, error: anonDelError } = await anonClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .remove([tempFileName]);
  // Verify the file still exists in the bucket
  const { data: postDelCheck } = await adminClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .list('', { limit: 10 });
  const stillExists = postDelCheck?.some((item) => item.name === tempFileName);
  assert(
    stillExists === true,
    'Anonymous delete CANNOT delete protected document artifacts'
  );

  // 2.5 Anonymous Enumeration Check
  const { data: anonList, error: anonListError } = await anonClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .list('', { limit: 10 });
  const anonExposesArtifacts = anonList?.some((item) => item.name === tempFileName) || false;
  assert(
    !anonExposesArtifacts,
    'Anonymous client CANNOT enumerate or view private document artifacts'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: OTHER BUCKETS ISOLATION & INTEGRITY (hr-assets)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Other Storage Buckets Verification (hr-assets) ---');
  const { data: assetBuckets, error: assetErr } = await adminClient.storage
    .from(ASSETS_BUCKET)
    .list('', { limit: 5 });
  assert(!assetErr, 'Server-side access to hr-assets remains functional and unimpacted', assetErr);

  // ---------------------------------------------------------------------------
  // SECTION 4: CLEANUP OF NON-DESTRUCTIVE TEST ARTIFACT
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Test Artifact Cleanup ---');
  const { error: cleanupError } = await adminClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .remove([tempFileName]);
  assert(!cleanupError, 'Temporary verification test artifact cleanly removed', cleanupError);

  // Verify deletion of test artifact
  const { data: finalList } = await adminClient.storage
    .from(SUPABASE_DOCUMENTS_BUCKET)
    .list('', { limit: 10 });
  const gone = !finalList?.some((item) => item.name === tempFileName);
  assert(gone, 'Temporary test artifact confirmed purged from storage');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('================================================================');
}

runStorageHardeningTests().catch(console.error);
