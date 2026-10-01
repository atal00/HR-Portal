'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionUser } from '@/types/auth';
import { hasPermission } from '@/lib/rbac';
import {
  LayoutDashboard,
  Users,
  Banknote,
  FileText,
  FileCheck2,
  FileBadge2,
  History,
  ShieldAlert,
  Settings,
  ShieldCheck,
  Award,
  Layers,
  FileSpreadsheet,
  CornerDownRight,
} from 'lucide-react';

interface Props {
  user: SessionUser;
}

export const Sidebar: React.FC<Props> = ({ user }) => {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      label: 'Employees',
      href: '/employees',
      icon: Users,
      show: hasPermission(user, 'employee.view'),
    },
    {
      label: 'Salary & Compensation',
      href: '/salary',
      icon: Banknote,
      show: hasPermission(user, 'salary.view'),
      badge: 'Confidential',
    },
    {
      label: 'Documents',
      href: '/documents',
      icon: FileText,
      show: true,
    },
    {
      label: 'Offer Letters',
      href: '/documents/offer',
      icon: FileText,
      show: hasPermission(user, 'document.offer.view'),
      indent: true,
    },
    {
      label: 'Experience Letters',
      href: '/documents/experience',
      icon: FileSpreadsheet,
      show: hasPermission(user, 'document.experience.view'),
      indent: true,
    },
    {
      label: 'Salary Slips',
      href: '/documents/salary',
      icon: Banknote,
      show: hasPermission(user, 'document.salary.view'),
      indent: true,
    },
    {
      label: 'Certificates',
      href: '/documents/certificate',
      icon: Award,
      show: hasPermission(user, 'document.certificate.view'),
      indent: true,
    },
    {
      label: 'Approvals Queue',
      href: '/approvals',
      icon: FileCheck2,
      show: user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.role === 'DOCUMENT_ADMIN',
    },
    {
      label: 'Template Versions',
      href: '/templates',
      icon: Layers,
      show: user.role === 'SUPER_ADMIN' || user.role === 'DOCUMENT_ADMIN',
    },
    {
      label: 'User Directory',
      href: '/users',
      icon: Users,
      show: user.role === 'SUPER_ADMIN',
    },
    {
      label: 'Roles & Matrix',
      href: '/roles',
      icon: FileBadge2,
      show: user.role === 'SUPER_ADMIN',
    },
    {
      label: 'Audit Trail',
      href: '/audit-logs',
      icon: History,
      show: hasPermission(user, 'audit.view'),
    },
    {
      label: 'Security Logs',
      href: '/security',
      icon: ShieldAlert,
      show: hasPermission(user, 'security.view'),
    },
    {
      label: 'System Settings',
      href: '/settings',
      icon: Settings,
      show: user.role === 'SUPER_ADMIN',
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200/90 bg-white min-h-[calc(100vh-4rem)] p-3.5 flex flex-col justify-between shrink-0 shadow-xs">
      <div className="space-y-1">
        <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>

        <nav className="space-y-0.5">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  pathname.startsWith(item.href) &&
                  item.href !== '/documents');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                    item.indent ? 'ml-3 pl-3 py-1.5 text-[11.5px] border-l border-slate-200' : ''
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.indent ? (
                      <CornerDownRight
                        className={`h-3 w-3 shrink-0 ${
                          isActive ? 'text-blue-100' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                    ) : (
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && !isActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase tracking-wider shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>

      {/* Sidebar Footer - Security Badge */}
      <div className="pt-3 border-t border-slate-200 mt-6 pb-6">
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold mb-1">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">Varsaka Security Shield</span>
          </div>
          <p className="text-[10.5px] text-slate-500 leading-relaxed">
            Strict RBAC &amp; RLS enforced. Tamper-evident immutable audit logging active.
          </p>
        </div>
      </div>
    </aside>
  );
};
