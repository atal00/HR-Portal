'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ExperienceLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { ExperienceLetterTemplate } from '@/components/documents/ExperienceLetterTemplate';
import { calculateTenure } from '@/lib/utils';
import { FileSpreadsheet, Eye, CheckCircle2, User, ArrowLeft, Clock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/Loading';

export default function GenerateExperienceLetterPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue } = useForm<ExperienceLetterData>({
    defaultValues: {
      issueDate: new Date().toISOString().split('T')[0],
      employeeName: '',
      employeeId: '',
      designation: '',
      department: '',
      joiningDate: '',
      lastWorkingDate: new Date().toISOString().split('T')[0],
      employmentType: 'Full-Time Regular',
      workLocation: 'Hyderabad, India',
      tenureText: '',
      conductAppreciation: 'Their character, professional conduct, and demeanor during their tenure with Varsaka Labs were found to be exemplary.',
      customStatement: '',
      authorizedSignatoryName: 'Authorized Signatory',
      authorizedSignatoryTitle: 'Head of Human Resources',
    }
  });

  const formValues = watch();

  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch('/api/employees?activeOnly=true');
        if (res.ok) {
          const list: Employee[] = await res.json();
          const activeList = list.filter(
            (e) => e.status !== 'INACTIVE' && e.status !== 'SEPARATED' && (e as any).deletion_status !== 'DELETED'
          );
          setEmployees(activeList);
          if (activeList.length > 0) {
            handleSelectEmployee(activeList[0].id, activeList[0]);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadEmployees();
  }, []);

  const handleSelectEmployee = (empId: string, preloadedEmp?: Employee) => {
    setSelectedEmpId(empId);
    const emp = preloadedEmp || employees.find((e) => e.id === empId);
    if (emp) {
      const actualDept = emp.department_name || emp.department || emp.custom_department || '';
      const lastDate = emp.last_working_date || new Date().toISOString().split('T')[0];
      setValue('employeeName', emp.full_name);
      setValue('employeeId', emp.employee_id);
      setValue('designation', emp.designation);
      setValue('department', actualDept);
      setValue('joiningDate', emp.joining_date);
      setValue('lastWorkingDate', lastDate);
      setValue('employmentType', emp.employment_type === 'INTERNSHIP' ? 'Internship' : 'Full-Time Regular');
      setValue('workLocation', emp.work_location);
      if (emp.joining_date && lastDate) {
        setValue('tenureText', calculateTenure(emp.joining_date, lastDate));
      }
    }
  };

  const onDatesChange = (joining: string, relieving: string) => {
    if (joining && relieving) {
      setValue('tenureText', calculateTenure(joining, relieving));
    }
  };

  const onSubmit = async (data: ExperienceLetterData) => {
    setGenerating(true);
    setError(null);

    try {
      let empId = selectedEmpId;
      if (!empId) {
        const matched = employees.find((e) => e.employee_id === data.employeeId);
        empId = matched ? matched.id : (employees[0]?.id || 'emp-placeholder');
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'EXPERIENCE_LETTER',
          employee_id: empId,
          title: `Experience & Relieving Certificate - ${data.employeeName}`,
          data_snapshot: data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to generate experience letter.');
      }

      router.push(`/documents/${resData.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const verificationBase = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || window.location.origin)
    : 'https://varsaka.com';

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
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              Experience & Relieving Certificate Generator
            </h1>
            <p className="text-xs text-slate-500">
              Official separation certificate with dynamic department, verified tenure calculation, and custom issuer statement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'form' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Configuration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Live Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <strong>Generation Error:</strong> {error}
        </div>
      )}

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Quick Select Employee */}
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <User className="h-4 w-4 text-indigo-600" />
                Select Separating / Past Employee
              </span>
              <p className="text-indigo-700 text-[11px] mt-0.5">
                Pulls employee ID, actual department, and joining date dynamically.
              </p>
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="px-3 py-1.5 border border-indigo-300 rounded-lg bg-white text-indigo-950 font-medium outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_id}) - {emp.designation}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h2 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              Certificate Details & Verification Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee Full Name *</label>
                <input
                  {...register('employeeName', { required: true })}
                  placeholder="Full legal employee name"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee ID *</label>
                <input
                  {...register('employeeId', { required: true })}
                  placeholder="e.g. EMP-VL-1001"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation *</label>
                <input
                  {...register('designation', { required: true })}
                  placeholder="Official job title"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department (Dynamic) *</label>
                <input
                  {...register('department', { required: true })}
                  placeholder="e.g. Engineering & Technology"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Joining Date *</label>
                <input
                  type="date"
                  {...register('joiningDate', { required: true })}
                  onChange={(e) => {
                    setValue('joiningDate', e.target.value);
                    onDatesChange(e.target.value, formValues.lastWorkingDate);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Relieving / Last Working Date *</label>
                <input
                  type="date"
                  {...register('lastWorkingDate', { required: true })}
                  onChange={(e) => {
                    setValue('lastWorkingDate', e.target.value);
                    onDatesChange(formValues.joiningDate, e.target.value);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Dynamic Tenure Calculation Display */}
              <div className="sm:col-span-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    Dynamically Calculated Tenure
                  </span>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Calculated automatically from joining date to relieving date.
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-sm text-indigo-950 bg-white px-2.5 py-1 rounded border border-indigo-200">
                    {formValues.tenureText || (formValues.joiningDate && formValues.lastWorkingDate ? calculateTenure(formValues.joiningDate, formValues.lastWorkingDate) : 'Pending Dates')}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
                <input
                  {...register('workLocation')}
                  placeholder="e.g. Hyderabad, India"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Issue Date</label>
                <input
                  type="date"
                  {...register('issueDate')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Approved Standard Conduct Remarks</label>
                <textarea
                  rows={2}
                  {...register('conductAppreciation')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Editable Issuer Additional Statement (Requirement 1C) */}
              <div className="sm:col-span-2 p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Additional Certificate Statement (Controlled Issuer Remarks)
                  </span>
                  <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    CONTROLLED ISSUER SECTION
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Approved standard wording remains as default. Authorized HR issuers can optionally modify or add special professional commendations below. Final wording is permanently frozen in document snapshot.
                </p>
                <textarea
                  rows={3}
                  {...register('customStatement')}
                  placeholder="Optional custom professional statement or commendation added by authorized issuer..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-600"
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
              Preview Document
            </button>
            <button
              type="submit"
              disabled={generating}
              aria-busy={generating}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 select-none cursor-pointer"
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" variant="white" label="Generating Experience Letter..." />
                  <span>Generating Experience Letter...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Generate &amp; Send for Approval</span>
                </>
              )}
            </button>
          </div>

        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Live Preview of official separation certificate.
            </span>
            <button
              onClick={() => setActiveTab('form')}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
            >
              Back to Form
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden p-4 bg-slate-200 flex justify-center">
            <ExperienceLetterTemplate
              data={formValues}
              documentNumber="VAR-EXP-PREVIEW"
              verificationId="VVR-EXP-PREVIEW"
              verificationUrl={`${verificationBase}/verify/VVR-EXP-PREVIEW`}
            />
          </div>
        </div>
      )}

    </div>
  );
}
