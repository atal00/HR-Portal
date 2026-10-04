-- ==============================================================================
-- VARSAKA HR PORTAL — PROPOSED DOCUMENT SEQUENCE MIGRATION
-- FILE: supabase_document_sequence_proposed.sql
-- PURPOSE: Atomic, persistent, monotonic sequence counter for document numbers.
--
-- STATUS: PROPOSED FOR HUMAN / DBA REVIEW ONLY.
-- DO NOT EXECUTE AUTOMATICALLY. DO NOT RUN IN CI/CD WITHOUT DBA APPROVAL.
--
-- INVARIANT: Once a document sequence number is issued, it must NEVER be reused,
-- even if:
--   1. The document record is physically deleted or archived.
--   2. The Node.js application or container restarts.
--   3. Multiple serverless or container instances run concurrently.
--   4. Concurrent requests create documents at the exact same millisecond.
-- ==============================================================================

BEGIN;

-- 1. Create dedicated persistent sequence table
CREATE TABLE IF NOT EXISTS public.document_sequences (
    document_type VARCHAR(64) PRIMARY KEY,
    last_sequence BIGINT NOT NULL DEFAULT 1000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comment for schema documentation
COMMENT ON TABLE public.document_sequences IS 'Authoritative monotonic sequence tracking per document type to guarantee zero number reuse across physical deletions and restarts.';

-- 2. Seed initial sequences from highest existing document numbers in the registry
INSERT INTO public.document_sequences (document_type, last_sequence, updated_at)
SELECT 
    dt.doc_type,
    COALESCE(
        (
            SELECT MAX(
                CASE 
                    WHEN d.document_number ~ '-[0-9]+$' 
                    THEN SUBSTRING(d.document_number FROM '-([0-9]+)$')::BIGINT 
                    ELSE 1000 
                END
            )
            FROM public.documents d
            WHERE d.document_type = dt.doc_type
        ),
        1000
    ) AS last_sequence,
    NOW()
FROM (
    VALUES 
        ('OFFER_LETTER'),
        ('EXPERIENCE_LETTER'),
        ('RELIEVING_LETTER'),
        ('SALARY_SLIP'),
        ('CERTIFICATE'),
        ('TRAINING_COMPLETION'),
        ('INTERNSHIP_COMPLETION')
) AS dt(doc_type)
ON CONFLICT (document_type) DO UPDATE
SET last_sequence = GREATEST(public.document_sequences.last_sequence, EXCLUDED.last_sequence),
    updated_at = NOW();

-- 3. Enable Row-Level Security
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- 4. Restrict table access: Only service_role can directly access
REVOKE ALL ON TABLE public.document_sequences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.document_sequences TO service_role;

-- 5. Create atomic atomic increment function with search_path hardening
CREATE OR REPLACE FUNCTION public.next_document_sequence(p_document_type VARCHAR)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_sequence BIGINT;
    v_seed_max BIGINT;
BEGIN
    -- Atomic row-level lock and increment via ON CONFLICT ... DO UPDATE RETURNING
    INSERT INTO public.document_sequences (document_type, last_sequence, updated_at)
    VALUES (p_document_type, 1001, NOW())
    ON CONFLICT (document_type) DO UPDATE
    SET last_sequence = public.document_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO v_next_sequence;

    RETURN v_next_sequence;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'next_document_sequence failed for type %: %', p_document_type, SQLERRM;
END;
$$;

-- 6. Permissions for sequence function
REVOKE ALL ON FUNCTION public.next_document_sequence(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_sequence(VARCHAR) TO authenticated, service_role;

COMMIT;
