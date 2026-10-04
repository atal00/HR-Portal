'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionUser } from '@/types/auth';
import { hasPermission, ROLE_LABELS } from '@/lib/rbac';
import { useSidebar } from '@/components/layout/SidebarContext';
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
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Shield,
  X,
} from 'lucide-react';

interface Props {
  user: SessionUser;
}

interface NavProps {
  user: SessionUser;
  onNavigate?: () => void;
}

function SidebarNavList({ user, onNavigate }: NavProps) {
  const pathname = usePathname();
  const adminPaths = ['/users', '/roles', '/templates', '/audit-logs', '/security', '/settings'];
  const isCurrentPathInAdmin = adminPaths.some((p) => pathname.startsWith(p));
  const [adminOpen, setAdminOpen] = useState(isCurrentPathInAdmin);

  useEffect(() => {
    if (isCurrentPathInAdmin) {
      setAdminOpen(true);
    }
  }, [pathname, isCurrentPathInAdmin]);

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
      label: 'Relieving Letters',
      href: '/documents/relieving',
      icon: FileSpreadsheet,
      show: hasPermission(user, 'document.relieving.view'),
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
      show:
        user.role === 'SUPER_ADMIN' ||
        user.role === 'HR_ADMIN' ||
        user.role === 'DOCUMENT_ADMIN' ||
        user.role === 'PAYROLL_ADMIN',
    },
    {
      label: 'Tasks',
      href: '/tasks',
      icon: CheckSquare,
      show: hasPermission(user, 'task.view'),
    },
  ];

  const adminItems = [
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
      label: 'Template Versions',
      href: '/templates',
      icon: Layers,
      show: user.role === 'SUPER_ADMIN' || user.role === 'DOCUMENT_ADMIN',
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

  const visibleAdminItems = adminItems.filter((item) => item.show);

  return (
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
                onClick={onNavigate}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer group ${
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

        {/* Collapsible Administration Section */}
        {visibleAdminItems.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setAdminOpen(!adminOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-slate-500 group-hover:text-slate-800" />
                <span>Administration</span>
              </div>
              {adminOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              )}
            </button>

            {adminOpen && (
              <div className="space-y-0.5 mt-1 ml-2 pl-2 border-l border-slate-200">
                {visibleAdminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}

export const Sidebar: React.FC<Props> = ({ user }) => {
  const { isOpen, close } = useSidebar();
  const roleInfo = ROLE_LABELS[user.role] || { name: user.role, badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' };

  return (
    <>
      {/* Desktop Sidebar: Preserved 256px width, strictly hidden on mobile (< 768px) */}
      <aside className="hidden md:flex w-64 border-r border-slate-200/90 bg-white min-h-[calc(100vh-4rem)] p-3.5 flex-col justify-between shrink-0 shadow-xs">
        <SidebarNavList user={user} />

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

      {/* Mobile Drawer Overlay Sheet: Active only on mobile when triggered */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={close}
            aria-hidden="true"
          />

          {/* Drawer sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between p-4 z-50 overflow-y-auto transform transition-transform"
          >
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200/60 p-1 overflow-hidden">
                    <img
                      src="/brand/varsaka-logo.png"
                      alt="Varsaka Labs"
                      className="h-6 w-6 object-contain"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-slate-900 text-sm leading-tight">
                      VARSAKA <span className="text-blue-600 font-black">HR</span>
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase">
                      Portal Menu
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={close}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation list */}
              <SidebarNavList user={user} onNavigate={close} />
            </div>

            {/* Drawer User Footer */}
            <div className="pt-3 border-t border-slate-200 mt-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                  {user.full_name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleInfo.badgeColor}`}>
                  {roleInfo.name}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500 font-mono truncate">
                {user.email}
              </div>
              <div className="pt-2 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Enterprise RBAC Enforced</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
