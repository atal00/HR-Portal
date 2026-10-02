'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Employee } from '@/types/database';
import { Trash2, AlertTriangle, ShieldCheck, CheckCircle2, ShieldAlert, FileText, Banknote, ListTodo } from 'lucide-react';

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
    hasSalary: boolean;
    tasksCount: number;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const isProtected = !!employee.is_system_protected;
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const handlePurge = async () => {
    if (purgeConfirmation !== 'DELETE') return;
    setIsPurging(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to purge employee record.');
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
        <div className="bg-white rounded-2xl border border-red-300 shadow-2xl max-w-md w-full p-6 space-y-4">
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 text-xs text-red-900 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-red-950">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              What will be permanently deleted:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-800">
              <li>Employee Profile &amp; Demographics</li>
              <li>Linked Salary &amp; Compensation Records</li>
              <li>Generated Documents &amp; Version Attachments</li>
              <li>Operational Tasks &amp; Metadata Store</li>
            </ul>
            <p className="text-[10.5px] text-slate-500 pt-1 border-t border-red-200/60">
              Note: Statutory audit trail and security event logs remain permanently preserved under compliance.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              To confirm, type <span className="font-mono font-bold text-red-600">DELETE</span> below:
            </label>
            <input
              type="text"
              value={purgeConfirmation}
              onChange={(e) => setPurgeConfirmation(e.target.value)}
              placeholder="Type DELETE"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono uppercase tracking-wider outline-none focus:ring-2 focus:ring-red-600"
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
              disabled={isPurging || purgeConfirmation !== 'DELETE'}
              onClick={handlePurge}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {isPurging ? 'Purging...' : 'Permanently Purge Record'}
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
            onClick={() => {
              setPurgeModalOpen(true);
              setPurgeConfirmation('');
              setError(null);
            }}
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
    try {
      const res = await fetch(`/api/employees/${employee.id}/deletion`);
      if (res.ok) {
        const data = await res.json();
        setDependencies({
          documentsCount: data.dependencies?.documentsCount || 0,
          hasSalary: data.dependencies?.hasSalary || false,
          tasksCount: data.dependencies?.tasksCount || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
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
                      onClick={handleRejectDeletion}
                      className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      Confirm Rejection
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
                      onClick={() => setReviewModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleApproveDeletion}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                    >
                      Approve Deletion
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
          onClick={() => {
            setPurgeModalOpen(true);
            setPurgeConfirmation('');
            setError(null);
          }}
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
                onClick={handleRequestDeletion}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Deletion Request'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
