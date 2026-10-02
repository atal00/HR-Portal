'use client';

import React, { useState, useEffect } from 'react';
import { CertificateAccessRequest, Employee } from '@/types/database';
import { Award, UserX, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, FileText, Banknote, ListTodo } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Props {
  userRole: string;
  initialCertRequests?: CertificateAccessRequest[];
  initialPendingEmployees?: Employee[];
}

export function AdminActionAlerts({ userRole, initialCertRequests, initialPendingEmployees }: Props) {
  const [certRequests, setCertRequests] = useState<CertificateAccessRequest[]>(initialCertRequests || []);
  const [pendingEmployees, setPendingEmployees] = useState<Employee[]>(initialPendingEmployees || []);
  const [loading, setLoading] = useState(initialCertRequests === undefined && initialPendingEmployees === undefined);

  // Modal states
  const [rejectCertModal, setRejectCertModal] = useState<CertificateAccessRequest | null>(null);
  const [rejectCertReason, setRejectCertReason] = useState('');
  
  const [employeeApprovalModal, setEmployeeApprovalModal] = useState<Employee | null>(null);
  const [employeeDependencies, setEmployeeDependencies] = useState<{
    documentsCount: number;
    hasSalary: boolean;
    tasksCount: number;
  } | null>(null);
  const [rejectEmpReason, setRejectEmpReason] = useState('');
  const [isRejectingEmp, setIsRejectingEmp] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const loadAlerts = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Parallelize both alert requests
      const [certRes, empRes] = await Promise.all([
        fetch('/api/certificate-requests'),
        fetch('/api/employees'),
      ]);

      if (certRes.ok) {
        const data = await certRes.json();
        const pending = (data.requests || []).filter((r: CertificateAccessRequest) => r.status === 'PENDING');
        setCertRequests(pending);
      }

      if (empRes.ok) {
        const emps: Employee[] = await empRes.json();
        const pendingDel = emps.filter(e => e.deletion_status === 'DELETION_REQUESTED');
        setPendingEmployees(pendingDel);
      }
    } catch (err) {
      console.error('Failed to load admin action alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCertRequests === undefined && initialPendingEmployees === undefined) {
      loadAlerts();
    }
  }, [userRole]);

  // Certificate Request Actions
  const handleApproveCert = async (req: CertificateAccessRequest) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/certificate-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve request.');
      }
      setActionMessage(`Approved certificate access for ${req.user_name}.`);
      loadAlerts();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectCert = async () => {
    if (!rejectCertModal || !rejectCertReason.trim()) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/certificate-requests/${rejectCertModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectCertReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject request.');
      }
      setRejectCertModal(null);
      setRejectCertReason('');
      setActionMessage('Certificate access request rejected.');
      loadAlerts();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Employee Deletion Actions
  const openEmployeeReview = async (emp: Employee) => {
    setEmployeeApprovalModal(emp);
    setIsRejectingEmp(false);
    setRejectEmpReason('');
    try {
      const res = await fetch(`/api/employees/${emp.id}/deletion`);
      if (res.ok) {
        const data = await res.json();
        setEmployeeDependencies({
          documentsCount: data.dependencies?.documentsCount || 0,
          hasSalary: data.dependencies?.hasSalary || false,
          tasksCount: data.dependencies?.tasksCount || 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveEmpDeletion = async (empId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/employees/${empId}/deletion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve employee deletion.');
      }
      setEmployeeApprovalModal(null);
      setActionMessage('Employee deletion approved and marked as deleted.');
      loadAlerts();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectEmpDeletion = async (empId: string) => {
    if (!rejectEmpReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/employees/${empId}/deletion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason: rejectEmpReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject employee deletion.');
      }
      setEmployeeApprovalModal(null);
      setActionMessage('Employee deletion request rejected.');
      loadAlerts();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isSuperAdmin || loading || (certRequests.length === 0 && pendingEmployees.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900">
          {actionMessage}
        </div>
      )}

      {/* Certificate Access Requests Card (Requirement 13E) */}
      {certRequests.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-700" />
              <h2 className="text-sm font-bold text-amber-950">
                Certificate Generation Access Requests ({certRequests.length})
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
              REQUIRES SUPER ADMIN ACTION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {certRequests.map((req) => (
              <div key={req.id} className="bg-white p-4 rounded-xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{req.user_name}</span>
                    <span className="text-slate-500 block text-[11px] font-mono">{req.user_email}</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                    {req.department || 'General'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="font-semibold text-slate-700">Requested Permission:</span> {req.requested_permission}
                  <span className="text-slate-400 block text-[10px] mt-0.5">
                    Requested on: {formatDate(req.created_at)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                      setRejectCertModal(req);
                      setRejectCertReason('');
                    }}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-[11px] font-bold text-slate-700 transition"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApproveCert(req)}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Deletion Requests Card (Requirement 3F) */}
      {pendingEmployees.length > 0 && (
        <div className="bg-red-50/80 border border-red-300 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-red-200 pb-3">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-700" />
              <h2 className="text-sm font-bold text-red-950">
                Pending Employee Deletion Requests ({pendingEmployees.length})
              </h2>
            </div>
            <span className="text-[10px] font-mono font-bold bg-red-200 text-red-900 px-2 py-0.5 rounded">
              SUPER ADMIN APPROVAL REQUIRED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingEmployees.map((emp) => (
              <div key={emp.id} className="bg-white p-4 rounded-xl border border-red-200 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{emp.full_name}</span>
                    <span className="font-mono text-blue-700 font-bold block text-[11px]">{emp.employee_id}</span>
                  </div>
                  <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">
                    DELETION REQUESTED
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 space-y-1">
                  <div><strong>Department:</strong> {emp.department_name || emp.department || '—'}</div>
                  <div><strong>Designation:</strong> {emp.designation}</div>
                  <div className="p-2 bg-red-50/50 rounded border border-red-100 text-red-950 mt-1">
                    <strong>Mandatory Reason:</strong> {emp.deletion_reason || 'No reason provided'}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => openEmployeeReview(emp)}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                  >
                    Review & Decide
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Certificate Modal */}
      {rejectCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Reject Certificate Access Request
            </h3>
            <p className="text-xs text-slate-500">
              Please provide a mandatory justification for rejecting {rejectCertModal.user_name}'s request.
            </p>
            <textarea
              rows={3}
              value={rejectCertReason}
              onChange={(e) => setRejectCertReason(e.target.value)}
              placeholder="State reason for rejection..."
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectCertModal(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectCertReason.trim() || actionLoading}
                onClick={handleRejectCert}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Deletion Review & Approval Modal (Requirement 3F) */}
      {employeeApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Employee Deletion Approval
                </h3>
                <p className="text-xs text-slate-500">
                  Irreversible administrative workflow under strict RBAC governance.
                </p>
              </div>
            </div>

            {/* Detailed employee metadata */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">Employee Name:</span> <strong>{employeeApprovalModal.full_name}</strong></div>
                <div><span className="text-slate-500">Employee ID:</span> <strong className="font-mono">{employeeApprovalModal.employee_id}</strong></div>
                <div><span className="text-slate-500">Department:</span> <strong>{employeeApprovalModal.department_name || employeeApprovalModal.department || '—'}</strong></div>
                <div><span className="text-slate-500">Designation:</span> <strong>{employeeApprovalModal.designation}</strong></div>
                <div><span className="text-slate-500">Requested By:</span> <strong>{employeeApprovalModal.deletion_requested_by || 'HR Admin'}</strong></div>
                <div><span className="text-slate-500">Requested Date:</span> <strong>{formatDate(employeeApprovalModal.deletion_requested_at || employeeApprovalModal.updated_at)}</strong></div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block">Deletion Reason:</span>
                <p className="font-semibold text-red-900 bg-white p-2 rounded border border-red-200 mt-0.5">
                  {employeeApprovalModal.deletion_reason || 'No reason provided'}
                </p>
              </div>
            </div>

            {/* Dependency Check Summary */}
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-xs space-y-2">
              <span className="font-bold text-blue-950 block">Audit & Dependency Verification:</span>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>{employeeDependencies?.documentsCount || 0} Documents</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span>{employeeDependencies?.hasSalary ? 'Salary Bound' : 'No Salary'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100 flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-indigo-600" />
                  <span>{employeeDependencies?.tasksCount || 0} Tasks</span>
                </div>
              </div>
              <p className="text-[10px] text-blue-800">
                All historical documents, salary calculations, and audit logs are securely preserved under controlled soft-delete retention.
              </p>
            </div>

            {/* Warning banner */}
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-xs text-red-900 flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Deleting an employee profile marks the record as DELETED and removes access. Existing employee sequential IDs are NEVER recycled.
              </span>
            </div>

            {isRejectingEmp ? (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">
                  Mandatory Reason for Rejection *
                </label>
                <textarea
                  rows={2}
                  value={rejectEmpReason}
                  onChange={(e) => setRejectEmpReason(e.target.value)}
                  placeholder="State reason for rejecting deletion request..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-600"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRejectingEmp(false)}
                    className="px-3 py-1.5 border rounded-lg text-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!rejectEmpReason.trim() || actionLoading}
                    onClick={() => handleRejectEmpDeletion(employeeApprovalModal.id)}
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
                  onClick={() => setIsRejectingEmp(true)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Reject Request
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEmployeeApprovalModal(null)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApproveEmpDeletion(employeeApprovalModal.id)}
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
