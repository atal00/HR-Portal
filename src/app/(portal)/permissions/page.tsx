import React from 'react';
import { PermissionCode } from '@/types/database';
import { ShieldCheck, KeyRound } from 'lucide-react';

const PERMISSIONS_LIST: { code: PermissionCode; module: string; description: string }[] = [
  { code: 'employee.view', module: 'EMPLOYEE', description: 'Can view employee directory and profiles' },
  { code: 'employee.create', module: 'EMPLOYEE', description: 'Can onboard new employees' },
  { code: 'employee.update', module: 'EMPLOYEE', description: 'Can modify employee profile records' },

  { code: 'document.offer.create', module: 'DOCUMENT', description: 'Can generate Full-Time and Internship offer letters' },
  { code: 'document.offer.view', module: 'DOCUMENT', description: 'Can view generated offer letters' },
  { code: 'document.offer.download', module: 'DOCUMENT', description: 'Can download official offer letter PDFs' },

  { code: 'document.experience.create', module: 'DOCUMENT', description: 'Can generate relieving and experience letters' },
  { code: 'document.experience.view', module: 'DOCUMENT', description: 'Can view experience letters' },
  { code: 'document.experience.download', module: 'DOCUMENT', description: 'Can download experience letter PDFs' },

  { code: 'document.salary.create', module: 'DOCUMENT', description: 'Can generate monthly employee salary slips' },
  { code: 'document.salary.view', module: 'DOCUMENT', description: 'Can view salary slips' },
  { code: 'document.salary.download', module: 'DOCUMENT', description: 'Can download salary slip PDFs' },

  { code: 'document.certificate.create', module: 'DOCUMENT', description: 'Can generate official project and internship certificates' },
  { code: 'document.certificate.view', module: 'DOCUMENT', description: 'Can view certificates' },
  { code: 'document.certificate.download', module: 'DOCUMENT', description: 'Can download certificate PDFs' },

  { code: 'template.create', module: 'TEMPLATE', description: 'Can draft new document templates' },
  { code: 'template.update', module: 'TEMPLATE', description: 'Can modify existing document template sections' },
  { code: 'template.publish', module: 'TEMPLATE', description: 'Can publish approved template versions' },

  { code: 'salary.view', module: 'SALARY', description: 'Can inspect confidential compensation and CTC' },
  { code: 'salary.update', module: 'SALARY', description: 'Can modify compensation and payroll structures' },

  { code: 'user.create', module: 'ADMIN', description: 'Can invite and create portal users' },
  { code: 'user.update', module: 'ADMIN', description: 'Can update portal user accounts and status' },

  { code: 'role.assign', module: 'RBAC', description: 'Can grant or revoke roles from users' },
  { code: 'permission.assign', module: 'RBAC', description: 'Can configure role permissions' },

  { code: 'audit.view', module: 'AUDIT', description: 'Can view full immutable audit trails' },
  { code: 'security.view', module: 'SECURITY', description: 'Can review security logs and incident reports' },
];

export default function PermissionsPage() {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <KeyRound className="h-7 w-7 text-blue-600" />
          Granular Permission Catalog
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Detailed registry of atomic permissions evaluated server-side by API guards and RLS policies
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Permission Code</th>
                <th className="px-4 py-3">Domain Module</th>
                <th className="px-4 py-3">Functional Description</th>
                <th className="px-4 py-3 text-right">Enforcement Guard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PERMISSIONS_LIST.map((p) => (
                <tr key={p.code} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3 font-mono font-bold text-blue-700">
                    {p.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {p.module}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {p.description}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700 flex items-center justify-end gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Server API Guard</span>
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
