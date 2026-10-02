'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DocumentRecord } from '@/types/database';
import { OfferLetterTemplate } from '@/components/documents/OfferLetterTemplate';
import { ExperienceLetterTemplate } from '@/components/documents/ExperienceLetterTemplate';
import { RelievingLetterTemplate } from '@/components/documents/RelievingLetterTemplate';
import { SalarySlipTemplate } from '@/components/documents/SalarySlipTemplate';
import { CertificateTemplate } from '@/components/documents/CertificateTemplate';
import { ArrowLeft, Printer } from 'lucide-react';

export default function DocumentPreviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDoc(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Loading document preview...</div>;
  if (!doc) return <div className="p-12 text-center text-xs text-red-600">Document not found</div>;

  const verificationUrl = `${window.location.origin}/verify/${doc.verification_id}`;

  const renderTemplate = () => {
    switch (doc.document_type) {
      case 'OFFER_LETTER':
        return (
          <OfferLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'EXPERIENCE_LETTER':
        return (
          <ExperienceLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'RELIEVING_LETTER':
        return (
          <RelievingLetterTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'SALARY_SLIP':
        return (
          <SalarySlipTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      case 'CERTIFICATE':
        return (
          <CertificateTemplate
            data={doc.data_snapshot as any}
            documentNumber={doc.document_number}
            verificationId={doc.verification_id}
            verificationUrl={verificationUrl}
          />
        );
      default:
        return <div>Unsupported document type</div>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href={`/documents/${doc.id}`}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-900 text-sm">{doc.title}</h1>
            <p className="text-[11px] text-slate-500">Document Number: {doc.document_number}</p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      <div className="document-outer-container bg-slate-200/90 p-4 md:p-8 rounded-xl border border-slate-300 flex justify-center">
        <div className="w-full">
          {renderTemplate()}
        </div>
      </div>
    </div>
  );
}
