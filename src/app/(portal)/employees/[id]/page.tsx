import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccessSalary, hasPermission } from '@/lib/rbac';
import { formatDate, formatCurrency, maskPanNumber, maskBankNumber } from '@/lib/utils';
import {
  User,
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
  ExternalLink,
  FolderOpen
} from 'lucide-react';

import { EmployeeDeletionButton } from '@/components/employees/EmployeeDeletionButton';

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
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words">{employee.full_name}</h1>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                {employee.employee_id}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                employee.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : employee.status === 'SEPARATED' || employee.status === 'INACTIVE'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {employee.status}
              </span>
              {employee.deletion_status && employee.deletion_status !== 'NONE' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                  {employee.deletion_status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {employee.designation} • {employee.department_name || employee.department || 'General'} • {employee.work_location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasPermission(user, 'employee.update') && (
            <Link
              href={`/employees/${employee.id}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Profile
            </Link>
          )}

          <EmployeeDeletionButton
            employee={employee}
            userRole={user?.role || 'VIEWER'}
          />
        </div>
      </div>

      {/* Inactive / Separated Lifecycle Banner */}
      {(employee.status === 'INACTIVE' || employee.status === 'SEPARATED') && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-950 shadow-2xs">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                {employee.status === 'SEPARATED' ? 'Separated Employee' : 'Inactive Employee'} — Legal Audit Retention Active
              </span>
            </div>
            <p className="text-amber-800 leading-relaxed text-[11.5px]">
              This employee is no longer actively employed with Varsaka Labs. Complete demographic, personal, compensation, and historical document records remain fully preserved and viewable under statutory compliance. Generation of new documents, active payroll modifications, and active operational workflows are strictly restricted server-side.
            </p>
          </div>
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Personal, Demographic & Statutory Master Data (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SECTION A — Personal Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              SECTION A — Personal Information
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Father&apos;s Name</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{employee.father_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Mother&apos;s Name</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{employee.mother_name || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Date of Birth</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {employee.date_of_birth ? formatDate(employee.date_of_birth) : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Gender</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">{employee.gender || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Corporate Work Email</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5 break-all">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{employee.email}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Personal Email</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5 break-all">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{employee.personal_email || '—'}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Primary Contact</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {employee.phone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Alternate Contact</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {employee.alternate_phone || '—'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Permanent Address</span>
                <span className="text-slate-700 mt-0.5 block leading-relaxed whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                  {employee.permanent_address || employee.address}
                </span>
              </div>

              {employee.current_address && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Correspondence Address</span>
                  <span className="text-slate-700 mt-0.5 block leading-relaxed whitespace-pre-line bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                    {employee.current_address}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">City</span>
                  <span className="font-semibold text-slate-800">{employee.city || 'Hyderabad'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">State</span>
                  <span className="font-semibold text-slate-800">{employee.state || 'Telangana'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PIN Code</span>
                  <span className="font-semibold text-slate-800">{employee.pin_code || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B — Statutory & Identity Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                SECTION B — Statutory &amp; Identity
              </h3>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                Restricted
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">PAN</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.pan_number ? maskPanNumber(employee.pan_number) : '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Aadhaar / National ID</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.aadhaar_number ? `•••• •••• ${employee.aadhaar_number.slice(-4)}` : '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Passport Number</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.passport_number || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">UAN</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.uan || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">PF Number</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.pf_number || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">ESIC Number</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">
                  {employee.esic_number || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION E — KYC / Document References */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-amber-600" />
              SECTION E — KYC &amp; Verification Keys
            </h3>

            {employee.kyc_documents && Object.keys(employee.kyc_documents).length > 0 ? (
              <div className="space-y-2 text-xs">
                {Object.entries(employee.kyc_documents).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 gap-2">
                    <span className="capitalize font-semibold text-slate-700 shrink-0">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-mono text-slate-500 text-[11px] break-all text-right">{String(val)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                No KYC file identifiers attached.
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Employment, Payroll, Document History & Audit (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECTION C — Employment Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-purple-600" />
              SECTION C — Employment Particulars
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Date of Joining</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatDate(employee.joining_date)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Employment Type</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{employee.employment_type}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Work Location</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {employee.work_location}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Reporting Manager</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {employee.reporting_manager || 'None Assigned'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Probation Period</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{employee.probation_period || '6 months'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px]">Notice Period</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{employee.notice_period || '60 days'}</span>
              </div>

              {employee.confirmation_date && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Confirmation Date</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{formatDate(employee.confirmation_date)}</span>
                </div>
              )}

              {employee.last_working_date && (
                <div>
                  <span className="text-slate-400 block text-[10px]">Last Working Date</span>
                  <span className="font-semibold text-slate-800 text-red-700 mt-0.5 block">
                    {formatDate(employee.last_working_date)}
                  </span>
                </div>
              )}

              {employee.separation_reason && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="text-slate-400 block text-[10px]">Separation Reason</span>
                  <span className="text-slate-700 mt-0.5 block italic">{employee.separation_reason}</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION D — Bank & Compensation Record with Strict RBAC */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" />
                SECTION D — Bank &amp; Payroll Master Data
              </h3>
              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase">
                Restricted / Confidential
              </span>
            </div>

            {hasSalaryAccess && salary ? (
              <div className="space-y-4">
                {/* Bank Account Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Bank Name</span>
                    <span className="font-semibold text-slate-800">{employee.bank_name || 'HDFC Bank'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Account Holder</span>
                    <span className="font-semibold text-slate-800">{employee.bank_account_holder_name || employee.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Account Number</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {employee.bank_account_number ? maskBankNumber(employee.bank_account_number) : '••••••••1234'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">{employee.bank_ifsc || 'HDFC0001234'}</span>
                  </div>
                </div>

                {/* Salary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/50 p-4 rounded-lg border border-emerald-200 text-xs">
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
                    <span className="text-slate-500">Monthly Net In-Hand:</span>
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

                {/* Components Breakdown */}
                <div className="text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 text-[11px] uppercase">
                    Components Breakdown
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 text-[11px]">
                    <div>Basic: <strong className="font-mono">{formatCurrency(salary.basic)}</strong></div>
                    <div>HRA: <strong className="font-mono">{formatCurrency(salary.hra)}</strong></div>
                    <div>Special Allow: <strong className="font-mono">{formatCurrency(salary.special_allowance || 0)}</strong></div>
                    <div>Conveyance: <strong className="font-mono">{formatCurrency(salary.conveyance || 0)}</strong></div>
                    <div>Other Allow: <strong className="font-mono">{formatCurrency(salary.other_allowances || 0)}</strong></div>
                    <div>Employee PF: <strong className="font-mono text-red-700">{formatCurrency(salary.employee_pf)}</strong></div>
                    <div>Employer PF: <strong className="font-mono text-red-700">{formatCurrency(salary.employer_pf)}</strong></div>
                    <div>Prof. Tax: <strong className="font-mono text-red-700">{formatCurrency(salary.professional_tax)}</strong></div>
                    <div>Gratuity: <strong className="font-mono text-red-700">{formatCurrency(salary.gratuity || 0)}</strong></div>
                    <div>TDS: <strong className="font-mono text-red-700">{formatCurrency(salary.tds)}</strong></div>
                    <div>ESIC: <strong className="font-mono text-red-700">{formatCurrency(salary.esic || 0)}</strong></div>
                    <div>Other Ded: <strong className="font-mono text-red-700">{formatCurrency(salary.other_deductions || 0)}</strong></div>
                  </div>
                </div>
              </div>
            ) : hasSalaryAccess && !salary ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <div>No compensation record initialized for this employee.</div>
                <Link
                  href={`/employees/${employee.id}/edit`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Initialize Compensation in Edit Profile &rarr;
                </Link>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
                <Lock className="h-6 w-6 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Confidential Compensation Masked</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Your active role (<strong>{user?.role}</strong>) does not have clearance for <code>salary.view</code>.
                </p>
              </div>
            )}
          </div>

          {/* Document History — Guaranteed Sanitized Title */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
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
                {documents.map((doc) => {
                  const sanitizedTitle = doc.title && !doc.title.includes('undefined')
                    ? doc.title
                    : `${doc.document_type.replace(/_/g, ' ')} — ${employee.full_name}`;

                  return (
                    <div key={doc.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">{sanitizedTitle}</div>
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit Trail */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-slate-600" />
              Audit Trail ({employeeLogs.length})
            </h3>

            {employeeLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No audit events recorded for this employee profile yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs max-h-72 overflow-y-auto pr-1">
                {employeeLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-800 font-mono text-[11px] block">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Actor: {log.user_email || log.user_id || 'System'}
                      </span>
                      {(log.metadata?.reason || (log as any).reason) && (
                        <span className="text-[10px] text-slate-600 italic block mt-0.5">
                          Reason: {log.metadata?.reason || (log as any).reason}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {formatDate(log.created_at)}
                    </span>
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
