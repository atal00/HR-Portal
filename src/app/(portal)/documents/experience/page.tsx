'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ExperienceLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { ExperienceLetterTemplate } from '@/components/documents/ExperienceLetterTemplate';
import { FileSpreadsheet, Eye, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
      employeeName: 'Test Employee 001',
      employeeId: 'VL 1083',
      designation: 'Finance & Operations Analyst',
      department: 'Finance & Operations',
      joiningDate: '2025-12-01',
      lastWorkingDate: new Date().toISOString().split('T')[0],
      employmentType: 'Full-Time Regular',
      workLocation: 'Hyderabad, India',
      conductAppreciation: 'Their character, professional conduct, and demeanor during their tenure with Varsaka Labs were found to be exemplary.',
      authorizedSignatoryName: 'Authorized Signatory',
      authorizedSignatoryTitle: 'Head of Human Resources',
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
      setValue('employeeName', emp.full_name);
      setValue('employeeId', emp.employee_id);
      setValue('designation', emp.designation);
      setValue('department', emp.department_name || 'General');
      setValue('joiningDate', emp.joining_date);
      setValue('lastWorkingDate', emp.last_working_date || new Date().toISOString().split('T')[0]);
      setValue('employmentType', emp.employment_type);
      setValue('workLocation', emp.work_location);
    }
  };

  const onSubmit = async (data: ExperienceLetterData) => {
    setGenerating(true);
    setError(null);

    try {
      let empId = selectedEmpId;
      if (!empId) {
        const matched = employees.find((e) => e.employee_id === data.employeeId);
        empId = matched ? matched.id : (employees[0]?.id || 'emp-test-001');
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
              Official separation certificate with confirmed dates, role, and conduct appraisal
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
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Generation Error:</strong> {error}
        </div>
      )}

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-indigo-950 font-bold">
              <User className="h-4 w-4 text-indigo-600" />
              <span>Select Employee from Directory:</span>
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

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee Name</label>
                <input
                  {...register('employeeName', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee ID</label>
                <input
                  {...register('employeeId', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation</label>
                <input
                  {...register('designation', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department</label>
                <input
                  {...register('department', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Joining Date</label>
                <input
                  type="date"
                  {...register('joiningDate', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Last Working Date</label>
                <input
                  type="date"
                  {...register('lastWorkingDate', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
                <input
                  {...register('workLocation')}
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
                <label className="font-semibold text-slate-700 block mb-1">Conduct & Appraisal Remarks</label>
                <textarea
                  rows={2}
                  {...register('conductAppreciation')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600"
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
              Preview Letter
            </button>
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {generating ? 'Submitting...' : 'Generate & Submit for Approval'}
            </button>
          </div>

        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Live Preview of official Experience & Relieving Certificate
            </span>
            <button
              onClick={() => setActiveTab('form')}
              className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
            >
              Back to Form
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden p-6 bg-slate-200">
            <ExperienceLetterTemplate
              data={formValues}
              documentNumber="VAR-EXP-PREVIEW"
              verificationId="VVR-EXP-PREVIEW"
              verificationUrl="http://localhost:3000/verify/VVR-EXP-PREVIEW"
            />
          </div>
        </div>
      )}

    </div>
  );
}
