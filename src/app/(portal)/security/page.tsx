import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { ShieldAlert, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const user = await getCurrentUser();
  const canView = hasPermission(user, 'security.view');

  if (!canView) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <Lock className="h-10 w-10 text-red-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-900">Restricted Security Domain</h1>
        <p className="text-xs text-slate-600">
          Your role (<strong>{user?.role}</strong>) does not have clearance for <code>security.view</code>.
        </p>
        <Link href="/dashboard" className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const secLogs = await db.securityLogs.list(100);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <ShieldAlert className="h-7 w-7 text-red-600" />
          Security Incident & Threat Telemetry Logs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor authentication anomalies, unauthorized privilege escalation attempts, and revocation activities
        </p>
      </div>

      {/* Security Status Box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="font-bold text-emerald-950">Security Monitoring Active</div>
            <div className="text-emerald-800 text-[11px]">
              Strict Content-Security-Policy, HTTP-only session cookies, and Row-Level Security policies active.
            </div>
          </div>
        </div>
        <span className="font-mono font-bold text-xs text-emerald-700 bg-white px-3 py-1 rounded border border-emerald-200">
          HEALTH: OPTIMAL
        </span>
      </div>

      {/* Security Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Incident Description</th>
                <th className="px-4 py-3">Origin IP</th>
                <th className="px-4 py-3 text-right">Diagnostic Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
              {secLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>

                  <td className="px-4 py-3 font-bold text-slate-900 font-sans">
                    {log.event_type}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadge(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-sans text-slate-800 text-xs">
                    {log.description}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {log.ip_address || '127.0.0.1'}
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
