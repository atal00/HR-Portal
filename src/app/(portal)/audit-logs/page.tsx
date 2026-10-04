import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { History, ShieldAlert, Lock, User, FileText, Database } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  const canView = hasPermission(user, 'audit.view');

  if (!canView) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <Lock className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Restricted Audit Domain</h1>
        <p className="text-xs text-slate-600">
          Your role (<strong>{user?.role}</strong>) does not have clearance for <code>audit.view</code>.
        </p>
        <Link href="/dashboard" className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const logs = await db.auditLogs.list(200);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <History className="h-7 w-7 text-blue-600" />
          Immutable Audit Trail
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Chronological record of all authentication, employee, salary, document, and template operations
        </p>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Initiator / User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource & ID</th>
                <th className="px-4 py-3">IP & Client</th>
                <th className="px-4 py-3 text-right">Metadata Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900 font-sans">{log.user_email}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.user_id || 'system'}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{log.resource_type}</div>
                    <div className="text-[10px] text-slate-500">{log.resource_id || 'N/A'}</div>
                  </td>

                  <td className="px-4 py-3 text-slate-600 text-[10px]">
                    <div>{log.ip_address || '127.0.0.1'}</div>
                    <div className="text-slate-400 truncate max-w-xs">{log.user_agent || 'Client'}</div>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="max-w-xs truncate ml-auto text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200">
                      {JSON.stringify(log.metadata)}
                    </div>
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
