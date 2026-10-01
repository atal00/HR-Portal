'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  salary: 'Salary & Compensation',
  documents: 'Documents',
  offer: 'Offer Letters',
  experience: 'Experience Letters',
  certificate: 'Certificates',
  approvals: 'Approvals Queue',
  templates: 'Template Versions',
  users: 'User Directory',
  roles: 'Roles & Matrix',
  permissions: 'Permission Matrix',
  'audit-logs': 'Audit Trail',
  security: 'Security Center',
  settings: 'System Settings',
  new: 'Create New',
  edit: 'Edit',
  preview: 'Document Preview',
};

export const Breadcrumb: React.FC = () => {
  const pathname = usePathname();

  if (!pathname || pathname === '/' || pathname === '/login') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, index) => {
    const url = '/' + segments.slice(0, index + 1).join('/');
    const label = ROUTE_LABELS[seg] || (seg.length > 15 ? `${seg.slice(0, 8)}...` : seg);
    const isLast = index === segments.length - 1;

    return {
      label,
      url,
      isLast,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500 py-1">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 hover:text-blue-600 transition font-medium"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Varsaka HR</span>
      </Link>

      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.url + idx}>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          {crumb.isLast ? (
            <span className="font-semibold text-slate-800 capitalize" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.url}
              className="hover:text-blue-600 transition font-medium capitalize"
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
