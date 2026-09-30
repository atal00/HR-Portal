'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DocumentRecord } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  ExternalLink,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

export default function ApprovalsPage() {
  const [pendingDocs, setPendingDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents?status=PENDING_APPROVAL');
      if (res.ok) {
        const data = await res.json();
        setPendingDocs(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/documents/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        await fetchPending();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to approve document.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter a rejection reason:');
    if (!reason) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/documents/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await fetchPending();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to reject document.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="h-7 w-7 text-blue-600" />
            Document Approvals Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review submitted contracts, letters, and certificates before final immutable issuance
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-1.5 rounded-lg text-xs font-bold">
          <Clock className="h-4 w-4 text-amber-600" />
          <span>{pendingDocs.length} Pending Review</span>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading pending queue...</div>
        ) : pendingDocs.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Approval Queue Clear</h3>
            <p className="text-xs text-slate-500">All submitted documents have been reviewed and approved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Document Title & Number</th>
                  <th className="px-4 py-3">Recipient Employee</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Submission Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pendingDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{doc.title}</div>
                      <div className="font-mono text-blue-600 font-semibold text-[11px] mt-0.5">
                        {doc.document_number}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        Type: {doc.document_type.replace('_', ' ')}
                      </div>
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
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </Link>
                        <button
                          onClick={() => handleApprove(doc.id)}
                          disabled={actionLoading === doc.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-xs disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(doc.id)}
                          disabled={actionLoading === doc.id}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 flex items-center gap-1 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
