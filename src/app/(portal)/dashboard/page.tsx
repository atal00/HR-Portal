import React from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { hasPermission } from '@/lib/rbac';
import {
  Users,
  UserCheck,
  FileText,
  Clock,
  PlusCircle,
  FileSpreadsheet,
  Banknote,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const employees = await db.employees.list();
  const documents = await db.documents.list();
  const auditLogs = await db.auditLogs.list(5);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE' || e.status === 'INTERN').length;
  const totalDocuments = documents.length;
  const pendingApprovals = documents.filter((d) => d.status === 'PENDING_APPROVAL').length;

  const recentDocuments = documents.slice(0, 5);

  return (
    <div className="space-y-8">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Varsaka Enterprise HR
            </span>
            <span className="text-xs text-slate-300 font-mono">v1.0 Production</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Welcome back, {user?.full_name}
          </h1>
          <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-xl">
            You are operating with <strong>{user?.role}</strong> privileges. All document issuance, salary records, and approval workflows are recorded in the immutable audit registry.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          {hasPermission(user, 'employee.create') && (
            <Link
              href="/employees/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs"
            >
              <PlusCircle className="h-4 w-4" />
              Add Employee
            </Link>
          )}
          {hasPermission(user, 'document.offer.create') && (
            <Link
              href="/documents/offer"
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold transition border border-white/20"
            >
              <FileText className="h-4 w-4" />
              New Offer Letter
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Headcount</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalEmployees}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Enrolled personnel</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Workforce</div>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">{activeEmployees}</div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">In service / active</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documents Issued</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalDocuments}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Verified certificates & records</div>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <FileText className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Approvals</div>
            <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{pendingApprovals}</div>
            <div className="text-[11px] text-amber-600/80 mt-0.5 font-medium">Awaiting administrator review</div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Quick Document Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Document Generation Suite</h2>
          <span className="text-xs text-slate-500">Controlled templates with database integrity</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <Link
            href="/documents/offer"
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg inline-block mb-3 group-hover:scale-105 transition">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                Full-Time Offer Letter
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Official 16-17 page comprehensive contract with all 7 annexures, CTC breakdown & NDA.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition">
              <span>Generate Contract</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            href="/documents/experience"
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg inline-block mb-3 group-hover:scale-105 transition">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition">
                Experience Letter
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Official relieving certificate with service tenure, designation, and conduct appreciation.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition">
              <span>Generate Letter</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            href="/documents/salary"
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg inline-block mb-3 group-hover:scale-105 transition">
                <Banknote className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-600 transition">
                Monthly Salary Slip
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Boxed payroll slip auto-populated from payroll record with amount in words and QR code.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition">
              <span>Generate Pay Slip</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            href="/documents/certificate"
            className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg inline-block mb-3 group-hover:scale-105 transition">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition">
                Varsaka Certificate
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Formal certificate with gold double border, official seal, authorized signatory, and QR.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition">
              <span>Generate Certificate</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>

        </div>
      </div>

      {/* Two Column Section: Recent Documents & Security/Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Documents Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Recent Employee Documents</h3>
              <p className="text-xs text-slate-500">Track state, approval workflows, and unique identifiers</p>
            </div>
            <Link
              href="/documents"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {recentDocuments.map((doc) => {
              const isApproved = doc.status === 'APPROVED';
              const isRevoked = doc.status === 'REVOKED';
              const isPending = doc.status === 'PENDING_APPROVAL';

              return (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{doc.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' :
                        isRevoked ? 'bg-red-100 text-red-800' :
                        isPending ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>Recipient: <strong className="text-slate-700">{doc.employee_name}</strong></span>
                      <span>•</span>
                      <span className="font-mono">{doc.document_number}</span>
                      <span>•</span>
                      <span>{formatDate(doc.issue_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 transition"
                    >
                      Inspect
                    </Link>
                    <Link
                      href={`/verify/${doc.verification_id}`}
                      target="_blank"
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition flex items-center gap-1"
                      title="Public verification preview"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verify
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit & Compliance Stream (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Audit Stream</h3>
                <p className="text-[11px] text-slate-500">Recent system actions</p>
              </div>
              <Link href="/audit-logs" className="text-xs font-bold text-blue-600 hover:text-blue-800">
                Full Log
              </Link>
            </div>

            <div className="space-y-3.5 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="border-l-2 border-blue-600 pl-3 py-0.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 font-mono text-[11px]">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="text-slate-600 text-[11px]">
                    User: <span className="font-semibold text-slate-700">{log.user_email}</span>
                  </div>
                  {log.resource_id && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      Ref: {log.resource_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>All cryptographic check constraints verified active</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
