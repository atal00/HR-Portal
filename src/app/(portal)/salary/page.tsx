import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccessSalary, canModifySalary } from '@/lib/rbac';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Banknote, Lock, ShieldCheck, User, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SalaryManagementPage() {
  const user = await getCurrentUser();
  const hasAccess = canAccessSalary(user);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-full inline-block">
          <Lock className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Restricted Payroll Domain</h1>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          Access to employee compensation, CTC breakdowns, and tax structures is strictly governed by enterprise RBAC. Your active role (<strong>{user?.role}</strong>) does not have clearance for <code>salary.view</code>.
        </p>
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const employees = await db.employees.list();
  const allSalaries = await Promise.all(
    employees.map(async (emp) => {
      const sal = await db.salary.getByEmployeeId(emp.id);
      return { emp, sal };
    })
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Banknote className="h-7 w-7 text-emerald-600" />
            Salary & Compensation Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Restricted compensation ledger, statutory PF/Tax deductions, and monthly payroll calculations
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Clearance: Payroll Authorized</span>
        </div>
      </div>

      {/* Salary Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3">Annual CTC</th>
                <th className="px-4 py-3">Monthly Gross</th>
                <th className="px-4 py-3">Basic Pay</th>
                <th className="px-4 py-3">Monthly Net (In-hand)</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {allSalaries.map(({ emp, sal }) => (
                <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-900">{emp.full_name}</div>
                    <div className="font-mono text-blue-600 font-semibold text-[11px]">{emp.employee_id}</div>
                    <div className="text-[10px] text-slate-400">{emp.designation}</div>
                  </td>

                  <td className="px-4 py-3.5 font-mono font-bold text-slate-900 text-sm">
                    {sal ? formatCurrency(sal.annual_ctc) : '₹0.00'}
                  </td>

                  <td className="px-4 py-3.5 font-mono text-slate-800">
                    {sal ? formatCurrency(sal.monthly_gross) : '₹0.00'}
                  </td>

                  <td className="px-4 py-3.5 font-mono text-slate-800">
                    {sal ? formatCurrency(sal.basic) : '₹0.00'}
                  </td>

                  <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 text-sm">
                    {sal ? formatCurrency(sal.net_salary) : '₹0.00'}
                  </td>

                  <td className="px-4 py-3.5 font-medium text-slate-600">
                    {sal ? formatDate(sal.effective_date) : 'N/A'}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/employees/${emp.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
