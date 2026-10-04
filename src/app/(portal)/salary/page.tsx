import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccessSalary } from '@/lib/rbac';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { SalaryManagementView } from '@/components/salary/SalaryManagementView';


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

  return <SalaryManagementView initialSalaries={allSalaries} />;
}

