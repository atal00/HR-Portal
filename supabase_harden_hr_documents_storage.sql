-- ==============================================================================
-- PHASE 2A: HARDEN HR DOCUMENT STORAGE RLS (CORRECTED PRODUCTION MIGRATION)
-- Varsaka HR Document & Verification Portal
-- Project: D:\19.Website\HR_Portal
-- Target Bucket: hr-documents (Private)
-- ==============================================================================
-- IMPORTANT SAFETY NOTICE:
-- 1. NO global table grant changes (NO global REVOKE on storage.objects).
-- 2. Scoped strictly to bucket_id = 'hr-documents'.
-- 3. Does NOT reference non-existent employees.user_id.
-- 4. Uses authoritative schema relationship: employees.email = users.email.
-- 5. Does NOT use USING (TRUE) or expose any other bucket (e.g. hr-assets).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: DROP ANY EXISTING HR-DOCUMENTS POLICIES (IDEMPOTENT CLEANUP)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "hr_documents_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_delete_policy" ON storage.objects;

-- ------------------------------------------------------------------------------
-- STEP 2: ENSURE ROW LEVEL SECURITY IS ACTIVE ON STORAGE.OBJECTS
-- ------------------------------------------------------------------------------
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- STEP 3: CREATE GRANULAR, LEAST-PRIVILEGE RLS POLICIES FOR HR-DOCUMENTS
-- ------------------------------------------------------------------------------

-- 3.1 SELECT POLICY: Least-Privilege Document Read & Download
-- Scoped exclusively to bucket_id = 'hr-documents'.
-- Grants read access ONLY IF:
--   a) Caller is SUPER_ADMIN, OR
--   b) Caller is the legitimate document owner (matching employees.email = users.email), OR
--   c) Caller possesses granular permission for that specific document category.
CREATE POLICY hr_documents_select_policy ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            EXISTS (
                SELECT 1 
                FROM public.documents d
                JOIN public.employees e ON d.employee_id = e.id
                WHERE d.file_path = storage.objects.name
                  AND (
                    -- Document Owner self-access (resolved via authoritative email relation)
                    e.email = (
                        SELECT u.email 
                        FROM public.users u 
                        WHERE u.id = public.current_app_user_id()
                    ) OR
                    -- Granular role-based document access
                    (d.document_type = 'SALARY_SLIP' AND (
                        public.has_permission(public.current_app_user_id(), 'salary.view') OR 
                        public.has_permission(public.current_app_user_id(), 'document.salary.download')
                    )) OR
                    (d.document_type = 'OFFER_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.offer.download')) OR
                    (d.document_type = 'EXPERIENCE_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.experience.download')) OR
                    (d.document_type = 'RELIEVING_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.relieving.download')) OR
                    (d.document_type = 'CERTIFICATE' AND public.has_permission(public.current_app_user_id(), 'document.certificate.download'))
                  )
            )
        )
    );

-- 3.2 INSERT POLICY: Authorized Generation & Uploads
-- Scoped exclusively to bucket_id = 'hr-documents'.
-- Restricts file creation to SUPER_ADMIN or users with specific document creation privileges.
CREATE POLICY hr_documents_insert_policy ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            public.has_permission(public.current_app_user_id(), 'document.offer.create') OR
            public.has_permission(public.current_app_user_id(), 'document.experience.create') OR
            public.has_permission(public.current_app_user_id(), 'document.relieving.create') OR
            public.has_permission(public.current_app_user_id(), 'document.salary.create') OR
            public.has_permission(public.current_app_user_id(), 'document.certificate.create')
        )
    );

-- 3.3 UPDATE POLICY: Document Workflow Modification
-- Scoped exclusively to bucket_id = 'hr-documents'.
-- Restricts file updates to SUPER_ADMIN or users with approval/revocation privileges.
CREATE POLICY hr_documents_update_policy ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            public.has_permission(public.current_app_user_id(), 'document.approve') OR
            public.has_permission(public.current_app_user_id(), 'document.revoke')
        )
    );

-- 3.4 DELETE POLICY: Super Admin Exclusive
-- Scoped exclusively to bucket_id = 'hr-documents'.
-- Only SUPER_ADMIN can physically delete HR document artifacts.
CREATE POLICY hr_documents_delete_policy ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id())
        )
    );

-- ------------------------------------------------------------------------------
-- STEP 4: VERIFICATION QUERY
-- Run after execution to confirm that all 4 policies are active on storage.objects.
-- ------------------------------------------------------------------------------
SELECT 
    policyname, 
    cmd, 
    roles::text, 
    permissive 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE 'hr_documents_%'
ORDER BY policyname;
