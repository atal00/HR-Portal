import React from 'react';
import { Settings, Building2, Hash, Globe, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-blue-600" />
          Enterprise System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Corporate identity metadata, numbering sequences, canonical domains, and cryptographic certificates
        </p>
      </div>

      {/* Settings Grid */}
      <div className="space-y-6">
        
        {/* Company Identity */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-4 w-4 text-blue-600" />
            Corporate Legal Entity & Metadata
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Brand Name</span>
              <span className="font-bold text-slate-900">Varsaka Labs</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Legal Entity</span>
              <span className="font-bold text-slate-900">Varsaka Labs Pvt. Ltd.</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Corporate Website</span>
              <span className="font-mono text-blue-600">https://varsaka.com</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Corporate Communications</span>
              <span className="font-mono text-slate-700">info@varsakalabs.com</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400 block mb-0.5">Registered Office Address</span>
              <span className="text-slate-800 leading-relaxed">
                APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032
              </span>
            </div>
          </div>
        </div>

        {/* Numbering Format Specifications */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Hash className="h-4 w-4 text-blue-600" />
            Document Numbering Sequence Formats
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Full-Time Offer Letters</span>
              <div className="font-mono font-semibold text-blue-700">VAR-OFF-YYYY-XXXXXX</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Example: VAR-OFF-2026-000001</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Experience & Relieving Letters</span>
              <div className="font-mono font-semibold text-indigo-700">VAR-EXP-YYYY-XXXXXX</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Example: VAR-EXP-2026-000001</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Monthly Salary Slips</span>
              <div className="font-mono font-semibold text-emerald-700">VAR-SAL-YYYY-MM-XXXXXX</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Example: VAR-SAL-2026-09-000001</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Certificates of Completion</span>
              <div className="font-mono font-semibold text-amber-700">VAR-CERT-YYYY-XXXXXX</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Example: VAR-CERT-2026-000001</div>
            </div>
          </div>
        </div>

        {/* Canonical Public Domain & QR Policy */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Globe className="h-4 w-4 text-blue-600" />
            Canonical Public Domain & QR Policy
          </h2>

          <div className="text-xs space-y-2 text-slate-700 leading-relaxed">
            <p>
              In production, QR codes point to the canonical public domain: <code>https://varsaka.com/verify/[verificationId]</code>. In local development and testing, it adapts automatically to <code>{process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/[verificationId]</code>.
            </p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
              <span>Public verification routes strictly isolate public proof from sensitive employee records.</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
