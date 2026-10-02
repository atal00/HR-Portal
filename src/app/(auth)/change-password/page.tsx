'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, KeyRound, ShieldAlert, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Policy validation checkers
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError('Please ensure your new password satisfies all complexity requirements.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred while changing password.');
    } finally {
      setLoading(false);
    }
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
                Security &amp; Password Hardening
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Mandatory credential configuration required before accessing the portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200">
          <div className="mb-6 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <strong>Action Required:</strong> You signed in with a temporary password. For security compliance, you must set a permanent password now.
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Password updated successfully! Redirecting to portal...</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Current Temporary Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Temporary Password *
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="block w-full pl-9 pr-10 py-2 sm:text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Permanent Password *
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create secure permanent password"
                  className="block w-full pl-9 pr-10 py-2 sm:text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password *
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="block w-full pl-9 pr-10 py-2 sm:text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Complexity Checklist */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-700 block mb-1">Password Policy Requirements:</span>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {hasMinLength ? '✓' : '•'} At least 8 characters
                </span>
                <span className={`flex items-center gap-1 ${hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {hasUppercase ? '✓' : '•'} Uppercase letter (A-Z)
                </span>
                <span className={`flex items-center gap-1 ${hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {hasLowercase ? '✓' : '•'} Lowercase letter (a-z)
                </span>
                <span className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {hasNumber ? '✓' : '•'} Numeric digit (0-9)
                </span>
                <span className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {hasSpecial ? '✓' : '•'} Special symbol (!@#$)
                </span>
                <span className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                  {passwordsMatch ? '✓' : '•'} Passwords match
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid || success}
              className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white transition ${
                loading || !isFormValid || success
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? 'Changing Password...' : 'Save Permanent Password & Continue'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
