'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DocumentRecord } from '@/types/database';
import { SessionUser } from '@/types/auth';
import { canApproveDocument, hasPermission } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { OfferLetterTemplate } from '@/components/documents/OfferLetterTemplate';
import { ExperienceLetterTemplate } from '@/components/documents/ExperienceLetterTemplate';
import { RelievingLetterTemplate } from '@/components/documents/RelievingLetterTemplate';
import { SalarySlipTemplate } from '@/components/documents/SalarySlipTemplate';
import { CertificateTemplate } from '@/components/documents/CertificateTemplate';
import { toast } from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '@/components/ui/Loading';
import {
  FileText,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Printer,
  CopyPlus,
  Ban,
  ExternalLink,
  Lock,
  Layers,
  X,
  AlertCircle
} from 'lucide-react';

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Approval Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Revocation Modal State
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeConfirmed, setRevokeConfirmed] = useState(false);

  // New Version Modal State
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionReason, setVersionReason] = useState('');

  const fetchDoc = async () => {
    try {
      const [docRes, userRes] = await Promise.all([
        fetch(`/api/documents/${id}`),
        fetch('/api/auth/me'),
      ]);
      if (docRes.ok) {
        const data = await docRes.json();
        setDoc(data);
      } else {
        setError('Document record not found');
      }
      if (userRes.ok) {
        const u = await userRes.json();
        const sessionUser: SessionUser | null = u?.user || (u?.id ? u : null);
        setCurrentUser(sessionUser);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDoc();
  }, [id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        toast.success('Document approved successfully.');
        setShowApproveModal(false);
        await fetchDoc();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Approval failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error approving document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
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

    setActionLoading(true);
    setRejectError('');
    try {
      const res = await fetch(`/api/documents/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cleanReason }),
      });
      if (res.ok) {
        toast.success('Document rejected successfully.');
        setShowRejectModal(false);
        await fetchDoc();
      } else {
        const d = await res.json();
        setRejectError(d.error || 'Failed to reject document.');
      }
    } catch (e: any) {
      setRejectError(e.message || 'Error rejecting document.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeConfirmed) {
      toast.error('Please check the confirmation box.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason, confirmation: true }),
      });
      if (res.ok) {
        toast.success('Document revoked successfully.');
        setShowRevokeModal(false);
        await fetchDoc();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Revocation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error revoking document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/new-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDataSnapshot: doc?.data_snapshot,
          reason: versionReason,
        }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        toast.success('New version created successfully.');
        setShowVersionModal(false);
        router.push(`/documents/${newDoc.id}`);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to create new version');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error creating new version');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/download`);
      if (res.ok) {
        const data = await res.json();
        // Trigger browser print or download
        window.print();
      }
    } catch (e) {
      console.error(e);
      window.print();
    }
  };

  if (loading) {
    return (
      <PageLoader
        title="Loading Document Record..."
        subtitle="Retrieving document metadata, cryptographic verification tokens, and rendered preview snapshot."
      />
    );
  }
  if (error || !doc) return <div className="p-12 text-center text-xs text-red-600">{error || 'Document not found'}</div>;

  const isApproved = doc.status === 'APPROVED';
  const isRevoked = doc.status === 'REVOKED';
  const isPending = doc.status === 'PENDING_APPROVAL';

  const verificationUrl = `${window.location.origin}/verify/${doc.verification_id}`;

  const renderTemplate = () => {
    switch (doc.document_type) {
      case 'OFFER_LETTER':
        return (
          <OfferLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'EXPERIENCE_LETTER':
        return (
          <ExperienceLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'RELIEVING_LETTER':
        return (
          <RelievingLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'SALARY_SLIP':
        return (
          <SalarySlipTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'CERTIFICATE':
        return (
          <CertificateTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      default:
        return <div>Unsupported document type</div>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{doc.title}</h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                {doc.document_number}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isApproved ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                isRevoked ? 'bg-red-100 text-red-800 border-red-200' :
                isPending ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700'
              }`}>
                {doc.status}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                v{doc.version_number}.0
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issued for: <strong>{doc.employee_name}</strong> ({doc.employee_code}) • Date: {formatDate(doc.issue_date)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Public Verification Link */}
          <Link
            href={`/verify/${doc.verification_id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition"
          >
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Verify Token</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          {/* Print / Save PDF Preview Flow */}
          <Link
            href={`/documents/${id}/preview`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition shadow-xs"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            <span>Print / PDF</span>
          </Link>

          {/* Workflow Action: Approve & Reject if pending */}
          {isPending && (
            <>
              {currentUser && doc && canApproveDocument(currentUser, doc.document_type) ? (
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve Document</span>
                </button>
              ) : (
                <span
                  title="Approval requires authorized document approval permission (Super Administrator or authorized approver)."
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200 cursor-not-allowed"
                >
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Awaiting Authorized Approval</span>
                </span>
              )}
              {currentUser && hasPermission(currentUser, 'document.reject') && (
                <button
                  onClick={() => {
                    setShowRejectModal(true);
                    setRejectReason('');
                    setRejectError('');
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
              )}
            </>
          )}

          {/* If Approved: Can Create New Version or Revoke */}
          {isApproved && (
            <>
              <button
                onClick={() => setShowVersionModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition shadow-xs"
                title="Create a new immutable revision without overwriting approved version"
              >
                <CopyPlus className="h-4 w-4 text-slate-600" />
                <span>New Version</span>
              </button>

              <button
                onClick={() => setShowRevokeModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold transition"
              >
                <Ban className="h-4 w-4 text-red-600" />
                <span>Revoke</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Revocation Banner if revoked */}
      {isRevoked && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1 no-print">
          <div className="flex items-center gap-2 font-bold text-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>THIS DOCUMENT HAS BEEN REVOKED</span>
          </div>
          <div>Revoked by: <strong>{doc.revoked_by_name}</strong> on {formatDate(doc.revoked_at)}</div>
          <div>Official Justification: <em>"{doc.revocation_reason}"</em></div>
        </div>
      )}

      {/* Document Render Container */}
      <div className="document-outer-container bg-slate-200/80 p-4 md:p-8 rounded-xl border border-slate-300 shadow-inner flex justify-center overflow-x-auto">
        <div className="w-full">
          {renderTemplate()}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* APPROVE DOCUMENT MODAL                                                  */}
      {/* ======================================================================= */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-base border-b border-slate-100 pb-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Approve &amp; Issue Document</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to approve this document? Once approved, the document will be permanently registered, cryptographically sealed, and immutable.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Document Number:</span>
                <span className="font-mono font-bold text-blue-600">{doc.document_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient Employee:</span>
                <span className="font-bold text-slate-900">{doc.employee_name || 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                aria-busy={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading && <LoadingSpinner size="xs" variant="white" label="Approving..." />}
                <span>{actionLoading ? 'Approving...' : 'Confirm Approval'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* REJECT DOCUMENT MODAL                                                   */}
      {/* ======================================================================= */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  Reject Document
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please provide a reason for rejecting this document.
                </p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Document Type:</span>
                <span className="font-semibold text-slate-800">{doc.document_type.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Document Number:</span>
                <span className="font-mono font-bold text-blue-600">{doc.document_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Employee / Candidate Name:</span>
                <span className="font-bold text-slate-900">{doc.employee_name || 'N/A'}</span>
              </div>
            </div>

            {rejectError && (
              <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{rejectError}</span>
              </div>
            )}

            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  placeholder="Enter the reason for rejection..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600 text-slate-900 text-xs"
                />
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Minimum 5 characters required</span>
                  <span>{rejectReason.trim().length} / 500</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || rejectReason.trim().length < 5}
                  aria-busy={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading && <LoadingSpinner size="xs" variant="white" label="Rejecting..." />}
                  <span>{actionLoading ? 'Rejecting...' : 'Reject Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* REVOCATION MODAL                                                        */}
      {/* ======================================================================= */}
      {showRevokeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-600 font-bold text-base border-b border-slate-100 pb-3">
              <Ban className="h-5 w-5" />
              <span>Revoke Official Document</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Revocation is permanent. The document verification status will immediately change to <strong>DOCUMENT REVOKED</strong> across public and internal registries. The audit trail is permanently preserved.
            </p>

            <form onSubmit={handleRevoke} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mandatory Revocation Reason:
                </label>
                <textarea
                  rows={3}
                  required
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Provide precise regulatory or compliance justification for revoking this document..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer p-3 bg-red-50/60 border border-red-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={revokeConfirmed}
                  onChange={(e) => setRevokeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-[11px] text-red-950 font-semibold leading-tight">
                  I understand this action is recorded in immutable security logs and cannot be silently undone.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !revokeConfirmed || revokeReason.length < 5}
                  aria-busy={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading && <LoadingSpinner size="xs" variant="white" label="Revoking..." />}
                  <span>{actionLoading ? 'Revoking...' : 'Confirm Revocation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* NEW VERSION MODAL                                                       */}
      {/* ======================================================================= */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-blue-900 font-bold text-base border-b border-slate-100 pb-3">
              <CopyPlus className="h-5 w-5 text-blue-600" />
              <span>Generate New Document Version</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Approved documents are immutable. Creating a new version preserves the original document intact and creates version <strong>v{doc.version_number + 1}.0</strong> with a new unique Verification ID.
            </p>

            <form onSubmit={handleCreateNewVersion} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Reason for Revision:
                </label>
                <textarea
                  rows={3}
                  required
                  value={versionReason}
                  onChange={(e) => setVersionReason(e.target.value)}
                  placeholder="e.g. Corrected designation nomenclature as per HR reorganization..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || versionReason.length < 5}
                  aria-busy={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {actionLoading && <LoadingSpinner size="xs" variant="white" label="Creating Version..." />}
                  <span>{actionLoading ? 'Creating Version...' : 'Generate New Version'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
