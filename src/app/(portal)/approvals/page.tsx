'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { DocumentRecord } from '@/types/database';
import { SessionUser } from '@/types/auth';
import { canApproveDocument, hasPermission } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  X,
  AlertCircle,
  Filter,
  Trash2,
  Lock
} from 'lucide-react';

type SectionFilter = 'ALL' | 'PAYROLL' | 'OFFER' | 'EXPERIENCE' | 'RELIEVING' | 'CERTIFICATE';

export default function ApprovalsPage() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [pendingDocs, setPendingDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Section Filter State
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('ALL');

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Bulk Approve Modal State
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);

  // Bulk Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Professional Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingDoc, setRejectingDoc] = useState<DocumentRecord | null>(null);
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user and pending queue
  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, docsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/documents?status=PENDING_APPROVAL')
      ]);

      if (userRes.ok) {
        const u = await userRes.json();
        const sessionUser: SessionUser | null = u?.user || (u?.id ? u : null);
        setCurrentUser(sessionUser);
      }

      if (docsRes.ok) {
        const d = await docsRes.json();
        setPendingDocs(Array.isArray(d) ? d : []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load pending approvals queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter pending documents based on selected section
  const filteredDocs = useMemo(() => {
    if (sectionFilter === 'ALL') return pendingDocs;
    if (sectionFilter === 'PAYROLL') return pendingDocs.filter((d) => d.document_type === 'SALARY_SLIP');
    if (sectionFilter === 'OFFER') return pendingDocs.filter((d) => d.document_type === 'OFFER_LETTER');
    if (sectionFilter === 'EXPERIENCE') return pendingDocs.filter((d) => d.document_type === 'EXPERIENCE_LETTER');
    if (sectionFilter === 'RELIEVING') return pendingDocs.filter((d) => d.document_type === 'RELIEVING_LETTER');
    if (sectionFilter === 'CERTIFICATE') return pendingDocs.filter((d) => d.document_type === 'CERTIFICATE');
    return pendingDocs;
  }, [pendingDocs, sectionFilter]);

  // Synchronize selections with active filter
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredDocs.some((d) => d.id === id)));
  }, [sectionFilter, filteredDocs]);

  // Selected document objects
  const selectedDocuments = useMemo(() => {
    return pendingDocs.filter((d) => selectedIds.includes(d.id));
  }, [pendingDocs, selectedIds]);

  // Handle single approval
  const handleApproveSingle = async (doc: DocumentRecord) => {
    if (!currentUser || !canApproveDocument(currentUser, doc.document_type)) {
      toast.error('Forbidden: You do not possess approval authority for this document type.');
      return;
    }

    setActionLoading(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Document ${doc.document_number} approved successfully.`);
        setSelectedIds((prev) => prev.filter((id) => id !== doc.id));
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to approve document.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error approving document.');
    } finally {
      setActionLoading(null);
    }
  };

  // Open single rejection modal
  const handleOpenRejectSingle = (doc: DocumentRecord) => {
    setRejectingDoc(doc);
    setIsBulkReject(false);
    setRejectReason('');
    setRejectError('');
    setRejectModalOpen(true);
  };

  // Open bulk rejection modal
  const handleOpenRejectBulk = () => {
    if (selectedIds.length === 0) return;
    setRejectingDoc(null);
    setIsBulkReject(true);
    setRejectReason('');
    setRejectError('');
    setRejectModalOpen(true);
  };

  // Execute rejection
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = rejectReason.trim();
    if (cleanReason.length < 5) {
      setRejectError('Rejection reason must be at least 5 characters long.');
      return;
    }
    if (cleanReason.length > 500) {
      setRejectError('Rejection reason cannot exceed 500 characters.');
      return;
    }

    setIsSubmitting(true);
    setRejectError('');

    try {
      if (isBulkReject) {
        const res = await fetch('/api/documents/bulk-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'REJECT',
            documentIds: selectedIds,
            reason: cleanReason,
          }),
        });

        const data = await res.json();
        if (res.ok && data.summary) {
          const { succeeded, skipped = 0, failed } = data.summary;
          if (failed === 0 && skipped === 0) {
            toast.success(`Bulk rejection completed: ${succeeded} documents rejected.`);
          } else {
            toast(
              `Bulk rejection: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed.`,
              { icon: failed > 0 ? '⚠️' : 'ℹ️' }
            );
          }
          setRejectModalOpen(false);
          setSelectedIds([]);
          await fetchData();
        } else {
          setRejectError(data.error || 'Bulk rejection failed.');
        }
      } else if (rejectingDoc) {
        const res = await fetch(`/api/documents/${rejectingDoc.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cleanReason }),
        });

        const data = await res.json();
        if (res.ok) {
          toast.success(`Document ${rejectingDoc.document_number} rejected successfully.`);
          setRejectModalOpen(false);
          setSelectedIds((prev) => prev.filter((id) => id !== rejectingDoc.id));
          await fetchData();
        } else {
          setRejectError(data.error || 'Failed to reject document.');
        }
      }
    } catch (err: any) {
      setRejectError(err.message || 'Network error processing rejection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine delete permissions
  const canDelete = currentUser
    ? hasPermission(currentUser, 'document.delete') || currentUser.role === 'SUPER_ADMIN'
    : false;

  // Handle bulk approve confirmation
  const handleConfirmBulkApprove = async () => {
    if (selectedIds.length === 0) return;

    // Check if any selected item is forbidden for the current user
    const unauthorized = selectedDocuments.filter((d) => !canApproveDocument(currentUser, d.document_type));

    if (unauthorized.length > 0) {
      toast.error(`Forbidden: You lack approval permissions for ${unauthorized.length} of the selected documents.`);
      setBulkApproveModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/documents/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE',
          documentIds: selectedIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.summary) {
        const { succeeded, skipped = 0, failed } = data.summary;
        if (failed === 0 && skipped === 0) {
          toast.success(`Bulk approval completed: ${succeeded} documents approved.`);
        } else {
          toast(
            `Bulk approval: ${succeeded} approved, ${skipped} skipped, ${failed} failed.`,
            { icon: failed > 0 ? '⚠️' : 'ℹ️' }
          );
        }
        setBulkApproveModalOpen(false);
        setSelectedIds([]);
        await fetchData();
      } else {
        toast.error(data.error || 'Failed to process bulk approval.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error during bulk approval.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open bulk delete modal
  const handleOpenDeleteBulk = () => {
    if (selectedIds.length === 0) return;
    setDeleteReason('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  // Confirm bulk delete
  const handleConfirmDeleteBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = deleteReason.trim();
    if (cleanReason.length < 3) {
      setDeleteError('A deletion reason of at least 3 characters is mandatory.');
      return;
    }

    setIsSubmitting(true);
    setDeleteError('');

    try {
      const res = await fetch('/api/documents/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          documentIds: selectedIds,
          reason: cleanReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.summary) {
        const { succeeded, skipped = 0, failed } = data.summary;
        if (failed === 0 && skipped === 0) {
          toast.success(`Bulk deletion processed: ${succeeded} documents processed.`);
        } else {
          toast(
            `Bulk deletion: ${succeeded} deleted/revoked, ${skipped} skipped, ${failed} failed.`,
            { icon: failed > 0 ? '⚠️' : 'ℹ️' }
          );
        }
        setDeleteModalOpen(false);
        setSelectedIds([]);
        await fetchData();
      } else {
        setDeleteError(data.error || 'Failed to process bulk deletion.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Network error processing bulk deletion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Selection counts and states for visible/filtered list
  const selectedInFilteredCount = filteredDocs.filter((d) => selectedIds.includes(d.id)).length;
  const isAllSelected = filteredDocs.length > 0 && selectedInFilteredCount === filteredDocs.length;
  const isPartiallySelected = selectedInFilteredCount > 0 && selectedInFilteredCount < filteredDocs.length;

  // Sync indeterminate state to header checkbox element
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredIdSet = new Set(filteredDocs.map((d) => d.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...filteredDocs.map((d) => d.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="h-7 w-7 text-blue-600" />
            Document Approvals Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Section-aware review queue for contracts, letters, certificates, and payroll disbursements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-1.5 rounded-lg text-xs font-bold">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>{pendingDocs.length} Pending Total</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Section Filter & Bulk Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Section Filter Dropdown */}
        <div className="flex items-center gap-2.5">
          <Filter className="h-4 w-4 text-slate-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Document Type:</span>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">All Documents ({pendingDocs.length})</option>
            <option value="PAYROLL">Payroll / Salary Slips ({pendingDocs.filter((d) => d.document_type === 'SALARY_SLIP').length})</option>
            <option value="OFFER">Offer Letters ({pendingDocs.filter((d) => d.document_type === 'OFFER_LETTER').length})</option>
            <option value="EXPERIENCE">Experience Letters ({pendingDocs.filter((d) => d.document_type === 'EXPERIENCE_LETTER').length})</option>
            <option value="RELIEVING">Relieving Certificates ({pendingDocs.filter((d) => d.document_type === 'RELIEVING_LETTER').length})</option>
            <option value="CERTIFICATE">Certificates ({pendingDocs.filter((d) => d.document_type === 'CERTIFICATE').length})</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 w-full sm:w-auto">
            Selected: <strong className="text-slate-900 font-mono text-sm">{selectedIds.length}</strong>
          </span>

          <button
            onClick={() => setBulkApproveModalOpen(true)}
            disabled={selectedIds.length === 0 || isSubmitting}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Approve Selected</span>
          </button>

          <button
            onClick={handleOpenRejectBulk}
            disabled={selectedIds.length === 0 || isSubmitting}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>Reject Selected</span>
          </button>

          {canDelete && (
            <button
              onClick={handleOpenDeleteBulk}
              disabled={selectedIds.length === 0 || isSubmitting}
              className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected</span>
            </button>
          )}
        </div>

      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading pending queue...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Approval Queue Clear</h3>
            <p className="text-xs text-slate-500">
              {sectionFilter === 'ALL'
                ? 'All submitted documents have been reviewed.'
                : `No pending documents found in section: ${sectionFilter}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer" title={isAllSelected ? 'Deselect All' : 'Select All'}>
                      <input
                        type="checkbox"
                        ref={headerCheckboxRef}
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select All"
                        className="h-4 w-4 rounded border border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </th>
                  <th className="px-4 py-3">Document Title &amp; Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Recipient Employee</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Submission Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id);
                  const canApprove = currentUser ? canApproveDocument(currentUser, doc.document_type) : false;
                  const canReject = currentUser ? hasPermission(currentUser, 'document.reject') : false;

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/70 transition ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 w-10 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(doc.id)}
                            aria-label={`Select document ${doc.document_number}`}
                            className="h-4 w-4 rounded border border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{doc.title}</div>
                        <div className="font-mono text-blue-600 font-semibold text-[11px] mt-0.5">
                          {doc.document_number}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{doc.employee_name}</div>
                        <div className="font-mono text-slate-500 text-[10px]">{doc.employee_code}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{doc.created_by_name}</div>
                        <div className="text-[10px] text-slate-400">Initiator</div>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {formatDate(doc.created_at)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Inspect
                          </Link>

                          {canApprove ? (
                            <button
                              onClick={() => handleApproveSingle(doc)}
                              disabled={actionLoading === doc.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-xs disabled:opacity-50 transition cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </button>
                          ) : (
                            <span
                              title="Approval requires authorized document approval permission (Super Administrator or designated Approver)."
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-medium flex items-center gap-1 border border-slate-200 cursor-not-allowed text-[11px]"
                            >
                              <Lock className="h-3 w-3" />
                              Restricted
                            </span>
                          )}

                          {canReject && (
                            <button
                              onClick={() => handleOpenRejectSingle(doc)}
                              disabled={actionLoading === doc.id}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 flex items-center gap-1 disabled:opacity-50 transition cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* PROFESSIONAL REJECTION MODAL (Single & Bulk Support)                    */}
      {/* ======================================================================= */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-rose-600" />
                  {isBulkReject ? `Reject ${selectedIds.length} Selected Documents` : 'Reject Document'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  A mandatory reason must be recorded in the audit trail for this action.
                </p>
              </div>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Context Notice */}
            {!isBulkReject && rejectingDoc && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Document Number:</span>
                  <span className="font-mono font-bold text-blue-600">{rejectingDoc.document_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Title:</span>
                  <span className="font-semibold text-slate-800">{rejectingDoc.title}</span>
                </div>
              </div>
            )}

            {isBulkReject && (
              <div className="space-y-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>You are rejecting <strong>{selectedIds.length}</strong> selected documents at once.</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
                  {selectedDocuments.map((doc) => (
                    <div key={doc.id} className="py-1 flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-800">{doc.document_number}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-500">{doc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejection Form */}
            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mandatory Rejection Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  placeholder="e.g. Salary breakdown adjustment required or missing required approvals."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
                {rejectError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {rejectError}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer text-center"
                >
                  {isSubmitting ? 'Rejecting...' : `Reject ${isBulkReject ? `${selectedIds.length} Documents` : 'Document'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* BULK APPROVAL CONFIRMATION MODAL                                        */}
      {/* ======================================================================= */}
      {bulkApproveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Approve {selectedIds.length} Documents?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm bulk approval for the selected documents.
                </p>
              </div>
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>You are approving <strong>{selectedIds.length}</strong> documents. Each approved record will generate an authoritative audit entry.</span>
            </div>

            {/* Document summary list */}
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="py-1 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-blue-700">{doc.document_number}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({doc.document_type.replace(/_/g, ' ')})</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-amber-600">{doc.status}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkApprove}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer text-center"
              >
                {isSubmitting ? 'Approving...' : `Approve ${selectedIds.length} Documents`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* BULK DELETE CONFIRMATION MODAL                                          */}
      {/* ======================================================================= */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                  Delete {selectedIds.length} Documents?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  A mandatory reason must be recorded in the audit trail for document deletion.
                </p>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                Enterprise Document Lifecycle Enforcement:
              </div>
              <p className="text-[11px] leading-relaxed">
                Pending/Draft records will be physically deleted. Any approved/final records will be safely transitioned to <strong>REVOKED</strong> to preserve audit integrity.
              </p>
            </div>

            {/* Document summary list */}
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="py-1 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-slate-800">{doc.document_number}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({doc.document_type.replace(/_/g, ' ')})</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-600">{doc.status}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleConfirmDeleteBulk} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Reason for deletion <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value);
                    if (deleteError) setDeleteError('');
                  }}
                  placeholder="Enter mandatory deletion reason..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
                {deleteError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !deleteReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer text-center"
                >
                  {isSubmitting ? 'Deleting...' : `Delete ${selectedIds.length} Documents`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
