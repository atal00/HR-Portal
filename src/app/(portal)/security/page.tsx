import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { SecurityTelemetryView } from '@/components/security/SecurityTelemetryView';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const user = await getCurrentUser();
  const canView = hasPermission(user, 'security.view');

  if (!canView) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600 shadow-sm">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Restricted Security Domain</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your role (<strong>{user?.role}</strong>) does not have clearance for <code>security.view</code> telemetry. Contact your Super Administrator for privilege escalation.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const secLogs = await db.securityLogs.list(200);

  return <SecurityTelemetryView logs={secLogs} />;
}
