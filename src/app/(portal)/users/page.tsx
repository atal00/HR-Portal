import React from 'react';
import { db } from '@/lib/db';
import { ROLE_LABELS } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { Users, ShieldCheck, Mail, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await db.users.list();

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Users className="h-7 w-7 text-blue-600" />
          System User Directory
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Authorized personnel accounts, assigned roles, and granular security clearance
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">User & Email</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Clearance Scope</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3 text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const roleInfo = ROLE_LABELS[u.role] || { name: u.role, badgeColor: 'bg-slate-100 text-slate-800' };
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleInfo.badgeColor}`}>
                        {roleInfo.name}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="font-semibold text-slate-800">{u.permissions.length}</span> granular permissions mapped
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
