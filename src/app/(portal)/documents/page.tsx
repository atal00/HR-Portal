'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DocumentRecord, DocumentType, DocumentWorkflowStatus } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  PlusCircle,
  ExternalLink,
  Award,
  Banknote,
  FileSpreadsheet
} from 'lucide-react';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocs();
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by doc number, verification ID, title..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
          />
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
              <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REVOKED">REVOKED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading document registry...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No documents found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Document Number & Type</th>
                  <th className="px-4 py-3">Title & Recipient</th>
                  <th className="px-4 py-3">Verification ID</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900 text-xs">{doc.document_number}</div>
                      <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mt-0.5">
                        {doc.document_type.replace('_', ' ')}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {doc.employee_name} ({doc.employee_code})
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
                          className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold"
                        >
                          Inspect
                        </Link>
                        <Link
                          href={`/verify/${doc.verification_id}`}
                          target="_blank"
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="Public verification preview"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Link>
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
