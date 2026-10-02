import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey);
const anon = createClient(supabaseUrl, anonKey);

async function testStorageOperations() {
  console.log('=== TEST 1: Service Role Storage Operations ===');
  const dummyPdf = Buffer.from('%PDF-1.4\n%EOF');
  
  // 1. Admin Upload to hr-documents
  const uploadRes = await admin.storage.from('hr-documents').upload('test-admin-doc.pdf', dummyPdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  console.log('Admin upload:', uploadRes);

  // 2. Admin List hr-documents
  const adminList = await admin.storage.from('hr-documents').list('', { limit: 10 });
  console.log('Admin list count:', adminList.data?.length, 'files:', adminList.data);

  // 3. Admin Signed URL
  const signedRes = await admin.storage.from('hr-documents').createSignedUrl('test-admin-doc.pdf', 60);
  console.log('Admin signed URL generated:', !!signedRes.data?.signedUrl);

  console.log('\n=== TEST 2: Anonymous Storage Operations ===');

  // 1. Anon List
  const anonList = await anon.storage.from('hr-documents').list('', { limit: 10 });
  console.log('Anon list:', anonList);

  // 2. Anon Download existing file
  const anonDownload = await anon.storage.from('hr-documents').download('test-admin-doc.pdf');
  console.log('Anon download of existing file:', anonDownload.error ? `Error: ${anonDownload.error.message}` : 'SUCCESS (LEAK!)');

  // 3. Anon Direct Public URL
  const anonPubUrl = anon.storage.from('hr-documents').getPublicUrl('test-admin-doc.pdf');
  console.log('Anon public URL:', anonPubUrl.data.publicUrl);
  // Fetch public URL to see if it downloads
  const pubFetch = await fetch(anonPubUrl.data.publicUrl);
  console.log('Anon public URL fetch status:', pubFetch.status);

  // 4. Anon Upload (with valid PDF MIME type)
  const anonUpload = await anon.storage.from('hr-documents').upload('test-anon-doc.pdf', dummyPdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  console.log('Anon upload of PDF:', anonUpload.error ? `Error: ${anonUpload.error.message}` : 'SUCCESS (LEAK!)');

  // 5. Anon Delete
  const anonDelete = await anon.storage.from('hr-documents').remove(['test-admin-doc.pdf']);
  console.log('Anon delete of admin file:', anonDelete);

  // Clean up admin test file using admin client
  await admin.storage.from('hr-documents').remove(['test-admin-doc.pdf', 'test-anon-doc.pdf']);
  console.log('\nCleanup finished.');
}

testStorageOperations().catch(console.error);
