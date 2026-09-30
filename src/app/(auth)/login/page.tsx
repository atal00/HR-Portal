'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleCode } from '@/types/database';
import { ROLE_LABELS } from '@/lib/rbac';
import { ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';

interface DemoAccount {
  role: RoleCode;
  email: string;
  name: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'SUPER_ADMIN', email: 'admin@varsaka.com', name: 'Dr. Vikram Sarabhai' },
  { role: 'HR_ADMIN', email: 'hr@varsaka.com', name: 'Sneha Kulkarni' },
  { role: 'DOCUMENT_ADMIN', email: 'docs@varsaka.com', name: 'Rohan Deshmukh' },
  { role: 'PAYROLL_ADMIN', email: 'payroll@varsaka.com', name: 'Ananya Sharma' },
  { role: 'VIEWER', email: 'auditor@varsaka.com', name: 'Karthik Raman' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Varsaka@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (targetEmail: string, targetRole?: RoleCode) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, role: targetRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to authenticate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your company email address.');
      return;
    }
    handleLogin(email);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <img src="/brand/varsaka-logo.png" alt="Varsaka Labs" className="h-12 w-auto object-contain" />
          <div className="text-left">
            <span className="text-2xl font-black text-slate-900 tracking-tight block">VARSAKA LABS</span>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest block">
              HR Document & Verification Portal
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Secure enterprise portal for HR operations, document workflows & credentials
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-slate-200 sm:px-10">
          
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmitCustom}>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Company Email Address</label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@varsaka.com"
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* One-Click Role Switcher for QA / Evaluator */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                1-Click Role Sandbox Login (QA)
              </span>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const label = ROLE_LABELS[acc.role];
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleLogin(acc.email, acc.role)}
                    disabled={loading}
                    className="w-full flex items-center justify-between p-2.5 text-left border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-blue-900">{acc.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${label.badgeColor}`}>
                          {acc.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{acc.email}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security Note */}
          <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>End-to-end encrypted session with server-side authorization enforcement.</span>
          </div>

        </div>
      </div>

    </div>
  );
}
