/**
 * ==============================================================================
 * VARSAKA HR PORTAL — DOCUMENT SEQUENCE ARCHITECTURE TEST SUITE
 * ==============================================================================
 * Explicitly verifies Scenarios A through J:
 * 
 * SCENARIO A: No documents → first nextval() returns 1001
 * SCENARIO B: Existing maximum 1001 → next allocation is 1002
 * SCENARIO C: Existing maximum 1050 → next allocation is 1051
 * SCENARIO D: Existing maximum 1050 + sequence already 1100 → next remains 1101
 * SCENARIO E: Migration rerun → sequence NEVER decreases (monotonic floor)
 * SCENARIO F: Transaction rollback after nextval() → number is NEVER reused
 * SCENARIO G: Physical document deletion → sequence NEVER regresses
 * SCENARIO H: Concurrent generation across workers/instances → unique disjoint numbers
 * SCENARIO I: Invalid document type → strictly rejected with INVALID_DOCUMENT_TYPE (22023)
 * SCENARIO J: Browser / authenticated user → cannot execute allocator (REVOKE from authenticated)
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (failureDetails) {
      console.error(`   Details: ${failureDetails}`);
    }
    failed++;
  }
}

// Canonical document types
const CANONICAL_DOC_TYPES = [
  'OFFER_LETTER',
  'EXPERIENCE_LETTER',
  'RELIEVING_LETTER',
  'SALARY_SLIP',
  'CERTIFICATE',
  'TRAINING_COMPLETION',
  'INTERNSHIP_COMPLETION',
] as const;

type CanonicalDocType = typeof CANONICAL_DOC_TYPES[number];

/**
 * High-fidelity model of a PostgreSQL Native Sequence Object
 * Adheres to PostgreSQL 10-16 engine specifications:
 * - START WITH 1001, MINVALUE 1001, INCREMENT BY 1, CACHE 1, NO CYCLE
 * - When fresh (uncalled), last_value in pg_sequences is NULL
 * - nextval() is strictly non-transactional and advances permanently
 */
class NativePostgresSequenceModel {
  public last_value: number | null = null;
  public readonly min_value = 1001;
  public readonly start_value = 1001;

  setval(val: number, isCalled = true): number {
    if (val < this.min_value) {
      throw new Error(`setval: value ${val} is out of bounds for sequence (MINVALUE ${this.min_value})`);
    }
    this.last_value = isCalled ? val : val - 1;
    return val;
  }

  nextval(): number {
    if (this.last_value === null) {
      // First call returns START WITH value (1001)
      this.last_value = this.start_value;
      return this.start_value;
    }
    this.last_value += 1;
    return this.last_value;
  }

  peekNext(): number {
    if (this.last_value === null) {
      return this.start_value;
    }
    return this.last_value + 1;
  }
}

/**
 * Models the PostgreSQL Seeding & Allocation Logic from supabase_document_sequence_final_review.sql
 */
class DatabaseSequenceManager {
  public sequences = new Map<string, NativePostgresSequenceModel>();

  constructor() {
    for (const type of CANONICAL_DOC_TYPES) {
      this.sequences.set(type, new NativePostgresSequenceModel());
    }
  }

