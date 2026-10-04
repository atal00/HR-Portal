-- ==============================================================================
-- VARSAKA HR PORTAL — FINAL REVIEW: DOCUMENT SEQUENCE HARDENING MIGRATION
-- FILE: supabase_document_sequence_final_review.sql
-- PURPOSE: Enterprise-grade, non-transactional, strictly non-reusable document
--          sequence numbering via PostgreSQL native sequences.
--
-- STATUS: PROPOSED FOR HUMAN / DBA REVIEW ONLY.
-- DO NOT EXECUTE AUTOMATICALLY. DO NOT RUN IN CI/CD WITHOUT EXPLICIT DBA APPROVAL.
--
-- STRICT INVARIANTS ENFORCED:
-- 1. STRICT NEVER-REUSE:
--    Once a document sequence number is allocated via nextval(), it is NEVER
--    reused under ANY circumstances:
--    - Transaction aborts or rolls back (nextval is non-transactional in PostgreSQL).
--    - Document insertion fails (validation, constraint, or network failure).
--    - Document record is physically deleted or purged.
--    - Application, Node.js process, or container restarts.
--    - Serverless cold starts or worker process recycling.
--    - Concurrent generation across multiple browser users or worker instances.
--
-- 2. SAFE MONOTONIC SEEDING (NEVER BACKWARDS):
--    - If no documents exist: sequence remains fresh (first nextval() yields 1001).
--    - If existing documents exist: sequence is set to emit (max_existing + 1).
--    - If sequence is already ahead of existing documents (e.g. sequence=1100,
--      max_docs=1050): sequence is NOT touched (nextval() remains 1101).
--    - Migration re-runs can NEVER decrease any sequence.
--    - Fully consistent with MINVALUE 1001 (never calls setval with 1000).
--
-- 3. RESTRICTED PRIVILEGES (ZERO BROWSER ACCESS):
--    - Function and sequences are strictly REVOKED from PUBLIC, anon, and authenticated.
--    - Granted strictly and exclusively to service_role (server-side API routes).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CREATE DEDICATED NATIVE POSTGRESQL SEQUENCES FOR EACH CANONICAL TYPE
-- ------------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_offer_letter
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_experience_letter
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_relieving_letter
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_salary_slip
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_certificate
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_training_completion
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.doc_seq_internship_completion
    START WITH 1001
    INCREMENT BY 1
    MINVALUE 1001
    NO MAXVALUE
    CACHE 1
    NO CYCLE;

