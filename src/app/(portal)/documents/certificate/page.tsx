'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { CertificateData } from '@/types/document';
import { Employee } from '@/types/database';
import { CertificateTemplate } from '@/components/documents/CertificateTemplate';
import { Award, Eye, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GenerateCertificatePage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue } = useForm<CertificateData>({
    defaultValues: {
      certificateType: 'INTERNSHIP_COMPLETION',
      candidateName: 'Mr. Test Employee 001',
      projectTitle: 'Finance And Marketing Operations',
      mentorName: 'Manager Test',
      performanceGrade: 'Grade 78 (A / Outstanding)',
      tenureStartDate: '12 Jun, 2026',
      tenureEndDate: '12 Aug, 2026',
      workLocation: 'New Delhi / Work from Home',
      issueDate: new Date().toISOString().split('T')[0],
      authorizedSignatory: 'Authorized Signatory',
      companyName: 'Varsaka Labs Pvt. Ltd.',
      verificationUrl: 'http://localhost:3000/verify/VVR-CERT-PREVIEW',
    }
  });

  const formValues = watch();

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch('/api/employees');
        if (res.ok) {
          const list: Employee[] = await res.json();
          setEmployees(list);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadEmployees();
  }, []);

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setValue('candidateName', `Mr./Ms. ${emp.full_name}`);
      setValue('mentorName', emp.reporting_manager || 'Manager Test');
      setValue('workLocation', emp.work_location);
    }
  };

  const onSubmit = async (data: CertificateData) => {
    setGenerating(true);
    setError(null);

    try {
      let empId = selectedEmpId;
      if (!empId) {
        empId = employees[0]?.id || 'emp-test-001';
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'CERTIFICATE',
          employee_id: empId,
          title: `Completion Certificate - ${data.candidateName}`,
          data_snapshot: data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to generate certificate.');
      }

      router.push(`/documents/${resData.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              Varsaka Labs Certificate Generator
            </h1>
            <p className="text-xs text-slate-500">
              Formal certificate with gold double border, official seal, authorized signature, and live QR
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'form' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Configuration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Live Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Generation Error:</strong> {error}
        </div>
      )}

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-950 font-bold">
              <User className="h-4 w-4 text-amber-600" />
              <span>Select Recipient Employee:</span>
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-amber-950 font-medium outline-none focus:ring-2 focus:ring-amber-600"
            >
              <option value="">-- Choose from Directory --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Candidate Name (Honorific)</label>
                <input
                  {...register('candidateName', { required: true })}
                  placeholder="e.g. Mr. Test Employee"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Certificate Type</label>
                <select
                  {...register('certificateType')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600 bg-white"
                >
                  <option value="INTERNSHIP_COMPLETION">Summer Internship Completion</option>
                  <option value="PROJECT_EXCELLENCE">Project Excellence Certificate</option>
                  <option value="APPRECIATION">Certificate of Appreciation</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Project / Internship Title</label>
                <input
                  {...register('projectTitle', { required: true })}
                  placeholder="e.g. Finance And Marketing Operations"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mentor / Guide Name</label>
                <input
                  {...register('mentorName', { required: true })}
                  placeholder="e.g. Mr. Harsh Yadav"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Performance Grade</label>
                <input
                  {...register('performanceGrade', { required: true })}
                  placeholder="e.g. Grade 78 (A / Outstanding)"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tenure Start Date</label>
                <input
                  {...register('tenureStartDate', { required: true })}
                  placeholder="e.g. 12 Jun, 2026"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tenure End Date</label>
                <input
                  {...register('tenureEndDate', { required: true })}
                  placeholder="e.g. 12 Aug, 2026"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
                <input
                  {...register('workLocation')}
                  placeholder="e.g. New Delhi / Work from Home"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Issue Date</label>
                <input
                  type="date"
                  {...register('issueDate')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview Certificate
            </button>
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {generating ? 'Submitting...' : 'Generate & Issue Certificate'}
            </button>
          </div>

        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Live Preview of official Varsaka Labs Certificate
            </span>
            <button
              onClick={() => setActiveTab('form')}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
            >
              Back to Form
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden p-6 bg-slate-200">
            <CertificateTemplate
              data={formValues}
              documentNumber="VAR-CERT-PREVIEW"
              verificationId="VVR-CERT-PREVIEW"
              verificationUrl="http://localhost:3000/verify/VVR-CERT-PREVIEW"
            />
          </div>
        </div>
      )}

    </div>
  );
}
