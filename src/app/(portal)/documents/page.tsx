'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { DocumentRecord, DocumentWorkflowStatus } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Award,
  Trash2,
  AlertTriangle,
  X,
  Clock,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { TableSkeleton, LoadingSpinner } from '@/components/ui/Loading';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Current session user and permissions
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canDelete = currentUser?.role === 'SUPER_ADMIN' || 
    currentUser?.permissions?.includes('document.delete');
  const canRevoke = currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'HR_ADMIN' ||
    currentUser?.permissions?.includes('document.revoke');

  // Single Deletion Modal State
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Bulk Action Modals State
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);

  const [bulkRevokeModalOpen, setBulkRevokeModalOpen] = useState(false);
  const [bulkRevokeReason, setBulkRevokeReason] = useState('');
  const [bulkRevokeError, setBulkRevokeError] = useState<string | null>(null);

  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch((e) => console.error('Failed to load user permissions:', e));
  }, []);

  /**
   * Authoritatively fetches the documents registry from the server.
   * Uses cache: 'no-store' and a timestamp parameter to strictly bypass browser/CDN caches.
   */
  const fetchDocs = useCallback(async (
    queryTerm = search,
    currentType = typeFilter,
    currentStatus = statusFilter
  ): Promise<DocumentRecord[]> => {
    setLoading(true);
    setRefreshError(null);
    try {
      const params = new URLSearchParams();
      const cleanType = currentType !== 'ALL' ? currentType : '';
      const cleanStatus = currentStatus !== 'ALL' ? currentStatus : '';
      const cleanSearch = queryTerm ? queryTerm.trim() : '';

      if (cleanType) params.set('type', cleanType);
      if (cleanStatus) params.set('status', cleanStatus);
      if (cleanSearch) params.set('search', cleanSearch);

      // Cache-busting timestamp to strictly avoid browser / CDN stale cached GET responses
      params.set('_t', Date.now().toString());

      const res = await fetch(`/api/documents?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch documents registry (HTTP ${res.status})`);
      }

      const data: DocumentRecord[] = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDocuments(list);
      setRefreshError(null);
      return list;
    } catch (e: any) {
      console.error('Documents registry fetch error:', e);
      setRefreshError(e.message || 'Failed to refresh documents registry from server.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  // Fully reactive search & filter synchronization:
  // Immediate (0ms) when empty/cleared, debounced (180ms) when typing
  useEffect(() => {
    setCurrentPage(1); // Always reset pagination on search or filter change
    setSelectedIds([]); // Clear selection when search/filter changes
    const delay = search === '' ? 0 : 180;
    const timer = setTimeout(() => {
      fetchDocs(search, typeFilter, statusFilter).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [search, typeFilter, statusFilter, fetchDocs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSelectedIds([]);
    fetchDocs(search, typeFilter, statusFilter).catch(() => {});
  };

  const handleClearSearch = () => {
    setSearch('');
    setCurrentPage(1);
    setSelectedIds([]);
    fetchDocs('', typeFilter, statusFilter).catch(() => {});
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;

    if (!deleteReason.trim()) {
      setDeleteError('A mandatory deletion reason is required.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    const targetId = deleteTarget.id;
    const targetDocNumber = deleteTarget.document_number;

    try {
      const res = await fetch(`/api/documents/${targetId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process document deletion.');
      }

      // Close modal and clear form
      setDeleteTarget(null);
      setDeleteReason('');

      // Re-fetch authoritative registry data from the server/Supabase
      try {
        await fetchDocs(search, typeFilter, statusFilter);
        
        // Guarantee UI never displays physically deleted document even if intermediate network returned stale data
        if (data.action === 'DELETED') {
          setDocuments((prev) => prev.filter((d) => d.id !== targetId && d.document_number !== targetDocNumber));
        }
        toast.success(data.message || 'Document successfully updated.');
      } catch {
        // "If the backend delete succeeds but refresh fails, show an appropriate refresh/error state rather than falsely presenting a fully refreshed registry."
        toast.error('Document was deleted, but refreshing the registry failed. Please click Retry.');
        // Eliminate the deleted document locally so a stale row is never displayed
        if (data.action === 'DELETED') {
          setDocuments((prev) => prev.filter((d) => d.id !== targetId && d.document_number !== targetDocNumber));
        }
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred while deleting document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: DocumentWorkflowStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PENDING_APPROVAL':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'REVOKED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(documents.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedDocs = documents.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );
  const startIndex = documents.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(safeCurrentPage * itemsPerPage, documents.length);

  // Selected documents objects
  const selectedDocuments = useMemo(() => {
    return documents.filter((d) => selectedIds.includes(d.id));
  }, [documents, selectedIds]);

  const protectedSelectedDocs = useMemo(() => {
    return selectedDocuments.filter((d) => ['APPROVED', 'FINAL', 'REVOKED'].includes(d.status));
  }, [selectedDocuments]);

  const deletableSelectedDocs = useMemo(() => {
    return selectedDocuments.filter((d) => !['APPROVED', 'FINAL', 'REVOKED'].includes(d.status));
  }, [selectedDocuments]);

  // Visible docs and selection states for current page
  const visibleDocs = paginatedDocs;
  const selectedInVisibleCount = visibleDocs.filter((d) => selectedIds.includes(d.id)).length;
  const isAllVisibleSelected = visibleDocs.length > 0 && selectedInVisibleCount === visibleDocs.length;
  const isPartiallySelected = selectedInVisibleCount > 0 && selectedInVisibleCount < visibleDocs.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleSet = new Set(visibleDocs.map((d) => d.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const combined = new Set([...selectedIds, ...visibleDocs.map((d) => d.id)]);
      setSelectedIds(Array.from(combined));
    }
  };

  // Bulk Approve handler
  const handleBulkApproveSubmit = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkSubmitting(true);
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
        await fetchDocs(search, typeFilter, statusFilter);
      } else {
        toast.error(data.error || 'Failed to process bulk approval.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing bulk approval.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Bulk Revoke handler
  const handleBulkRevokeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = bulkRevokeReason.trim();
    if (cleanReason.length < 5) {
      setBulkRevokeError('A revocation reason of at least 5 characters is mandatory.');
      return;
    }

    setIsBulkSubmitting(true);
    setBulkRevokeError(null);
    try {
      const res = await fetch('/api/documents/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REVOKE',
          documentIds: selectedIds,
          reason: cleanReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.summary) {
        const { succeeded, skipped = 0, failed } = data.summary;
        if (failed === 0 && skipped === 0) {
          toast.success(`Bulk revocation completed: ${succeeded} documents revoked.`);
        } else {
          toast(
            `Bulk revocation: ${succeeded} revoked, ${skipped} skipped, ${failed} failed.`,
            { icon: failed > 0 ? '⚠️' : 'ℹ️' }
          );
        }
        setBulkRevokeModalOpen(false);
        setBulkRevokeReason('');
        setSelectedIds([]);
        await fetchDocs(search, typeFilter, statusFilter);
      } else {
        setBulkRevokeError(data.error || 'Failed to process bulk revocation.');
      }
    } catch (err: any) {
      setBulkRevokeError(err.message || 'Error processing bulk revocation.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Bulk Delete handler
  const handleBulkDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = bulkDeleteReason.trim();
    if (!cleanReason) {
      setBulkDeleteError('A mandatory deletion reason is required.');
      return;
    }
    if (cleanReason.length < 3) {
      setBulkDeleteError('A deletion reason of at least 3 characters is required.');
      return;
    }

    setIsBulkSubmitting(true);
    setBulkDeleteError(null);
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
        const skippedMsg = skipped === 1 ? '1 protected document skipped' : `${skipped} protected documents skipped`;
        const deletedMsg = `${succeeded} deleted`;
        const failedMsg = `${failed} failed`;

        if (skipped > 0) {
          toast(`${deletedMsg}, ${skippedMsg}, ${failedMsg}.`, {
            icon: failed > 0 ? '⚠️' : 'ℹ️',
          });
        } else if (failed > 0) {
          toast.error(`Bulk deletion: ${deletedMsg}, 0 skipped, ${failedMsg}.`);
        } else {
          toast.success(`Bulk deletion: ${deletedMsg}, 0 skipped, 0 failed.`);
        }
        setBulkDeleteModalOpen(false);
        setBulkDeleteReason('');
        setSelectedIds([]);
        await fetchDocs(search, typeFilter, statusFilter);
      } else {
        setBulkDeleteError(data.error || 'Failed to process bulk deletion.');
      }
    } catch (err: any) {
      setBulkDeleteError(err.message || 'Error processing bulk deletion.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-blue-600" />
            Official Documents Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track, approve, download, and verify official contracts, letters, slips, and certificates
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/documents/offer"
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-xs"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Offer Letter
          </Link>
          <Link
            href="/documents/certificate"
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-xs"
          >
            <Award className="h-3.5 w-3.5" />
            Certificate
          </Link>
        </div>
      </div>

      {/* Refresh Error Alert Banner */}
      {refreshError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{refreshError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDocs(search, typeFilter, statusFilter).catch(() => {})}
            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doc number, verification ID, title..."
            className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Types</option>
              <option value="OFFER_LETTER">Offer Letter</option>
              <option value="EXPERIENCE_LETTER">Experience Letter</option>
              <option value="RELIEVING_LETTER">Relieving Letter</option>
              <option value="SALARY_SLIP">Salary Slip</option>
              <option value="CERTIFICATE">Certificate</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="REVOKED">Revoked</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

      </div>

      {/* Bulk Action Toolbar */}
      <div className="bg-white p-3.5 px-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Selected: <strong className="text-slate-900 font-mono text-sm">{selectedIds.length}</strong>
          </span>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline ml-1 cursor-pointer"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setBulkApproveModalOpen(true)}
            disabled={selectedIds.length === 0 || isBulkSubmitting}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Approve Selected</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBulkRevokeReason('');
              setBulkRevokeError(null);
              setBulkRevokeModalOpen(true);
            }}
            disabled={selectedIds.length === 0 || isBulkSubmitting}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Revoke Selected</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBulkDeleteReason('');
              setBulkDeleteError(null);
              setBulkDeleteModalOpen(true);
            }}
            disabled={selectedIds.length === 0 || isBulkSubmitting}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Selected</span>
          </button>
        </div>
      </div>

      {/* Documents Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {documents.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No documents found matching criteria.
            {search && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-blue-600 hover:text-blue-800 font-semibold underline text-xs"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer" title={isAllVisibleSelected ? 'Deselect All' : 'Select All'}>
                      <input
                        type="checkbox"
                        ref={headerCheckboxRef}
                        checked={isAllVisibleSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select All"
                        className="h-4 w-4 rounded border border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </th>
                  <th className="px-5 py-3">Document Number & Type</th>
                  <th className="px-4 py-3">Title & Recipient</th>
                  <th className="px-4 py-3">Verification ID</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedDocs.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id);
                  return (
                    <tr key={doc.id} className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-blue-50/50' : ''}`}>
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
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900 text-xs">{doc.document_number}</div>
                      <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mt-0.5">
                        {doc.document_type.replace('_', ' ')}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                        <UserIcon className="h-3 w-3 text-slate-400" />
                        {doc.employee_name || 'N/A'} {doc.employee_code ? `(${doc.employee_code})` : ''}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-blue-700 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {doc.verification_id}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {formatDate(doc.issue_date)}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                        >
                          Inspect
                        </Link>
                        <Link
                          href={`/verify/${doc.verification_id}`}
                          target="_blank"
                          className="p-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                          title="Public verification preview"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Link>

                        {/* Protected document status or appropriate lifecycle actions */}
                        {doc.status === 'REVOKED' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs cursor-help select-none"
                            title="REVOKED documents are retained for compliance and cannot be physically deleted."
                          >
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                            Retention Protected
                          </span>
                        ) : doc.status === 'APPROVED' || (doc.status as string) === 'FINAL' ? (
                          <div className="inline-flex items-center gap-1.5">
                            {canRevoke && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds([doc.id]);
                                  setBulkRevokeReason('');
                                  setBulkRevokeError(null);
                                  setBulkRevokeModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-md border border-amber-200 hover:bg-amber-50 text-amber-700 hover:text-amber-800 font-semibold text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                title="Revoke official document"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            )}
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs cursor-help select-none"
                              title="Approved documents are retained for compliance and cannot be physically deleted. Use Revoke to retire."
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Protected
                            </span>
                          </div>
                        ) : (
                          /* Pre-approval / working draft states (PENDING_APPROVAL, REJECTED, etc.) */
                          canDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(doc);
                                setDeleteReason('');
                                setDeleteError(null);
                              }}
                              className="px-2.5 py-1 rounded-md border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-semibold text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
                              title="Delete unapproved document draft"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )
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

        {/* Pagination Footer */}
        {documents.length > itemsPerPage && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">{startIndex}</span> to{' '}
              <span className="font-semibold text-slate-700">{endIndex}</span> of{' '}
              <span className="font-semibold text-slate-700">{documents.length}</span> documents
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs font-semibold text-slate-700 px-1">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Secure Document Deletion Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Delete Official Document?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Administrative authorization and mandatory deletion audit trail required.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document Target Information Card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Document:</span>
                <span className="font-mono font-bold text-slate-900">{deleteTarget.document_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Type:</span>
                <span className="font-semibold text-blue-700 uppercase">{deleteTarget.document_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Employee:</span>
                <span className="font-bold text-slate-900">{deleteTarget.employee_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(deleteTarget.status)}`}>
                  {deleteTarget.status}
                </span>
              </div>
            </div>

            {/* Document Lifecycle Advisory Banner */}
            {deleteTarget.status === 'REVOKED' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Statutory Compliance Retention:</span>
                  REVOKED documents are retained for compliance and cannot be physically deleted.
                </div>
              </div>
            ) : deleteTarget.status === 'APPROVED' || (deleteTarget.status as string) === 'FINAL' ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Enterprise Retention Policy:</span>
                  Approved documents are retained for compliance and cannot be physically deleted. Use Revoke to retire.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                Notice: This unapproved document will be permanently deleted from the active registry. An immutable audit log documenting this deletion will be recorded.
              </div>
            )}

            {/* Error Message */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                {deleteError}
              </div>
            )}

            {/* Deletion Form */}
            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reason for Deletion <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  rows={3}
                  required
                  placeholder="Enter mandatory business reason for deletion or revocation (e.g. Generated with incorrect salary tier / Duplicate draft)..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none resize-none text-slate-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition text-center"
                >
                  Cancel
                </button>
                {['APPROVED', 'FINAL', 'REVOKED'].includes(deleteTarget.status) ? (
                  <button
                    type="button"
                    disabled={true}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    Cannot Delete (Protected)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isDeleting || !deleteReason.trim()}
                    aria-busy={isDeleting}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer text-center"
                  >
                    {isDeleting ? (
                      <>
                        <LoadingSpinner size="xs" variant="white" label="Deleting..." />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Document</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Bulk Approve Confirmation Modal */}
      {bulkApproveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Approve {selectedIds.length} Documents?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Administrative authorization and individual approval validation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              You are approving <strong>{selectedIds.length}</strong> selected documents. Server validation ensures each document is individually authorized and in a valid pending state.
            </div>

            {/* Document summary list */}
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="py-1.5 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-blue-700">{doc.document_number}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({doc.document_type.replace(/_/g, ' ')})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                disabled={isBulkSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkApproveSubmit}
                disabled={isBulkSubmitting}
                aria-busy={isBulkSubmitting}
                className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isBulkSubmitting ? (
                  <>
                    <LoadingSpinner size="xs" variant="white" label="Approving..." />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approve {selectedIds.length} Documents</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Revoke Confirmation Modal */}
      {bulkRevokeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Revoke {selectedIds.length} Documents?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mandatory business justification and audit trail required.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkRevokeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                Enterprise Document Lifecycle Enforcement:
              </div>
              <p className="text-[11px] leading-relaxed">
                Only <strong>APPROVED / finalized</strong> documents will be formally transitioned to <strong>REVOKED</strong>. Documents in other statuses will be skipped. Already revoked documents remain protected.
              </p>
            </div>

            {/* Document summary list */}
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="py-1.5 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{doc.document_number}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({doc.document_type.replace(/_/g, ' ')})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(doc.status)}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>

            {bulkRevokeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                {bulkRevokeError}
              </div>
            )}

            <form onSubmit={handleBulkRevokeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Reason for revocation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bulkRevokeReason}
                  onChange={(e) => {
                    setBulkRevokeReason(e.target.value);
                    if (bulkRevokeError) setBulkRevokeError(null);
                  }}
                  rows={3}
                  required
                  placeholder="Enter mandatory business justification for revocation (minimum 5 characters)..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-slate-800"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkRevokeModalOpen(false)}
                  disabled={isBulkSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkSubmitting || bulkRevokeReason.trim().length < 5}
                  aria-busy={isBulkSubmitting}
                  className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isBulkSubmitting ? (
                    <>
                      <LoadingSpinner size="xs" variant="white" label="Revoking..." />
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Revoke {selectedIds.length} Documents</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Delete {selectedIds.length} Documents?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mandatory deletion reason and audit retention enforcement.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Condition A: All selected documents are protected */}
            {deletableSelectedDocs.length === 0 && protectedSelectedDocs.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5" data-testid="bulk-delete-all-protected-warning">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{protectedSelectedDocs.length} protected document{protectedSelectedDocs.length > 1 ? 's' : ''} cannot be deleted.</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  REVOKED documents are retained for compliance and cannot be physically deleted. APPROVED and FINAL documents are retained under statutory compliance and must be revoked rather than deleted.
                </p>
              </div>
            ) : protectedSelectedDocs.length > 0 ? (
              /* Condition B: Mixed selection */
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5" data-testid="bulk-delete-mixed-warning">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{protectedSelectedDocs.length} protected document{protectedSelectedDocs.length > 1 ? 's' : ''} cannot be deleted and will be skipped.</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Only the <strong>{deletableSelectedDocs.length} eligible unapproved draft document{deletableSelectedDocs.length > 1 ? 's' : ''}</strong> will be physically deleted. Protected documents remain preserved under statutory retention.
                </p>
              </div>
            ) : (
              /* Condition C: All eligible drafts */
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  Enterprise Document Lifecycle Enforcement:
                </div>
                <p className="text-[11px] leading-relaxed">
                  Notice: {deletableSelectedDocs.length} unapproved working draft document{deletableSelectedDocs.length > 1 ? 's' : ''} will be permanently deleted from the registry. An immutable audit log documenting this deletion will be recorded.
                </p>
              </div>
            )}

            {/* Document summary list */}
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
              {selectedDocuments.map((doc) => {
                const isDocProtected = ['APPROVED', 'FINAL', 'REVOKED'].includes(doc.status);
                return (
                  <div key={doc.id} className="py-1.5 flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{doc.document_number}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">({doc.document_type.replace(/_/g, ' ')})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(doc.status)}`}>
                        {doc.status}
                      </span>
                      {isDocProtected ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          Protected (Skipped)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Eligible
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {bulkDeleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
                {bulkDeleteError}
              </div>
            )}

            <form onSubmit={handleBulkDeleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Reason for deletion <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={bulkDeleteReason}
                  onChange={(e) => {
                    setBulkDeleteReason(e.target.value);
                    if (bulkDeleteError) setBulkDeleteError(null);
                  }}
                  rows={3}
                  required
                  placeholder={
                    deletableSelectedDocs.length === 0
                      ? 'Deletion is unavailable: all selected documents are protected under compliance retention.'
                      : 'Enter mandatory business reason for deletion...'
                  }
                  disabled={deletableSelectedDocs.length === 0}
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none resize-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkDeleteModalOpen(false)}
                  disabled={isBulkSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition text-center"
                >
                  Cancel
                </button>
                {deletableSelectedDocs.length === 0 ? (
                  <button
                    type="button"
                    disabled={true}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    Cannot Delete ({protectedSelectedDocs.length} Protected)
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isBulkSubmitting || !bulkDeleteReason.trim()}
                    aria-busy={isBulkSubmitting}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    {isBulkSubmitting ? (
                      <>
                        <LoadingSpinner size="xs" variant="white" label="Deleting..." />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete {deletableSelectedDocs.length} Eligible Document{deletableSelectedDocs.length > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

