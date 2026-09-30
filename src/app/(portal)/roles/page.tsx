import React from 'react';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@/lib/rbac';
import { RoleCode } from '@/types/database';
import { FileBadge2, ShieldCheck, Check } from 'lucide-react';

export default function RolesPage() {
  const roles: RoleCode[] = ['SUPER_ADMIN', 'HR_ADMIN', 'DOCUMENT_ADMIN', 'PAYROLL_ADMIN', 'VIEWER'];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <FileBadge2 className="h-7 w-7 text-blue-600" />
          Role-Based Access Control (RBAC) Matrix
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Server-side enforced privilege boundaries across all 5 enterprise roles
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((r) => {
          const info = ROLE_LABELS[r];
          const perms = ROLE_PERMISSIONS[r];

          return (
            <div key={r} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{info.name}</h3>
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">{r}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${info.badgeColor}`}>
                    {perms.length} Perms
                  </span>
                </div>

                <p className="text-xs text-slate-600 my-3 leading-relaxed">
                  {info.description}
                </p>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Granted Permissions:</span>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {perms.map((p) => (
                      <div key={p} className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded font-mono">
                        <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Enforced server-side in all API endpoints</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
