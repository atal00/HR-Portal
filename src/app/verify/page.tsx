'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Lock,
  ExternalLink,
  QrCode,
  FileCheck2,
  AlertCircle
} from 'lucide-react';

export default function VerificationLandingPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim().toUpperCase();
    if (!cleanToken) {
      setError('Please enter a valid Verification ID.');
      return;
    }
    if (cleanToken.length < 5) {
      setError('Verification ID must be at least 5 characters long.');
      return;
    }
    setError('');
    router.push(`/verify/${encodeURIComponent(cleanToken)}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 justify-center mb-2">
            <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center p-1 shrink-0 overflow-hidden">
              <img
                src="/brand/varsaka-logo.png"
                alt="Varsaka Labs"
                width={40}
                height={40}
                style={{ height: '36px', width: '36px', objectFit: 'contain' }}
                className="h-9 w-9 object-contain"
              />
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-blue-950 tracking-wider block">VARSAKA LABS</span>
              <span className="text-[10px] text-blue-700 uppercase tracking-widest font-bold block">
                Official Credential Verification Engine
              </span>
            </div>
          </Link>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographically registered employee credentials &amp; official document registry
          </p>
        </div>

        {/* Verification Entry Card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
              <ShieldCheck className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">VERIFY AN OFFICIAL DOCUMENT</h1>
            <p className="text-xs text-blue-100 mt-1">
              Enter the unique verification token printed on your letter, contract, or certificate.
            </p>
          </div>

          {/* Form Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="verification-input" className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Verification ID / Token
                </label>
                <div className="relative">
                  <Search className="h-5 w-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="verification-input"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. VVR-REL-187C428E or VVR-EXP-2026-001001"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase tracking-wider"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold mt-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileCheck2 className="h-4 w-4" />
                Verify Document Credential
              </button>
            </form>

            {/* Verification Instructions Guide */}
            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-start gap-3 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <QrCode className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">QR Code Instant Verification</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    All authentic Varsaka Labs documents feature a secure, tamper-evident QR code. Scanning the code with any smartphone camera opens this registry directly with zero manual entry.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">Where to find the Verification ID</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Look at the bottom footer of your official letter, relieving document, experience certificate, or award. The alphanumeric token begins with <span className="font-mono font-bold text-slate-700">VVR-</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Safeguard Notice */}
            <div className="pt-2 border-t border-slate-100 flex items-start gap-2.5 text-[10px] text-slate-400">
              <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Policy:</strong> To protect personal privacy and comply with enterprise data guidelines, sensitive details (including compensation, PAN, banking coordinates, and private residential contact data) are never exposed via public verification routes.
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono text-[10px]">
              Varsaka Central Registry • TLS 1.3 Encrypted
            </span>
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              Administrator Login
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-400 mt-8">
        © {new Date().getFullYear()} Varsaka Labs Pvt. Ltd. • All rights reserved.
      </footer>
    </div>
  );
}