COMMENT ON SEQUENCE public.doc_seq_offer_letter IS 'Monotonic sequence for Offer Letters (VAR-OFF-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_experience_letter IS 'Monotonic sequence for Experience Letters (VAR-EXP-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_relieving_letter IS 'Monotonic sequence for Relieving Letters (VAR-REL-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_salary_slip IS 'Monotonic sequence for Salary Slips (VAR-SAL-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_certificate IS 'Monotonic sequence for Certificates (VAR-CERT-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_training_completion IS 'Monotonic sequence for Training Completion (VAR-TRN-). Non-transactional, never rolls back.';
COMMENT ON SEQUENCE public.doc_seq_internship_completion IS 'Monotonic sequence for Internship Completion (VAR-INT-). Non-transactional, never rolls back.';


-- ------------------------------------------------------------------------------
-- 2. SAFE MONOTONIC SEEDING LOGIC (PREVENTS BACKWARDS DRIFT & BOUND ERRORS)
-- ------------------------------------------------------------------------------

DO $seed$
DECLARE
    r RECORD;
    v_max_doc BIGINT;
    v_current_val BIGINT;
    v_next_from_seq BIGINT;
    v_required_by_docs BIGINT;
    v_target_next BIGINT;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('doc_seq_offer_letter', 'OFFER_LETTER'),
            ('doc_seq_experience_letter', 'EXPERIENCE_LETTER'),
            ('doc_seq_relieving_letter', 'RELIEVING_LETTER'),
            ('doc_seq_salary_slip', 'SALARY_SLIP'),
            ('doc_seq_certificate', 'CERTIFICATE'),
            ('doc_seq_training_completion', 'TRAINING_COMPLETION'),
            ('doc_seq_internship_completion', 'INTERNSHIP_COMPLETION')
        ) AS t(seq_name, doc_type)
    LOOP
        -- 1. Inspect existing active documents of this canonical type.
        -- Using regexp_replace eliminates SQL keyword 'FROM' inside the select list.
        SELECT MAX(NULLIF(regexp_replace(document_number, '^.*-', ''), '')::BIGINT)
        INTO v_max_doc
        FROM public.documents
        WHERE document_type::text = r.doc_type;

        -- 2. Inspect current sequence state from PostgreSQL system view pg_sequences.
        -- When a sequence is newly created and never called, last_value IS NULL in pg_sequences.
        SELECT last_value
        INTO v_current_val
        FROM pg_sequences
        WHERE schemaname = 'public' AND sequencename = r.seq_name;

        -- 3. Calculate sequence position without procedural IF/ELSE:
        -- Fresh sequence: last_value IS NULL -> v_next_from_seq = 1001
        -- Previously called sequence: last_value IS NOT NULL -> v_next_from_seq = last_value + 1
        v_next_from_seq := COALESCE(v_current_val + 1, 1001);

        -- 4. Calculate requirement from existing documents without procedural IF/ELSE:
        -- If no documents or max < 1001 -> 1001; otherwise max_doc + 1
        v_required_by_docs := GREATEST(COALESCE(v_max_doc + 1, 1001), 1001);

        -- 5. Monotonic target next allocation:
        v_target_next := GREATEST(v_next_from_seq, v_required_by_docs);

        -- 6. Advance sequence ONLY when existing document records require moving forward:
        -- If sequence is already ahead or fresh with no docs, setval is skipped.
        -- When called, (v_target_next - 1) is guaranteed >= 1001, strictly satisfying MINVALUE 1001.
        IF v_target_next > v_next_from_seq THEN
            PERFORM setval('public.' || r.seq_name, v_target_next - 1, true);
        END IF;
    END LOOP;
END;
$seed$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 3. CENTRAL ALLOCATOR FUNCTION WITH CANONICAL VALIDATION & SEARCH_PATH HARDENING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_document_sequence(p_document_type VARCHAR)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_val BIGINT;
BEGIN
    -- Strict Canonical Document Type Validation
    CASE p_document_type
        WHEN 'OFFER_LETTER' THEN
            v_next_val := nextval('public.doc_seq_offer_letter');
        WHEN 'EXPERIENCE_LETTER' THEN
            v_next_val := nextval('public.doc_seq_experience_letter');
        WHEN 'RELIEVING_LETTER' THEN
            v_next_val := nextval('public.doc_seq_relieving_letter');
        WHEN 'SALARY_SLIP' THEN
            v_next_val := nextval('public.doc_seq_salary_slip');
        WHEN 'CERTIFICATE' THEN
            v_next_val := nextval('public.doc_seq_certificate');
        WHEN 'TRAINING_COMPLETION' THEN
            v_next_val := nextval('public.doc_seq_training_completion');
        WHEN 'INTERNSHIP_COMPLETION' THEN
            v_next_val := nextval('public.doc_seq_internship_completion');
        ELSE
            RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE: Document type "%" is not recognized. Allowed canonical document types are: OFFER_LETTER, EXPERIENCE_LETTER, RELIEVING_LETTER, SALARY_SLIP, CERTIFICATE, TRAINING_COMPLETION, INTERNSHIP_COMPLETION.', p_document_type
                USING ERRCODE = '22023'; -- SQLSTATE: invalid_parameter_value
    END CASE;

    RETURN v_next_val;
END;
$$;

COMMENT ON FUNCTION public.next_document_sequence(VARCHAR) IS 'Privileged, non-transactional document sequence generator. Callable strictly by service_role.';


-- ------------------------------------------------------------------------------
-- 4. HARDENED PRIVILEGE GRANTS: ZERO DIRECT BROWSER / AUTHENTICATED ACCESS
-- ------------------------------------------------------------------------------

-- Revoke all permissions from PUBLIC, anon, and authenticated users
REVOKE ALL ON FUNCTION public.next_document_sequence(VARCHAR) FROM PUBLIC, anon, authenticated;

-- Grant execution strictly and exclusively to trusted server-side service_role
GRANT EXECUTE ON FUNCTION public.next_document_sequence(VARCHAR) TO service_role;

-- Revoke direct permissions on underlying sequences
REVOKE ALL ON SEQUENCE public.doc_seq_offer_letter FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_experience_letter FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_relieving_letter FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_salary_slip FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_certificate FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_training_completion FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.doc_seq_internship_completion FROM PUBLIC, anon, authenticated;

-- Grant sequence usage exclusively to service_role
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_offer_letter TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_experience_letter TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_relieving_letter TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_salary_slip TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_certificate TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_training_completion TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.doc_seq_internship_completion TO service_role;

COMMIT;
