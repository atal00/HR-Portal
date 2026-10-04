import React from 'react';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  FileText, 
  User, 
  ExternalLink,
  Lock,
  Clock
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ verificationId: string }>;
}

export default async function PublicVerificationPage({ params }: Props) {
  const { verificationId } = await params;
  const result = await db.verification.verifyPublic(verificationId);

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
            Cryptographically registered employee credentials & official document registry
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          
          {/* Status Header Banner */}
          {result.status === 'VALID' && (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">DOCUMENT VERIFIED</h1>
              <p className="text-xs text-emerald-100 mt-1">
                This document is authentic, registered, and issued by Varsaka Labs.
              </p>
            </div>
          )}

          {result.status === 'PENDING_APPROVAL' && (
            <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
                <Clock className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">DOCUMENT PENDING APPROVAL</h1>
              <p className="text-xs text-amber-100 mt-1">
                This document has been submitted and is currently pending authorized approval. It has NOT been officially verified or issued.
              </p>
            </div>
          )}

          {result.status === 'REJECTED' && (
            <div className="bg-gradient-to-r from-rose-600 to-red-700 text-white p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
                <XCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">DOCUMENT REJECTED</h1>
              <p className="text-xs text-rose-100 mt-1">
                This document was rejected during internal review and is NOT an authentic issued document.
              </p>
            </div>
          )}

          {result.status === 'REVOKED' && (
            <div className="bg-gradient-to-r from-red-700 to-slate-900 text-white p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
                <XCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">DOCUMENT REVOKED</h1>
              <p className="text-xs text-rose-100 mt-1">
                This document has been formally invalidated and revoked by the issuing authority.
              </p>
            </div>
          )}

          {result.status === 'NOT_FOUND' && (
            <div className="bg-gradient-to-r from-slate-600 to-slate-800 text-white p-6 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 rounded-full mb-3 backdrop-blur-xs">
                <AlertTriangle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">RECORD NOT FOUND</h1>
              <p className="text-xs text-amber-100 mt-1">
                No official document with this verification token exists in the registry.
              </p>
            </div>
          )}

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6">
            
            {result.status === 'VALID' && (
              <>
                <div className="border border-emerald-100 bg-emerald-50/50 rounded-lg p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Document Title:
                    </span>
                    <span className="font-bold text-slate-900 text-right">{result.document_title}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-emerald-600" />
                      Recipient / Candidate Name:
                    </span>
                    <span className="font-bold text-slate-900">{result.candidate_name}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      Document Type:
                    </span>
                    <span className="font-mono font-semibold text-slate-800">{result.document_type}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      Date of Issue:
                    </span>
                    <span className="font-semibold text-slate-800">{formatDate(result.issue_date)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                    <span className="text-slate-500">Document Identifier:</span>
                    <span className="font-mono text-slate-800 font-semibold">{result.document_number}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Verification ID:</span>
                    <span className="font-mono font-bold text-blue-700">{result.verification_id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-600">
                  <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800">Authorized Signatory:</span> {result.authorized_signatory}
                    <div className="text-[10px] text-slate-400">Varsaka Labs Central Document Repository</div>
                  </div>
                </div>
              </>
            )}

            {result.status === 'PENDING_APPROVAL' && (
              <div className="space-y-4">
                <div className="border border-amber-200 bg-amber-50/60 rounded-lg p-4 space-y-3 text-xs">
                  <div className="flex justify-between border-b border-amber-100 pb-2">
                    <span className="text-slate-500">Document Title:</span>
                    <span className="font-bold text-slate-900">{result.document_title}</span>
                  </div>
                  <div className="flex justify-between border-b border-amber-100 pb-2">
                    <span className="text-slate-500">Recipient Name:</span>
                    <span className="font-bold text-slate-900">{result.candidate_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-amber-100 pb-2">
                    <span className="text-slate-500">Document Type:</span>
                    <span className="font-semibold text-slate-800">{result.document_type}</span>
                  </div>
                  <div className="flex justify-between border-b border-amber-100 pb-2">
                    <span className="text-slate-500">Verification Token:</span>
                    <span className="font-mono font-bold text-amber-900">{result.verification_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lifecycle Status:</span>
                    <span className="font-bold text-amber-700 uppercase">PENDING FORMAL APPROVAL</span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Authenticity Not Established:</strong>
                    This document draft has not received formal authorization or executive seal from Varsaka Labs. It cannot be used as an official credential.
                  </div>
                </div>
              </div>
            )}

            {result.status === 'REJECTED' && (
              <div className="space-y-4">
                <div className="border border-red-200 bg-red-50/50 rounded-lg p-4 space-y-3 text-xs">
                  <div className="flex justify-between border-b border-red-100 pb-2">
                    <span className="text-slate-500">Document Title:</span>
                    <span className="font-bold text-slate-900">{result.document_title}</span>
                  </div>
                  <div className="flex justify-between border-b border-red-100 pb-2">
                    <span className="text-slate-500">Recipient Name:</span>
                    <span className="font-bold text-slate-900">{result.candidate_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-red-100 pb-2">
                    <span className="text-slate-500">Verification Token:</span>
                    <span className="font-mono font-bold text-red-900">{result.verification_id}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-500 block mb-1">Reason for Rejection:</span>
                    <div className="p-2.5 bg-white border border-red-200 rounded text-red-950 font-medium">
                      "{result.rejection_reason || 'Document was rejected during approval review.'}"
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result.status === 'REVOKED' && (
              <div className="border border-red-200 bg-red-50/50 rounded-lg p-4 space-y-3 text-xs">
                <div className="flex justify-between border-b border-red-100 pb-2">
                  <span className="text-slate-500">Document Title:</span>
                  <span className="font-bold text-slate-900">{result.document_title}</span>
                </div>
                <div className="flex justify-between border-b border-red-100 pb-2">
                  <span className="text-slate-500">Recipient Name:</span>
                  <span className="font-bold text-slate-900">{result.candidate_name}</span>
                </div>
                <div className="flex justify-between border-b border-red-100 pb-2">
                  <span className="text-slate-500">Revoked On:</span>
                  <span className="font-semibold text-red-800">{formatDate(result.revoked_at)}</span>
                </div>
                <div className="pt-1">
                  <span className="text-slate-500 block mb-1">Official Reason for Revocation:</span>
                  <div className="p-2.5 bg-white border border-red-200 rounded text-red-950 font-medium">
                    "{result.revocation_reason || 'Administrative revocation as per internal compliance review.'}"
                  </div>
                </div>
              </div>
            )}

            {result.status === 'NOT_FOUND' && (
              <div className="text-center py-4 text-xs text-slate-600 space-y-2">
                <p>The token <span className="font-mono font-bold text-slate-800">{verificationId}</span> is not registered.</p>
                <p className="text-[11px] text-slate-500">
                  Please verify that you entered the complete ID correctly or scan the official QR code located at the bottom of your certificate.
                </p>
              </div>
            )}

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
              Timestamp: {new Date(result.verified_at).toUTCString()}
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
        © {new Date().getFullYear()} Varsaka Labs • All rights reserved.
      </footer>
    </div>
  );
}
