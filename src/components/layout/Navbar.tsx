'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionUser } from '@/types/auth';
import { ROLE_LABELS } from '@/lib/rbac';
import { RoleCode } from '@/types/database';
import { LogOut, ShieldCheck, User as UserIcon, Check, ChevronDown, ExternalLink } from 'lucide-react';

interface Props {
  user: SessionUser;
}

const AVAILABLE_DEMO_ROLES: RoleCode[] = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'DOCUMENT_ADMIN',
  'PAYROLL_ADMIN',
  'VIEWER',
];

export const Navbar: React.FC<Props> = ({ user }) => {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleSwitchRole = async (targetRole: RoleCode) => {
    setSwitching(true);
    setDropdownOpen(false);
    try {
      await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSwitching(false);
    }
  };

  const roleInfo = ROLE_LABELS[user.role] || { name: user.role, badgeColor: 'bg-slate-100 text-slate-800' };

  return (
    <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 flex items-center justify-between px-6 shadow-xs">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <img src="/brand/varsaka-logo.png" alt="Varsaka Labs" className="h-9 w-auto object-contain transition group-hover:scale-105" />
          <div>
            <div className="font-extrabold text-slate-900 tracking-tight text-base leading-none">
              VARSAKA <span className="text-blue-600 font-black">HR</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
              Document Portal
            </div>
          </div>
        </Link>
      </div>

      {/* Center - Verification Quick Link */}
      <div className="hidden md:flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-slate-600">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>Public Verification Engine:</span>
        <Link 
          href="/verify/VVR-CERT-7B9A2F" 
          target="_blank" 
          className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold"
        >
          /verify/VVR-CERT-7B9A2F
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Right - User & Role Switcher */}
      <div className="flex items-center gap-4">
        {/* Role Switcher Dropdown (for comprehensive QA testing of all 5 roles) */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
            title="Switch user role for QA evaluation"
          >
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${roleInfo.badgeColor}`}>
              {roleInfo.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Switch Role (QA Sandbox)
              </div>
              {AVAILABLE_DEMO_ROLES.map((r) => {
                const label = ROLE_LABELS[r];
                const isCurrent = user.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => handleSwitchRole(r)}
                    disabled={switching}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                      isCurrent ? 'bg-blue-50/70 font-semibold text-blue-900' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{label.name}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{label.description}</div>
                    </div>
                    {isCurrent && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User Identity info */}
        <div className="hidden lg:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-800">{user.full_name}</span>
          <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title="Sign out of portal"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
