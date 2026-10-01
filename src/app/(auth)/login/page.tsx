'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  badgeColor: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Dr. Vikram Sarabhai',
    email: 'admin@varsaka.com',
    role: 'SUPER_ADMIN',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    name: 'Sneha Kulkarni',
    email: 'hr@varsaka.com',
    role: 'HR_ADMIN',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    name: 'Rohan Deshmukh',
    email: 'docs@varsaka.com',
    role: 'DOCUMENT_ADMIN',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    name: 'Ananya Sharma',
    email: 'payroll@varsaka.com',
    role: 'PAYROLL_ADMIN',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    name: 'Karthik Raman',
    email: 'auditor@varsaka.com',
    role: 'VIEWER',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (targetEmail: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md mx-auto space-y-6">
        
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
                HR Document &amp; Verification Portal
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Secure enterprise portal for HR operations, document workflows &amp; credentials
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmitCustom}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Email Address
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@varsaka.com"
                  className="block w-full pl-9.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* One-Click Role Switcher for QA / Evaluator */}
          <div className="mt-7 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                1-Click Role Sandbox Login (QA)
              </span>
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleLogin(acc.email)}
                  disabled={loading}
                  className="w-full p-2.5 text-left border border-slate-200/90 rounded-xl hover:border-blue-400 hover:bg-blue-50/40 transition flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                        {acc.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${acc.badgeColor}`}>
                        {acc.role}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-slate-500 font-mono block">
                      {acc.email}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>End-to-end encrypted session with server-side authorization enforcement.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
