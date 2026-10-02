'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldCheck, AlertCircle, Eye, EyeOff, Smartphone, Key, ArrowLeft } from 'lucide-react';

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA Challenge State
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaMode, setMfaMode] = useState<'totp' | 'recovery'>('totp');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const totpInputRef = useRef<HTMLInputElement>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (requiresMfa && mfaMode === 'totp') {
      totpInputRef.current?.focus();
    } else if (requiresMfa && mfaMode === 'recovery') {
      recoveryInputRef.current?.focus();
    }
  }, [requiresMfa, mfaMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your company email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      // If MFA is configured, transition to MFA challenge screen
      if (data.requiresMfa) {
        setRequiresMfa(true);
        setChallengeId(data.challengeId || null);
        setMfaMode('totp');
        setTotpCode('');
        setError(null);
        return;
      }

      // Branch 1: Temporary password requires password change
      if (data.must_change_password || data.redirectTo === '/change-password') {
        router.push('/change-password');
        router.refresh();
        return;
      }

      // Branch 2: MFA not configured -> mandatory MFA enrollment
      if (data.redirectTo === '/mfa-setup') {
        router.push('/mfa-setup');
        router.refresh();
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = totpCode.replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the 6-digit verification code from your authenticator app.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          challengeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'MFA verification failed.');
      }

      if (data.must_change_password || data.redirectTo === '/change-password') {
        router.push('/change-password');
        router.refresh();
        return;
      }

      if (data.redirectTo === '/mfa-setup') {
        router.push('/mfa-setup');
        router.refresh();
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRecovery = recoveryCode.trim();
    if (!cleanRecovery) {
      setError('Please enter your emergency recovery code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryCode: cleanRecovery,
          challengeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Recovery code verification failed.');
      }

      if (data.must_change_password || data.redirectTo === '/change-password') {
        router.push('/change-password');
        router.refresh();
        return;
      }

      if (data.redirectTo === '/mfa-setup') {
        router.push('/mfa-setup');
        router.refresh();
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid recovery code.');
    } finally {
      setLoading(false);
    }
  };

  const resetToCredentials = () => {
    setRequiresMfa(false);
    setMfaMode('totp');
    setChallengeId(null);
    setTotpCode('');
    setRecoveryCode('');
    setError(null);
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

          {!requiresMfa ? (
            /* Primary Credentials Form */
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Email Address
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@varsaka.com"
                    autoComplete="username"
                    spellCheck={false}
                    autoCapitalize="none"
                    required
                    className="block w-full pl-9.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="block w-full pl-9.5 pr-10 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 shrink-0 text-slate-500 hover:text-slate-700 transition" />
                    ) : (
                      <Eye className="h-4 w-4 shrink-0 text-slate-500 hover:text-slate-700 transition" />
                    )}
                  </button>
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
          ) : mfaMode === 'totp' ? (
            /* TOTP Authenticator Code Form */
            <form className="space-y-5" onSubmit={handleVerifyMfa}>
              <div className="text-center space-y-1">
                <div className="h-10 w-10 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-2">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Enter Authenticator Code</h2>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Open your authenticator app (Google Authenticator, Microsoft Authenticator, or Authy) and enter the 6-digit code for{' '}
                  <span className="font-semibold text-slate-700">{email}</span>.
                </p>
              </div>

              <div>
                <label htmlFor="totpCode" className="sr-only">
                  6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <input
                    ref={totpInputRef}
                    id="totpCode"
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setTotpCode(val);
                    }}
                    placeholder="• • • • • •"
                    required
                    className="block w-full py-3 px-4 text-center text-2xl font-mono tracking-[0.5em] bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900 placeholder:text-slate-300 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMode('recovery');
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer transition text-[11px]"
                  >
                    Use recovery code
                  </button>

                  <button
                    type="button"
                    onClick={resetToCredentials}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 cursor-pointer transition text-[11px]"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Emergency Recovery Code Form */
            <form className="space-y-5" onSubmit={handleVerifyRecovery}>
              <div className="text-center space-y-1">
                <div className="h-10 w-10 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2">
                  <Key className="h-5 w-5" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Enter Recovery Code</h2>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Enter one of your 10-character emergency recovery codes generated during MFA setup.
                </p>
              </div>

              <div>
                <label htmlFor="recoveryCode" className="block text-xs font-semibold text-slate-700 mb-1">
                  Backup Recovery Code
                </label>
                <input
                  ref={recoveryInputRef}
                  id="recoveryCode"
                  name="recoveryCode"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX"
                  required
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="block w-full py-2.5 px-3 text-center text-sm font-mono tracking-wider bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden transition text-slate-900 uppercase"
                />
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="submit"
                  disabled={loading || !recoveryCode.trim()}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify with Recovery Code'}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaMode('totp');
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer transition text-[11px]"
                  >
                    Use authenticator code
                  </button>

                  <button
                    type="button"
                    onClick={resetToCredentials}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 cursor-pointer transition text-[11px]"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Secure Enterprise Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>End-to-end encrypted session with server-side authorization enforcement.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
