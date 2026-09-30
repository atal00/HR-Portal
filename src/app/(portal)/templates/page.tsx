import React from 'react';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { Layers, FileText, CheckCircle2, Award, Banknote, FileSpreadsheet } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const templates = await db.templates.list();

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'OFFER_LETTER':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'EXPERIENCE_LETTER':
        return <FileSpreadsheet className="h-5 w-5 text-indigo-600" />;
      case 'SALARY_SLIP':
        return <Banknote className="h-5 w-5 text-emerald-600" />;
      case 'CERTIFICATE':
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <Layers className="h-5 w-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Layers className="h-7 w-7 text-blue-600" />
          Controlled Template Management & Versioning
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Immutable version control for legal employment clauses, salary annexures, and certificate layouts
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tmpl) => (
          <div key={tmpl.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  {getDocIcon(tmpl.document_type)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{tmpl.name}</h3>
                  <span className="font-mono text-xs text-slate-400 font-semibold">{tmpl.template_code}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {tmpl.status}
                </span>
                <div className="text-[10px] font-mono font-bold text-blue-600 mt-1">
                  Active: {tmpl.current_version}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Document Type:</span>
                <span className="font-bold text-slate-800">{tmpl.document_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Published Date:</span>
                <span className="font-medium text-slate-800">{formatDate(tmpl.published_at || tmpl.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Governance:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Legal Clauses Locked & Monitored
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-[10px] text-slate-400">Single active version enforced</span>
              <button
                type="button"
                onClick={() => alert(`Template ${tmpl.name} is currently locked under production governance v1.0. All employment clauses adhere to the Varsaka standard.`)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition"
              >
                Inspect Schema
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
