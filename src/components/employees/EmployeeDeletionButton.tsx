'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Employee } from '@/types/database';
import { Trash2, AlertTriangle, ShieldCheck, CheckCircle2, ShieldAlert, FileText, Banknote, ListTodo } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Loading';

interface Props {
  employee: Employee;
  userRole: string;
}

export function EmployeeDeletionButton({ employee, userRole }: Props) {
  const router = useRouter();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review modal states for SUPER_ADMIN
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [dependencies, setDependencies] = useState<{
    documentsCount: number;
    retainedDocumentsCount: number;
    draftDocumentsCount: number;
    hasSalary: boolean;
    tasksCount: number;
    tasksTableAvailable: boolean;
    canPurge: boolean;
    blockingReason: string | null;
  } | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [depsError, setDepsError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const isProtected = !!employee.is_system_protected;
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const fetchDependencies = async () => {
    setLoadingDeps(true);
    setDepsError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/deletion`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setDependencies({
          documentsCount: Number(data.documentsCount ?? data.dependencies?.documentsCount ?? 0),
          retainedDocumentsCount: Number(data.retainedDocumentsCount ?? 0),
          draftDocumentsCount: Number(data.draftDocumentsCount ?? 0),
          hasSalary: Boolean(data.hasSalary ?? (data.salaryCount > 0)),
          tasksCount: Number(data.tasksCount ?? data.dependencies?.tasksCount ?? 0),
          tasksTableAvailable: data.tasksTableAvailable === true,
          canPurge: data.canPurge === true,
          blockingReason: data.blockingReason ?? null,
        });
      } else {
        // FAIL CLOSED: On non-200 or failure flag, mark purge unavailable
        const errorMsg = data.error || data.blockingReason || 'Failed to verify deletion prerequisites.';
        setDepsError(errorMsg);
        setDependencies({
          documentsCount: 0,
          retainedDocumentsCount: 0,
          draftDocumentsCount: 0,
          hasSalary: false,
          tasksCount: 0,
          tasksTableAvailable: false,
          canPurge: false,
          blockingReason: errorMsg,
        });
      }
    } catch (err: any) {
      console.error('Error fetching deletion dependencies:', err);
      const errorMsg = err?.message || 'Failed to verify deletion prerequisites due to network error.';
      setDepsError(errorMsg);
      setDependencies({
        documentsCount: 0,
        retainedDocumentsCount: 0,
        draftDocumentsCount: 0,
        hasSalary: false,
        tasksCount: 0,
        tasksTableAvailable: false,
        canPurge: false,
        blockingReason: errorMsg,
      });
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleOpenPurge = async () => {
    setPurgeModalOpen(true);
    setPurgeConfirmation('');
    setError(null);
    setDepsError(null);
    setDependencies(null); // Explicit reset guarantees fail-closed state while loading
    await fetchDependencies();
  };

  // Derived state to distinguish the 4 key conditions (Requirement 8):
  // 1. Missing database prerequisite (tasksTableAvailable === false or error mentions tasks)
  const isTasksMissingFromDeps = !loadingDeps && !!dependencies && dependencies.tasksTableAvailable === false;
  const isTasksMissingFromError = !!error && (error.toLowerCase().includes('tasks') || error.includes('public.tasks'));
  const isPrerequisiteMissing = isTasksMissingFromDeps || isTasksMissingFromError;

  // 2. Official document retention block
  const isRetentionBlocked = !loadingDeps && !!dependencies && dependencies.retainedDocumentsCount > 0;

  // 3. Preflight check API failure
  const isPreflightFailed = !loadingDeps && (!!depsError || (!dependencies && !loadingDeps));

  // Comprehensive fail-closed blocker
  const isBlocked = isProtected || 
                    loadingDeps || 
                    !dependencies || 
                    dependencies.canPurge !== true || 
                    dependencies.tasksTableAvailable !== true || 
                    isRetentionBlocked || 
                    isPrerequisiteMissing ||
                    isPreflightFailed ||
                    !!error;

  const handlePurge = async () => {
    // FAIL-CLOSED DEFENSE-IN-DEPTH:
    // Block submission immediately if blocked, purging, or confirmation mismatch
    if (isBlocked || isPurging || purgeConfirmation !== 'DELETE') {
      return;
    }

    // Explicit prerequisite verification check before dispatching destructive call
    if (!dependencies || dependencies.tasksTableAvailable !== true || dependencies.canPurge !== true) {
      setError('Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.');
      return;
    }

    setIsPurging(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.tasksTableAvailable === false || data.error?.toLowerCase().includes('tasks')) {
          setDependencies(prev => prev ? {
            ...prev,
            tasksTableAvailable: false,
            canPurge: false,
            blockingReason: 'Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.',
          } : null);
        }
        throw new Error(data.error || 'Failed to purge employee record.');
      }
      setPurgeModalOpen(false);
      router.push('/employees');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPurging(false);
    }
  };

  const renderPurgeModal = () => {
    if (!purgeModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl border border-red-300 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-red-950">
                Permanent Employee Data Purge
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Irreversible hard removal of {employee.full_name} ({employee.employee_id}).
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium" data-testid="purge-error-banner">
              {error}
            </div>
          )}

          {loadingDeps && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              Verifying database prerequisites and statutory document retention rules...
            </div>
          )}

          {/* Condition 1: Missing database prerequisite warning (Requirement 2 & 8) */}
          {isPrerequisiteMissing && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1.5" data-testid="tasks-prerequisite-warning">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Database Prerequisite Missing</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-800">
                Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.
              </p>
            </div>
          )}

          {/* Condition 2: Statutory official document retention block (Requirement 8) */}
          {isRetentionBlocked && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-1.5" data-testid="retention-block-warning">
              <div className="font-bold flex items-center gap-1.5 text-rose-950">
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Statutory Document Retention Block</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-rose-800 font-semibold">
                Permanent purge unavailable because official documents are retained for statutory/compliance purposes.
              </p>
              <p className="text-[11px] text-rose-700">
                {dependencies?.blockingReason
                  ? dependencies.blockingReason
                  : `Employee ${employee.employee_id} has ${dependencies?.retainedDocumentsCount} official document(s) in APPROVED, FINAL, or REVOKED status. Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.`}
              </p>
            </div>
          )}

          {/* Condition 3: Preflight API check failure (Requirement 7) */}
          {isPreflightFailed && !isPrerequisiteMissing && (
            <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-1.5" data-testid="preflight-error-warning">
              <div className="font-bold flex items-center gap-1.5 text-red-950">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Prerequisite Verification Failed</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-red-800">
                {depsError || 'Failed to verify deletion prerequisites. For safety, permanent purge is disabled.'}
              </p>
            </div>
          )}

          {/* Condition 4: Other general block reason */}
          {!isPrerequisiteMissing && !isRetentionBlocked && !isPreflightFailed && isBlocked && dependencies?.blockingReason && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Permanent Purge Blocked</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-800">
                {dependencies.blockingReason}
              </p>
            </div>
          )}

          {/* Dependency & Schema Prerequisite Status */}
          {dependencies && (
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Total Docs:</span>
                <span className="font-bold text-slate-800">{dependencies.documentsCount}</span>
                {dependencies.retainedDocumentsCount > 0 && (
                  <span className="text-[10px] text-red-600 block font-semibold">({dependencies.retainedDocumentsCount} Retained)</span>
                )}
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Salary Record:</span>
                <span className="font-bold text-slate-800">{dependencies.hasSalary ? 'Bound' : 'None'}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Tasks Table:</span>
                <span className={`font-bold ${dependencies.tasksTableAvailable ? 'text-emerald-700' : 'text-red-600'}`}>
                  {dependencies.tasksTableAvailable ? 'Installed' : 'Missing'}
                </span>
              </div>
            </div>
          )}

          {/* Explicit explanation of what will and will not be physically deleted */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
            <div>
              <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                What will be physically deleted:
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1 space-y-0.5">
                <li>Employee Profile &amp; Demographics</li>
                <li>Linked Salary &amp; Compensation Records</li>
                <li>Unapproved Working Drafts &amp; Pending Approvals</li>
                <li>Operational Tasks &amp; Metadata</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                What will NOT be deleted / Legal Retention:
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-600 mt-1 space-y-0.5">
                <li>
                  <strong>Official Documents:</strong> Documents with status <span className="font-semibold text-slate-800">APPROVED</span>, <span className="font-semibold text-slate-800">FINAL</span>, or <span className="font-semibold text-slate-800">REVOKED</span> are legally protected. If any exist, employee purge is strictly blocked.
                </li>
                <li>
                  <strong>Compliance History:</strong> Statutory audit trail and security event logs remain permanently preserved.
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              To confirm, type <span className="font-mono font-bold text-red-600">DELETE</span> below:
            </label>
            <input
              type="text"
              disabled={isBlocked || isPurging}
              value={purgeConfirmation}
              onChange={(e) => setPurgeConfirmation(e.target.value)}
              placeholder={
                loadingDeps
                  ? 'Verifying prerequisites...'
                  : isPrerequisiteMissing
                  ? 'Employee purge unavailable — Tasks table not installed'
                  : isRetentionBlocked
                  ? 'Purge blocked — Statutory documents retained'
                  : isPreflightFailed
                  ? 'Purge unavailable — Prerequisite check failed'
                  : isBlocked
                  ? 'Purge currently unavailable'
                  : 'Type DELETE'
              }
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono uppercase tracking-wider outline-none focus:ring-2 focus:ring-red-600 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isPurging}
              onClick={() => setPurgeModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPurging || isBlocked || purgeConfirmation !== 'DELETE'}
              aria-busy={isPurging}
              onClick={handlePurge}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isPurging && <LoadingSpinner size="xs" variant="white" label="Purging..." />}
              <span>{isPurging ? 'Purging...' : 'Permanently Purge Record'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isProtected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        System-Protected Record
      </span>
    );
  }

  if (employee.deletion_status === 'DELETED') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          Record Status: DELETED (Retained for Audit)
        </span>
        {isSuperAdmin && !isProtected && (
          <button
            type="button"
            onClick={handleOpenPurge}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Purge Record
          </button>
        )}
        {renderPurgeModal()}
      </div>
    );
  }

  const handleOpenReview = async () => {
    setReviewModalOpen(true);
    setIsRejecting(false);
    setRejectReason('');
    await fetchDependencies();
  };

  const handleRequestDeletion = async () => {
    if (!reason.trim()) {
      setError('A mandatory reason is required to request employee deletion.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit deletion request.');

      setRequestModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeletion = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/deletion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to approve deletion.');
      }
      setReviewModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeletion = async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}/deletion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to reject deletion.');
      }
      setReviewModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (employee.deletion_status === 'DELETION_REQUESTED') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
          <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
          Deletion Requested (Pending Approval)
        </span>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={handleOpenReview}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            Review Request
          </button>
        )}

        {/* Super Admin Review Modal */}
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
                <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Employee Deletion Review & Decision
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify dependencies and legal audit constraints.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">Employee Name:</span> <strong>{employee.full_name}</strong></div>
                  <div><span className="text-slate-500">Employee ID:</span> <strong className="font-mono">{employee.employee_id}</strong></div>
                  <div><span className="text-slate-500">Department:</span> <strong>{employee.department_name || employee.department || '—'}</strong></div>
                  <div><span className="text-slate-500">Designation:</span> <strong>{employee.designation}</strong></div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block">Deletion Reason:</span>
                  <p className="font-semibold text-red-900 bg-white p-2 rounded border border-red-200 mt-0.5">
                    {employee.deletion_reason || 'No reason provided'}
                  </p>
                </div>
              </div>

              {/* Dependencies info */}
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-xs space-y-2">
                <span className="font-bold text-blue-950 block">Audit & Dependency Verification:</span>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span>{dependencies?.documentsCount || 0} Documents</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>{dependencies?.hasSalary ? 'Salary Bound' : 'No Salary'}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                    <ListTodo className="h-4 w-4 text-indigo-600" />
                    <span>{dependencies?.tasksCount || 0} Tasks</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-900 flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> Deletion is irreversible. The record will be archived under controlled retention.
                </span>
              </div>

              {isRejecting ? (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Mandatory Reason for Rejection *
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="State reason for rejecting deletion..."
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="px-3 py-1.5 border rounded-lg text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!rejectReason.trim() || loading}
                      aria-busy={loading}
                      onClick={handleRejectDeletion}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {loading && <LoadingSpinner size="xs" variant="white" label="Rejecting..." />}
                      <span>{loading ? 'Rejecting...' : 'Confirm Rejection'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Reject Request
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setReviewModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      aria-busy={loading}
                      onClick={handleApproveDeletion}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {loading && <LoadingSpinner size="xs" variant="white" label="Approving..." />}
                      <span>{loading ? 'Approving...' : 'Approve Deletion'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setRequestModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition shadow-2xs"
      >
        <Trash2 className="h-3.5 w-3.5 text-slate-500" />
        <span>Request Deletion</span>
      </button>

      {isSuperAdmin && !isProtected && (
        <button
          type="button"
          onClick={handleOpenPurge}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
          title="Super Administrator Action: Irreversible Permanent Purge"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Permanent Purge</span>
        </button>
      )}

      {renderPurgeModal()}

      {/* Request Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Request Employee Record Deletion
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submits formal deletion request for {employee.full_name} ({employee.employee_id}).
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Mandatory Reason for Deletion *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Employee separation completed, contractual end date reached, duplicate onboarding request..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600"
              />
              <p className="text-[11px] text-slate-500">
                This request will be routed to the Super Administrator for review and formal approval. Records are preserved under legal audit retention.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || !reason.trim()}
                aria-busy={loading}
                onClick={handleRequestDeletion}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {loading && <LoadingSpinner size="xs" variant="white" label="Submitting..." />}
                <span>{loading ? 'Submitting...' : 'Submit Deletion Request'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
