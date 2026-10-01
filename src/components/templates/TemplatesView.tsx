'use client';

import React, { useState } from 'react';
import { TemplateRecord } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  Layers,
  FileText,
  CheckCircle2,
  Award,
  Banknote,
  FileSpreadsheet,
  X,
  Code2,
} from 'lucide-react';

interface Props {
  templates: TemplateRecord[];
}

export const TemplatesView: React.FC<Props> = ({ templates }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Layers className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Controlled Template Versions
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable version control for legal employment clauses, salary annexures, and certificate layouts
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto shadow-2xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
          Production Governance v1.0
        </span>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {getDocIcon(tmpl.document_type)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{tmpl.name}</h3>
                  <span className="font-mono text-xs text-slate-400 font-semibold">
                    {tmpl.template_code}
                  </span>
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
                <span className="font-bold text-slate-800">
                  {tmpl.document_type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Published Date:</span>
                <span className="font-medium text-slate-800">
                  {formatDate(tmpl.published_at || tmpl.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Governance:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Legal Clauses Locked &amp; Monitored
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-[10px] text-slate-400">Single active version enforced</span>
              <button
                type="button"
                onClick={() => setSelectedTemplate(tmpl)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition cursor-pointer text-xs"
              >
                Inspect Schema
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Schema Inspection Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Template Schema: {selectedTemplate.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Code: {selectedTemplate.template_code} • Version: {selectedTemplate.current_version}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <span className="font-bold">Production Governance Notice:</span> This template is cryptographically locked under active schema v1.0. All employment clauses adhere to the Varsaka standard.
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Template Metadata</span>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto shadow-inner">
                  {JSON.stringify(
                    {
                      id: selectedTemplate.id,
                      name: selectedTemplate.name,
                      template_code: selectedTemplate.template_code,
                      document_type: selectedTemplate.document_type,
                      current_version: selectedTemplate.current_version,
                      status: selectedTemplate.status,
                      published_at: selectedTemplate.published_at,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Close Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
