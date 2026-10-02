'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionUser } from '@/types/auth';
import { ROLE_LABELS } from '@/lib/rbac';
import { LogOut, ShieldCheck, ExternalLink } from 'lucide-react';

interface Props {
  user: SessionUser;
}

export const Navbar: React.FC<Props> = ({ user }) => {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const roleInfo = ROLE_LABELS[user.role] || { name: user.role, badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' };

  return (
    <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-xs">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200/60 p-1 overflow-hidden">
            <img 
              src="/brand/varsaka-logo.png" 
              alt="Varsaka Labs Logo" 
              width={36}
              height={36}
              style={{ height: '28px', width: '28px', objectFit: 'contain', maxHeight: '28px', maxWidth: '28px' }}
              className="h-7 w-7 object-contain shrink-0 transition-transform group-hover:scale-110" 
            />
          </div>
          <div className="flex flex-col">
            <div className="font-extrabold text-slate-900 tracking-tight text-base leading-tight">
              VARSAKA <span className="text-blue-600 font-black">HR</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              Document Portal
            </div>
          </div>
        </Link>
      </div>

      {/* Center - Verification Quick Link */}
      <div className="hidden md:flex items-center gap-2 text-xs bg-slate-100/80 border border-slate-200 rounded-full px-3.5 py-1 text-slate-600">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="font-medium text-slate-700">Public Verification Engine:</span>
        <Link 
          href="/verify" 
          target="_blank" 
          className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-semibold"
        >
          /verify
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Right - User Role Badge & Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real Assigned Role Badge (Static, non-clickable) */}
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleInfo.badgeColor}`}>
          {roleInfo.name}
        </span>

        {/* User Identity info */}
        <div className="hidden lg:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-800 leading-tight">{user.full_name}</span>
          <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
          title="Sign out of portal"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
