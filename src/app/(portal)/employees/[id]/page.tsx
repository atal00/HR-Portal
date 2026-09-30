import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccessSalary, hasPermission } from '@/lib/rbac';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Banknote,
  FileText,
  History,
  Lock,
  ArrowLeft,
  Edit2,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const employee = await db.employees.getById(id);

  if (!employee) {
    notFound();
  }

  // Check salary permission server-side
  const hasSalaryAccess = canAccessSalary(user);
  const salary = hasSalaryAccess ? await db.salary.getByEmployeeId(employee.id) : null;

  // Fetch document history
  const documents = await db.documents.list({ employeeId: employee.id });

  // Fetch audit history for this employee
  const allLogs = await db.auditLogs.list(200);
  const employeeLogs = allLogs.filter(
    (l) => l.resource_id === employee.employee_id || l.resource_id === employee.id
  );

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{employee.full_name}</h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                {employee.employee_id}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                {employee.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{employee.designation} • {employee.department_name}</p>
          </div>
        </div>

        {hasPermission(user, 'employee.update') && (
          <Link
            href={`/employees/${employee.id}/edit`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs self-start sm:self-auto"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Profile
          </Link>
        )}
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Personnel Details (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              Profile Particulars
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Work Email</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {employee.email}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Phone Number</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {employee.phone}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Work Location</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {employee.work_location}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Date of Joining</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatDate(employee.joining_date)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Reporting Manager</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {employee.reporting_manager || 'None Assigned'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Permanent Address</span>
                <span className="text-slate-700 mt-0.5 block leading-relaxed whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                  {employee.address}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compensation, Document History & Audit (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Compensation Section with Strict RBAC Shield */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Compensation & Payroll Record
              </h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                Restricted Data
              </span>
            </div>

            {hasSalaryAccess && salary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500">Annual CTC:</span>
                    <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                      {formatCurrency(salary.annual_ctc)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Monthly Gross:</span>
                    <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                      {formatCurrency(salary.monthly_gross)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Monthly Net (In-hand):</span>
                    <div className="font-mono font-bold text-emerald-600 text-base mt-0.5">
                      {formatCurrency(salary.net_salary)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Variable Pay:</span>
                    <div className="font-mono font-bold text-slate-700 text-base mt-0.5">
                      {formatCurrency(salary.variable_pay)}
                    </div>
                  </div>
                </div>

                <div className="text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 text-[11px] uppercase">
                    Components Breakdown
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 text-[11px]">
                    <div>Basic: <strong className="font-mono">{formatCurrency(salary.basic)}</strong></div>
                    <div>HRA: <strong className="font-mono">{formatCurrency(salary.hra)}</strong></div>
                    <div>Internet: <strong className="font-mono">{formatCurrency(salary.communication_allowance)}</strong></div>
                    <div>Travel: <strong className="font-mono">{formatCurrency(salary.travel_allowance)}</strong></div>
                    <div>Food: <strong className="font-mono">{formatCurrency(salary.food_allowance)}</strong></div>
                    <div>Employee PF: <strong className="font-mono text-red-700">{formatCurrency(salary.employee_pf)}</strong></div>
                    <div>Employer PF: <strong className="font-mono text-red-700">{formatCurrency(salary.employer_pf)}</strong></div>
                    <div>Prof. Tax: <strong className="font-mono text-red-700">{formatCurrency(salary.professional_tax)}</strong></div>
                    <div>Gratuity: <strong className="font-mono text-red-700">{formatCurrency(salary.gratuity)}</strong></div>
                  </div>
                </div>
              </div>
            ) : hasSalaryAccess && !salary ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No compensation record initialized for this employee.
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
                <Lock className="h-6 w-6 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Confidential Compensation Masked</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Your active role (<strong>{user?.role}</strong>) does not have clearance for <code>salary.view</code>. Compensation details are shielded server-side.
                </p>
              </div>
            )}
          </div>

          {/* Document History */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Document History ({documents.length})
              </h3>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No official documents generated yet for this employee.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-semibold">{doc.document_number}</span>
                        <span>•</span>
                        <span>{formatDate(doc.issue_date)}</span>
                        <span>•</span>
                        <span className="font-bold uppercase text-blue-600">{doc.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="px-2.5 py-1 border border-slate-200 rounded text-slate-700 hover:bg-slate-100 font-semibold"
                      >
                        Inspect
                      </Link>
                      <Link
                        href={`/verify/${doc.verification_id}`}
                        target="_blank"
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Public verification"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Employee Specific Audit History */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-600" />
              Audit Trail
            </h3>

            {employeeLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No audit events recorded.</div>
            ) : (
              <div className="space-y-2 text-xs">
                {employeeLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded bg-slate-50 border border-slate-100 flex justify-between items-center">
                    <div>
                      <span className="font-bold font-mono text-slate-800">{log.action}</span>
                      <div className="text-[10px] text-slate-500">Initiator: {log.user_email}</div>
                    </div>
                    <span className="text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
