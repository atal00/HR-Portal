'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { RelievingLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { RelievingLetterTemplate } from '@/components/documents/RelievingLetterTemplate';
import { FileSpreadsheet, Eye, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GenerateRelievingLetterPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue } = useForm<RelievingLetterData>({
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
      resignationDate: '2026-02-15',
      relievingDate: new Date().toISOString().split('T')[0],
      clearanceStatus: 'Satisfactorily Completed - All dues & company property cleared',
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
      setValue('relievingDate', emp.last_working_date || new Date().toISOString().split('T')[0]);
    }
  };

  const onSubmit = async (data: RelievingLetterData) => {
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
          document_type: 'RELIEVING_LETTER',
          employee_id: empId,
          title: `Relieving & Separation Letter - ${data.employeeName}`,
          data_snapshot: data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to generate relieving letter.');
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
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              Relieving & Separation Letter Generator
            </h1>
            <p className="text-xs text-slate-500">
              Official separation order with confirmed relieving date, department clearance, and handover verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'form' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Configuration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
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
          
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-purple-950 font-bold">
              <User className="h-4 w-4 text-purple-600" />
              <span>Select Employee from Directory:</span>
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="px-3 py-1.5 border border-purple-300 rounded-lg bg-white text-purple-950 font-medium outline-none focus:ring-2 focus:ring-purple-600"
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
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employee ID</label>
                <input
                  {...register('employeeId', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation</label>
                <input
                  {...register('designation', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department</label>
                <input
                  {...register('department', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Joining</label>
                <input
                  type="date"
                  {...register('joiningDate', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Last Working Date</label>
                <input
                  type="date"
                  {...register('lastWorkingDate', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Resignation Submission Date (Optional)</label>
                <input
                  type="date"
                  {...register('resignationDate')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Effective Relieving Date</label>
                <input
                  type="date"
                  {...register('relievingDate', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employment Type</label>
                <input
                  {...register('employmentType', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
                <input
                  {...register('workLocation', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Authorized Signatory Name</label>
                <input
                  {...register('authorizedSignatoryName', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Authorized Signatory Title</label>
                <input
                  {...register('authorizedSignatoryTitle', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Clearance & Settlement Status</label>
              <textarea
                {...register('clearanceStatus')}
                rows={2}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Preview Document
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {generating ? 'Registering Document...' : 'Generate Official Relieving Letter'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 overflow-x-auto">
            <RelievingLetterTemplate
              data={formValues}
              documentNumber="VAR-REL-PREVIEW"
              verificationId="VVR-REL-PREVIEW"
              verificationUrl="http://localhost:3000/verify/VVR-REL-PREVIEW"
            />
          </div>
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Back to Form
            </button>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={generating}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {generating ? 'Registering...' : 'Approve & Issue Document'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
