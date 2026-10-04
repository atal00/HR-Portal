'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building2,
  Hash,
  Globe,
  ShieldCheck,
  Award,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  FileCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { DocumentBrandingSettings } from '@/lib/branding';
import MfaEnrollmentCard from '@/components/auth/MfaEnrollmentCard';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner, InlineLoader } from '@/components/ui/Loading';

export default function SettingsPage() {
  const [branding, setBranding] = useState<DocumentBrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mfaStatus, setMfaStatus] = useState<{ isEnabled: boolean; isVerified: boolean; lastUsedAt: string | null } | null>(null);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);

  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Signatory & Stamp
  const [sigName, setSigName] = useState('');
  const [sigTitle, setSigTitle] = useState('');
  const [sigDept, setSigDept] = useState('');
  const [sigCompany, setSigCompany] = useState('');
  const [sigActive, setSigActive] = useState(true);
  const [sigEffective, setSigEffective] = useState('');

  const [stampActive, setStampActive] = useState(true);
  const [stampEffective, setStampEffective] = useState('');

  // Corporate Legal Entity & Metadata State (Requirement 8)
  const [corporateMetadata, setCorporateMetadata] = useState<any>(null);
  const [editMetaModalOpen, setEditMetaModalOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({
    brand_name: 'Varsaka Labs',
    legal_entity: 'Varsaka Labs Pvt. Ltd.',
    corporate_website: 'https://varsaka.com',
    corporate_email: 'info@varsakalabs.com',
    registered_office_address: 'APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032',
    cin: 'U72900TG2023PTC178920',
  });
  const [savingMeta, setSavingMeta] = useState(false);

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/settings/branding');
      if (res.ok) {
        const data: DocumentBrandingSettings = await res.json();
        setBranding(data);
        setSigName(data.signatory.name);
        setSigTitle(data.signatory.title);
        setSigDept(data.signatory.department);
        setSigCompany(data.signatory.company);
        setSigActive(data.signatory.is_active);
        setSigEffective(data.signatory.effective_from || '2026-01-01');

        setStampActive(data.stamp.is_active);
        setStampEffective(data.stamp.effective_from || '2026-01-01');
      }

      // Fetch corporate metadata
      const metaRes = await fetch('/api/settings/corporate');
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        if (metaData.metadata) {
          setCorporateMetadata(metaData.metadata);
          setMetaForm(metaData.metadata);
        }
      }
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to load branding settings.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMfaStatus = async () => {
    try {
      const res = await fetch('/api/auth/mfa/status');
      if (res.ok) {
        const data = await res.json();
        setMfaStatus(data);
      }
    } catch (e) {
      console.error('Failed to load MFA status:', e);
    }
  };

  useEffect(() => {
    fetchBranding();
    fetchMfaStatus();
  }, []);

  const handleSaveCorporateMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/corporate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update corporate metadata.');

      setCorporateMetadata(data.metadata);
      setEditMetaModalOpen(false);
      setMessage({ type: 'success', text: 'Corporate legal entity metadata updated and audit logged successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSaveTextSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatory: {
            name: sigName,
            title: sigTitle,
            department: sigDept,
            company: sigCompany,
            is_active: sigActive,
            effective_from: sigEffective,
          },
          stamp: {
            is_active: stampActive,
            effective_from: stampEffective,
          },
        }),
      });

      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Failed to update branding settings.');

      setBranding(updated);
      setMessage({ type: 'success', text: 'Branding metadata and active statuses saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (target: 'signature' | 'stamp', file: File) => {
    setMessage(null);

    // Client-side validation
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setMessage({ type: 'error', text: 'Invalid file format. Supported: PNG, JPG, WEBP.' });
      return;
    }

    const maxSize = target === 'signature' ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > maxSize) {
      setMessage({
        type: 'error',
        text: `File exceeds size limit of ${target === 'signature' ? '2MB' : '3MB'}.`,
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', target);

    if (target === 'signature') setUploadingSig(true);
    else setUploadingStamp(true);

    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        body: formData,
      });

      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Upload failed.');

      setBranding(updated);
      setMessage({
        type: 'success',
        text: `New ${target === 'signature' ? 'signature (v' + updated.signatory.version + ')' : 'stamp (v' + updated.stamp.version + ')'} uploaded and activated successfully.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      if (target === 'signature') setUploadingSig(false);
      else setUploadingStamp(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-blue-600" />
          Enterprise System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Corporate identity metadata, authorized signatory, company seal, numbering sequences, and canonical domains
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="space-y-6">
        
        {/* ================================================================= */}
        {/* DOCUMENT BRANDING / AUTHORIZED SIGNATORY                          */}
        {/* ================================================================= */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-600" />
              DOCUMENT BRANDING / AUTHORIZED SIGNATORY
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Private Supabase Storage: <code>hr-assets/</code>
            </span>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <InlineLoader text="Loading enterprise branding and entity configuration..." size="md" />
            </div>
          ) : (
            <form onSubmit={handleSaveTextSettings} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* ----------------------------------------------------------- */}
                {/* AUTHORIZED SIGNATORY CARD                                    */}
                {/* ----------------------------------------------------------- */}
                <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                      Authorized Signatory
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Version {branding?.signatory.version || 1}.0
                    </span>
                  </div>

                  {/* Current Signature Preview */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      Current Signature Preview
                    </label>
                    <div className="h-24 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-2 relative overflow-hidden">
                      {branding?.signatory.signature_url ? (
                        <img
                          src={branding.signatory.signature_url}
                          alt="Current Signature"
                          className="max-h-20 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No signature asset</span>
                      )}
                    </div>
                  </div>

                  {/* Upload New / Replace Signature */}
                  <div>
                    <input
                      type="file"
                      ref={sigFileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('signature', file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingSig}
                      aria-busy={uploadingSig}
                      aria-disabled={uploadingSig}
                      onClick={() => sigFileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50"
                    >
                      {uploadingSig ? <LoadingSpinner size="xs" variant="primary" /> : <Upload className="h-3.5 w-3.5" />}
                      <span>{uploadingSig ? 'Uploading Signature...' : 'Upload / Replace Signature'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 block mt-1 text-center">
                      PNG (transparent preferred) or JPG • Max 2MB
                    </span>
                  </div>

                  {/* Signatory Text Coordinates */}
                  <div className="space-y-3 pt-2 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Signatory Full Name *</label>
                      <input
                        type="text"
                        required
                        value={sigName}
                        onChange={(e) => setSigName(e.target.value)}
                        placeholder="e.g. Rajesh Nair"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Official Designation *</label>
                      <input
                        type="text"
                        required
                        value={sigTitle}
                        onChange={(e) => setSigTitle(e.target.value)}
                        placeholder="e.g. Authorized Signatory / Head of HR"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Department</label>
                      <input
                        type="text"
                        value={sigDept}
                        onChange={(e) => setSigDept(e.target.value)}
                        placeholder="e.g. HR Department"
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Legal Entity / Company</label>
                      <input
                        type="text"
                        value={sigCompany}
                        onChange={(e) => setSigCompany(e.target.value)}
                        placeholder="e.g. Varsaka Labs Pvt. Ltd."
                        className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Status</label>
                        <select
                          value={sigActive ? 'active' : 'disabled'}
                          onChange={(e) => setSigActive(e.target.value === 'active')}
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium"
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Effective From</label>
                        <input
                          type="date"
                          value={sigEffective}
                          onChange={(e) => setSigEffective(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* ----------------------------------------------------------- */}
                {/* COMPANY STAMP / SEAL CARD                                   */}
                {/* ----------------------------------------------------------- */}
                <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                      Company Stamp / Seal
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Version {branding?.stamp.version || 1}.0
                    </span>
                  </div>

                  {/* Current Stamp Preview */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      Current Stamp / Seal Preview
                    </label>
                    <div className="h-24 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center p-2 relative overflow-hidden">
                      {branding?.stamp.stamp_url ? (
                        <img
                          src={branding.stamp.stamp_url}
                          alt="Current Company Stamp"
                          className="max-h-20 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No stamp asset</span>
                      )}
                    </div>
                  </div>

                  {/* Upload New / Replace Stamp */}
                  <div>
                    <input
                      type="file"
                      ref={stampFileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('stamp', file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingStamp}
                      aria-busy={uploadingStamp}
                      aria-disabled={uploadingStamp}
                      onClick={() => stampFileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-bold transition shadow-2xs disabled:opacity-50"
                    >
                      {uploadingStamp ? <LoadingSpinner size="xs" variant="primary" /> : <Upload className="h-3.5 w-3.5" />}
                      <span>{uploadingStamp ? 'Uploading Official Stamp...' : 'Upload / Replace Official Stamp'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 block mt-1 text-center">
                      PNG with transparent background preferred • Max 3MB
                    </span>
                  </div>

                  <div className="space-y-3 pt-2 text-xs">
                    <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                      <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                        <span>Immutability & Snapshot Guarantee</span>
                      </div>
                      Approved documents freeze the signature and stamp version at issuance. Uploading or replacing an asset establishes a new version for future documents without modifying finalized historical records.
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Status</label>
                        <select
                          value={stampActive ? 'active' : 'disabled'}
                          onChange={(e) => setStampActive(e.target.value === 'active')}
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium"
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Effective From</label>
                        <input
                          type="date"
                          value={stampEffective}
                          onChange={(e) => setStampEffective(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  All configuration updates are permanently audit logged.
                </span>

                <button
                  type="submit"
                  disabled={saving}
                  aria-busy={saving}
                  aria-disabled={saving}
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <LoadingSpinner size="xs" variant="white" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span>{saving ? 'Saving Branding Metadata...' : 'Save Branding Metadata'}</span>
                </button>
              </div>

            </form>
          )}
        </div>

        {/* Company Identity (Requirement 8) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              Corporate Legal Entity & Metadata
            </h2>
            <button
              type="button"
              onClick={() => setEditMetaModalOpen(true)}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition border border-blue-200"
            >
              Edit Metadata
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Brand Name</span>
              <span className="font-bold text-slate-900">{corporateMetadata?.brand_name || 'Varsaka Labs'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Legal Entity</span>
              <span className="font-bold text-slate-900">{corporateMetadata?.legal_entity || 'Varsaka Labs Pvt. Ltd.'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Corporate Website</span>
              <span className="font-mono text-blue-600">{corporateMetadata?.corporate_website || 'https://varsaka.com'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Corporate Communications</span>
              <span className="font-mono text-slate-700">{corporateMetadata?.corporate_email || 'info@varsakalabs.com'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Corporate Identity Number (CIN)</span>
              <span className="font-mono font-bold text-slate-800">{corporateMetadata?.cin || 'U72900TG2023PTC178920'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Last Metadata Revision</span>
              <span className="text-slate-600">{corporateMetadata?.updated_at ? new Date(corporateMetadata.updated_at).toLocaleString() : 'System Baseline'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400 block mb-0.5">Registered Office Address</span>
              <span className="text-slate-800 leading-relaxed">
                {corporateMetadata?.registered_office_address || 'APHB Colony, JV Colony, Indira Nagar, Gachibowli, Hyderabad, Telangana 500032'}
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

        {/* Canonical Public Domain & QR Policy (Requirements 16 & 17) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              Canonical Public Domain & QR Policy
            </h2>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              (process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || '').startsWith('https')
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {(process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || '').startsWith('https')
                ? 'PRODUCTION CANONICAL DOMAIN CONFIGURED'
                : 'ENVIRONMENT CONFIGURATION ACTIVE'}
            </span>
          </div>

          <div className="text-xs space-y-3 text-slate-700 leading-relaxed">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs">
              <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase mb-1">
                Active Canonical Verification Domain:
              </span>
              <strong className="text-blue-700 text-sm">
                {process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://varsaka.com')}
              </strong>
            </div>

            <p>
              Generated document QR codes encode: <code>{process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://varsaka.com')}/verify/[verificationId]</code>. When deployed across alternate enterprise domains, this adapts dynamically from <code>NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL</code> without hardcoded host dependencies.
            </p>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-950 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
              <span>
                <strong>Verification Safety Policy:</strong> Production document generation validates that canonical domain configuration is present and halts generation if unconfigured to prevent localhost leakage.
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECURITY & TWO-FACTOR AUTHENTICATION (TOTP)                       */}
        {/* ================================================================= */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              SECURITY &amp; TWO-FACTOR AUTHENTICATION (TOTP)
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              Standard: RFC 6238 TOTP
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${mfaStatus?.isEnabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">Authenticator App MFA</h3>
                  {mfaStatus?.isEnabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Active &amp; Enrolled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      <AlertCircle className="h-3 w-3" />
                      Not Enrolled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed max-w-xl">
                  {mfaStatus?.isEnabled
                    ? 'Your account is secured with a time-based one-time password (TOTP). Compatible with Google Authenticator, Microsoft Authenticator, and Authy.'
                    : 'Add an extra layer of security to your Varsaka HR account. A 6-digit verification code from your authenticator app will be required at login.'}
                </p>
                {mfaStatus?.lastUsedAt && (
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Last authenticated via TOTP: {formatDate(mfaStatus.lastUsedAt)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMfaModalOpen(true)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs shrink-0 cursor-pointer ${
                mfaStatus?.isEnabled
                  ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {mfaStatus?.isEnabled ? 'Reconfigure Authenticator' : 'Set Up Authenticator'}
            </button>
          </div>
        </div>

      </div>

      {/* Edit Corporate Metadata Modal (Requirement 8) */}
      {editMetaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Corporate Legal Entity & Metadata
                </h3>
                <p className="text-xs text-slate-500">
                  Modifications are validated, applied to new documents, and audit logged.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCorporateMetadata} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={metaForm.brand_name}
                    onChange={(e) => setMetaForm({ ...metaForm, brand_name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Legal Entity *</label>
                  <input
                    type="text"
                    required
                    value={metaForm.legal_entity}
                    onChange={(e) => setMetaForm({ ...metaForm, legal_entity: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Corporate Website *</label>
                  <input
                    type="url"
                    required
                    value={metaForm.corporate_website}
                    onChange={(e) => setMetaForm({ ...metaForm, corporate_website: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    value={metaForm.corporate_email}
                    onChange={(e) => setMetaForm({ ...metaForm, corporate_email: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Corporate Identity Number (CIN)</label>
                <input
                  type="text"
                  value={metaForm.cin}
                  onChange={(e) => setMetaForm({ ...metaForm, cin: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Registered Office Address *</label>
                <textarea
                  rows={2}
                  required
                  value={metaForm.registered_office_address}
                  onChange={(e) => setMetaForm({ ...metaForm, registered_office_address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingMeta}
                  onClick={() => setEditMetaModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMeta}
                  aria-busy={savingMeta}
                  aria-disabled={savingMeta}
                  className="w-full sm:w-auto justify-center px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {savingMeta && <LoadingSpinner size="xs" variant="white" />}
                  <span>{savingMeta ? 'Saving Corporate Metadata...' : 'Save Corporate Metadata'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Enrollment Modal */}
      {mfaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={() => {
                setMfaModalOpen(false);
                fetchMfaStatus();
              }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <MfaEnrollmentCard
              title="Configure Authenticator MFA"
              subtitle="Scan the QR code with Google Authenticator, Microsoft Authenticator, or Authy."
              onSuccess={() => {
                setMfaModalOpen(false);
                fetchMfaStatus();
                setMessage({ type: 'success', text: 'Authenticator configured successfully!' });
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

