'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Award, ExternalLink, Send, CheckCircle2, Clock, AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { CertificateAccessRequest } from '@/types/database';

export default function CertificateAccessPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<CertificateAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/certificate-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Failed to load certificate requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSendRequest = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/certificate-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_permission: 'Certificate Generation',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit access request.');

      setMessage({ type: 'success', text: 'Certificate access request submitted successfully to the Super Administrator.' });
      setModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequest = requests.find(r => r.status === 'PENDING');
  const approvedRequest = requests.find(r => r.status === 'APPROVED');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/documents"
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Certificate Access & Centralized Issuance
          </h1>
          <p className="text-xs text-slate-500">
            Official certificate generation governance through the central Varsaka Admin Portal
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Informational Card */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <Shield className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">
              Centralized Certificate Governance
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Certificate generation is managed through the <strong>Varsaka Admin Portal</strong> (<code>loginto.varsaka.com</code>). 
              If you have approved clearance, you can generate authenticated certificates directly in the Admin Portal.
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              If you do not currently possess active clearance, you can formally submit an access request to the Super Administrator from this page.
            </p>
          </div>
        </div>

        {/* Existing Request Status Badge */}
        {pendingRequest && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <Clock className="h-4 w-4 text-amber-600 animate-spin" />
              <span>You have a pending certificate access request under review by the Super Administrator.</span>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
              PENDING
            </span>
          </div>
        )}

        {approvedRequest && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Your certificate generation clearance has been approved by the administrator.</span>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
              ACTIVE
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <a
            href="https://loginto.varsaka.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open Admin Portal</span>
          </a>

          <button
            type="button"
            disabled={Boolean(pendingRequest)}
            onClick={() => setModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-300 disabled:opacity-50"
          >
            <Send className="h-4 w-4 text-slate-600" />
            <span>{pendingRequest ? 'Request Already Pending' : 'Request Certificate Access'}</span>
          </button>
        </div>

        {/* Verification Guarantee */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 leading-relaxed">
          <strong>Note:</strong> Public verification architecture remains fully operational. Any official certificate issued through the Varsaka registry can be validated at <code>/verify/[token]</code>.
        </div>

      </div>

      {/* Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Request Certificate Generation Access
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Confirmation required to notify Super Administrator.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
              Are you sure you want to send a certificate-generation access request to the administrator?
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSendRequest}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>Sending Request...</>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Request</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