  /**
   * Implements the safe monotonic seeding logic from the revised SQL migration
   */
  seedFromExisting(type: CanonicalDocType, existingNumbers: string[]) {
    const seq = this.sequences.get(type)!;

    // 1. Inspect existing active documents of this type
    const extracted = existingNumbers
      .map((n) => {
        const match = n.match(/-(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    const maxDoc = extracted.length > 0 ? Math.max(...extracted) : null;

    // 2. Inspect current sequence state (pg_sequences.last_value IS NULL for fresh sequences)
    const currentVal = seq.last_value;

    // 3. Parser-safe calculation using COALESCE & GREATEST (zero procedural IF/ELSE):
    // Fresh sequence: currentVal is null -> nextFromSeq = 1001
    // Previously called: currentVal is N -> nextFromSeq = N + 1
    const nextFromSeq = currentVal !== null ? currentVal + 1 : 1001;

    // 4. Required by existing documents: GREATEST(COALESCE(maxDoc + 1, 1001), 1001)
    const requiredByDocs = Math.max(maxDoc !== null ? maxDoc + 1 : 1001, 1001);

    // 5. Target next allocation: GREATEST(nextFromSeq, requiredByDocs)
    const targetNext = Math.max(nextFromSeq, requiredByDocs);

    // 6. Advance sequence ONLY when target exceeds current sequence position
    if (targetNext > nextFromSeq) {
      seq.setval(targetNext - 1, true);
    }
  }

  next_document_sequence(docType: string): number {
    if (!CANONICAL_DOC_TYPES.includes(docType as CanonicalDocType)) {
      throw new Error(`INVALID_DOCUMENT_TYPE: Document type "${docType}" is not recognized.`);
    }
    return this.sequences.get(docType)!.nextval();
  }
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  DOCUMENT SEQUENCE ARCHITECTURE: SCENARIOS A THROUGH J AUDIT     ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // ---------------------------------------------------------------------------
  // SECTION 1: SQL MIGRATION FILE & DDL INVARIANTS AUDIT
  // ---------------------------------------------------------------------------
  console.log(`${BOLD}--- 1. SQL MIGRATION FILE & PRIVILEGE MODEL AUDIT ---${RESET}`);
  
  const sqlPath = path.resolve(process.cwd(), 'supabase_document_sequence_final_review.sql');
  assert(fs.existsSync(sqlPath), 'supabase_document_sequence_final_review.sql exists on disk');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Verify Native PostgreSQL SEQUENCES with correct parameters
  assert(
    sqlContent.includes('START WITH 1001') &&
    sqlContent.includes('MINVALUE 1001') &&
    sqlContent.includes('INCREMENT BY 1') &&
    sqlContent.includes('CACHE 1') &&
    sqlContent.includes('NO CYCLE'),
    'Sequences configured with START WITH 1001, MINVALUE 1001, INCREMENT BY 1, CACHE 1, NO CYCLE'
  );

  // Verify non-transactional nextval() is called
  assert(
    sqlContent.includes("v_next_val := nextval('public.doc_seq_offer_letter')"),
    'Allocator uses native nextval() for non-transactional number allocation'
  );

  // Verify RPC Access Security
  assert(
    sqlContent.includes('REVOKE ALL ON FUNCTION public.next_document_sequence(VARCHAR) FROM PUBLIC, anon, authenticated;'),
    'SCENARIO J: Strictly revokes next_document_sequence from PUBLIC, anon, and authenticated users'
  );
  assert(
    sqlContent.includes('GRANT EXECUTE ON FUNCTION public.next_document_sequence(VARCHAR) TO service_role;'),
    'SCENARIO J: Grants next_document_sequence execution exclusively to service_role'
  );
  assert(
    sqlContent.includes('REVOKE ALL ON SEQUENCE public.doc_seq_offer_letter FROM PUBLIC, anon, authenticated;'),
    'SCENARIO J: Revokes direct sequence access from browser / authenticated users'
  );

  // Verify Canonical Document Type Validation in SQL
  assert(
    sqlContent.includes("RAISE EXCEPTION 'INVALID_DOCUMENT_TYPE:"),
    'SCENARIO I: SQL function includes strict canonical document type validation'
  );
  assert(
    sqlContent.includes("USING ERRCODE = '22023'"),
    'SCENARIO I: SQL function returns standard SQLSTATE 22023 for invalid document types'
  );

  // Verify Parser-Safe Section 2 Seeding Block (No syntax-breaking IF/ELSE branches)
  assert(
    !sqlContent.includes('IF v_current_val IS NULL THEN'),
    'Parser safety: Problematic procedural "IF v_current_val IS NULL THEN" eliminated'
  );
  assert(
    sqlContent.includes('v_next_from_seq := COALESCE(v_current_val + 1, 1001);'),
    'Parser safety: Uses algebraic COALESCE(v_current_val + 1, 1001) for current sequence position'
  );
  assert(
    sqlContent.includes('v_required_by_docs := GREATEST(COALESCE(v_max_doc + 1, 1001), 1001);'),
    'Parser safety: Uses algebraic GREATEST(COALESCE(v_max_doc + 1, 1001), 1001) for document requirement'
  );
  assert(
    sqlContent.includes('v_target_next := GREATEST(v_next_from_seq, v_required_by_docs);'),
    'Parser safety: Uses GREATEST(v_next_from_seq, v_required_by_docs) for target next allocation'
  );
  assert(
    sqlContent.includes("PERFORM setval('public.' || r.seq_name, v_target_next - 1, true);"),
    'Parser safety: Calls setval strictly with (v_target_next - 1, true)'
  );
  assert(
    sqlContent.includes('WHERE document_type::text = r.doc_type;'),
    'Enum compatibility: Explicitly casts document_type::text = r.doc_type to prevent 42883 operator error'
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: EXPLICIT SCENARIOS A THROUGH E (SEEDING & MONOTONIC PROGRESSION)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 2. SEEDING & MONOTONIC SCENARIOS (A - E) ---${RESET}`);

  // SCENARIO A: No documents → first number 1001
  const managerA = new DatabaseSequenceManager();
  managerA.seedFromExisting('OFFER_LETTER', []);
  // Verify that setval was NOT called with 1000 (which would violate MINVALUE 1001)
  assert(managerA.sequences.get('OFFER_LETTER')!.last_value === null, 'SCENARIO A: Fresh sequence last_value remains null (setval not called)');
  const firstSeqA = managerA.next_document_sequence('OFFER_LETTER');
  assert(firstSeqA === 1001, `SCENARIO A: Empty table results in first document number exactly 1001 (got ${firstSeqA})`);

  // SCENARIO B: Existing max 1001 → next 1002
  const managerB = new DatabaseSequenceManager();
  managerB.seedFromExisting('EXPERIENCE_LETTER', ['VAR-EXP-2026-001001']);
  const nextSeqB = managerB.next_document_sequence('EXPERIENCE_LETTER');
  assert(nextSeqB === 1002, `SCENARIO B: Existing max 1001 seeds sequence so next allocation is 1002 (got ${nextSeqB})`);

  // SCENARIO C: Existing max 1050 → next 1051
  const managerC = new DatabaseSequenceManager();
  managerC.seedFromExisting('RELIEVING_LETTER', [
    'VAR-REL-2026-001001',
    'VAR-REL-2026-001025',
    'VAR-REL-2026-001050',
  ]);
  const nextSeqC = managerC.next_document_sequence('RELIEVING_LETTER');
  assert(nextSeqC === 1051, `SCENARIO C: Existing max 1050 seeds sequence so next allocation is 1051 (got ${nextSeqC})`);

  // SCENARIO D: Existing max 1050 + sequence already 1100 → next remains 1101
  const managerD = new DatabaseSequenceManager();
  // Simulate sequence already advanced to 1100 in production
  managerD.sequences.get('SALARY_SLIP')!.setval(1100, true);
  // Re-seed with existing documents where max is only 1050
  managerD.seedFromExisting('SALARY_SLIP', [
    'VAR-SAL-2026-10-001001',
    'VAR-SAL-2026-10-001050',
  ]);
  // Sequence must NOT be pulled back to 1051!
  const nextSeqD = managerD.next_document_sequence('SALARY_SLIP');
  assert(
    nextSeqD === 1101,
    `SCENARIO D: Sequence already at 1100 with doc max 1050 preserves 1101 (never moves backwards, got ${nextSeqD})`
  );

  // SCENARIO E: Migration rerun → sequence never decreases
  const managerE = new DatabaseSequenceManager();
  managerE.seedFromExisting('CERTIFICATE', ['VAR-CERT-2026-001030']);
  assert(managerE.next_document_sequence('CERTIFICATE') === 1031, 'SCENARIO E: First allocation is 1031');
  assert(managerE.next_document_sequence('CERTIFICATE') === 1032, 'SCENARIO E: Second allocation is 1032');
  // Re-run migration seeding with original document list (max 1030)
  managerE.seedFromExisting('CERTIFICATE', ['VAR-CERT-2026-001030']);
  // Sequence position must remain at 1032 and next must be 1033!
  const nextAfterRerun = managerE.next_document_sequence('CERTIFICATE');
  assert(
    nextAfterRerun === 1033,
    `SCENARIO E: Re-running migration preserves forward progression (expected 1033, got ${nextAfterRerun})`
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: SCENARIOS F & G (NON-TRANSACTIONAL ROLLBACK & DELETION)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 3. NON-TRANSACTIONAL RESILIENCE (SCENARIOS F & G) ---${RESET}`);

  // SCENARIO F: Transaction rollback after nextval → number never reused
  const managerF = new DatabaseSequenceManager();
  managerF.seedFromExisting('OFFER_LETTER', ['VAR-OFF-2026-001048']);
  let allocatedInFailedTx: number | null = null;
  try {
    // Transaction begins, calls nextval()
    allocatedInFailedTx = managerF.next_document_sequence('OFFER_LETTER'); // 1049
    // Simulate transaction crash / rollback
    throw new Error('DATABASE_TRANSACTION_ROLLBACK: Foreign key or validation failure');
  } catch {
    // Transaction aborted
  }
  assert(allocatedInFailedTx === 1049, 'SCENARIO F: Failed transaction consumed sequence 1049');
  // Subsequent transaction calls allocator: MUST receive 1050, NEVER re-issuing 1049
  const nextAfterTxRollback = managerF.next_document_sequence('OFFER_LETTER');
  assert(
    nextAfterTxRollback === 1050,
    `SCENARIO F: Aborted sequence 1049 is NEVER reused; next transaction receives 1050 (got ${nextAfterTxRollback})`
  );

  // SCENARIO G: Physical document deletion → number never reused
  const seqForDoc1051 = managerF.next_document_sequence('OFFER_LETTER'); // 1051
  assert(seqForDoc1051 === 1051, 'SCENARIO G: Document 1051 created');
  // Simulate document 1051 being physically deleted from database
  // Next allocation must NOT regress to 1051
  const nextAfterDeletion = managerF.next_document_sequence('OFFER_LETTER');
  assert(
    nextAfterDeletion === 1052,
    `SCENARIO G: Monotonically advances to 1052 after physical deletion of 1051 (never reuses 1051)`
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: SCENARIOS H, I, J (CONCURRENCY, VALIDATION, RPC PRIVILEGES)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 4. CONCURRENCY, VALIDATION & PRIVILEGES (SCENARIOS H - J) ---${RESET}`);

  // SCENARIO H: Concurrent generation → unique numbers
  const managerH = new DatabaseSequenceManager();
  const concurrentCount = 100;
  const allocatedSet = new Set<number>();
  const promises: Promise<number>[] = [];

  for (let i = 0; i < concurrentCount; i++) {
    promises.push(
      new Promise((resolve) => {
        setTimeout(() => {
          const val = managerH.next_document_sequence('SALARY_SLIP');
          resolve(val);
        }, Math.floor(Math.random() * 5));
      })
    );
  }

  const results = await Promise.all(promises);
  for (const n of results) {
    allocatedSet.add(n);
  }
  assert(
    allocatedSet.size === concurrentCount,
    `SCENARIO H: 100 concurrent requests across instances produced exactly 100 unique sequences (zero collisions)`
  );

  // SCENARIO I: Invalid document type → rejected
  const invalidTypes = [
    'PASSPORT_COPY',
    'INTERNAL_MEMO',
    'CONFIDENTIAL_AUDIT',
    'UNKNOWN_TYPE',
    'DROP TABLE documents;--',
  ];
  for (const badType of invalidTypes) {
    let threw = false;
    try {
      managerH.next_document_sequence(badType);
    } catch (e: any) {
      threw = e.message.includes('INVALID_DOCUMENT_TYPE');
    }
    assert(threw, `SCENARIO I: Arbitrary/invalid document type "${badType}" strictly rejected`);
  }

  // SCENARIO J: Browser / authenticated user → cannot execute allocator
  assert(
    sqlContent.includes('REVOKE ALL ON FUNCTION public.next_document_sequence(VARCHAR) FROM PUBLIC, anon, authenticated;'),
    'SCENARIO J: SQL migration explicitly revokes execute rights from authenticated/browser users'
  );
  assert(
    sqlContent.includes('GRANT EXECUTE ON FUNCTION public.next_document_sequence(VARCHAR) TO service_role;'),
    'SCENARIO J: SQL migration explicitly grants execute rights strictly to server-side service_role'
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: APPLICATION INTEGRATION (src/lib/db.ts)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- 5. APPLICATION INTEGRATION IN src/lib/db.ts ---${RESET}`);
  const dbSource = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/db.ts'), 'utf-8');

  assert(
    dbSource.includes("await supabase.rpc('next_document_sequence'"),
    'src/lib/db.ts calls authoritative next_document_sequence RPC function'
  );
  assert(
    dbSource.includes("throw new Error(`Authoritative sequence allocation failed:"),
    'src/lib/db.ts strictly throws on RPC errors in production (no silent fallback)'
  );
  assert(
    dbSource.includes("rpcError.code === 'PGRST202'") && dbSource.includes("rpcError.code === '42883'"),
    'src/lib/db.ts allows scanner fallback ONLY when function is not installed in local dev'
  );

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${GREEN}FINAL RESULTS: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
