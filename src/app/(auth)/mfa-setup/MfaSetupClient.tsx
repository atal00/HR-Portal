'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import MfaEnrollmentCard from '@/components/auth/MfaEnrollmentCard';
import { LoadingSpinner } from '@/components/ui/Loading';

interface MfaSetupClientProps {
  userEmail: string;
}

export default function MfaSetupClient({ userEmail }: MfaSetupClientProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSuccess = () => {
    router.push('/dashboard');
    router.refresh();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Proceed to login even if logout request had network error
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg mx-auto space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
              <img 
                src="/brand/varsaka-logo.png" 
                alt="Varsaka Labs Logo" 
                width={40}
                height={40}
                style={{ height: '36px', width: '36px', objectFit: 'contain' }}
                className="h-9 w-9 object-contain" 
              />
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-slate-900 tracking-tight block leading-tight">
                VARSAKA LABS
              </span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest block">
                Security &amp; MFA Enrollment
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Mandatory multi-factor authentication setup for <span className="font-semibold text-slate-700">{userEmail}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200">
          <MfaEnrollmentCard
            onSuccess={handleSuccess}
            title="Secure your account"
            subtitle="Set up an authenticator app to protect your Varsaka HR account."
          />
        </div>

        {/* Safe Logout Option */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-busy={loggingOut}
            aria-disabled={loggingOut}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer font-medium disabled:opacity-50"
          >
            {loggingOut ? <LoadingSpinner size="xs" variant="slate" /> : <LogOut className="h-3.5 w-3.5" />}
            <span>{loggingOut ? 'Signing out...' : 'Sign out and return to login'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
