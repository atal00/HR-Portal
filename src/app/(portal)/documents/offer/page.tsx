'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { OfferLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { calculateSalaryBreakdown, formatCurrency } from '@/lib/utils';
import { OfferLetterTemplate } from '@/components/documents/OfferLetterTemplate';
import { FileText, Eye, CheckCircle2, Sparkles, Building2, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GenerateOfferLetterPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue } = useForm<OfferLetterData>({
    defaultValues: {
      offerType: 'direct-fulltime',
      offerDate: new Date().toISOString().split('T')[0],
      candidateName: 'Atal Kumar Pandey',
      candidateAddress: `Ward No 02, Chhawani,\nBanuchhapar, Sant Kabir Road,\nPO Banuchhapar, Dist :- West Champaran,\nBihar- 845438`,
      designation: 'Finance & Operations Analyst',
      department: 'Finance & Operations',
      joiningDate: new Date().toISOString().split('T')[0],
      employeeCode: 'VL 1083',
      annualCtc: 500000,
      annualCtcWords: 'Five Lakh Rupees Only',
      bondPeriodMonths: 24,
      bondPenaltyAmount: 300000,
      noticePeriodMonths: 3,
      basic: 16667,
      hra: 8333,
      communicationAllowance: 4167,
      travelAllowance: 4167,
      foodAllowance: 4167,
      otherAllowances: 4167,
      monthlyGrossSalary: 41668,
      employeePf: 1800,
      employerPf: 1800,
      professionalTax: 200,
      gratuity: 801,
      tds: 0,
      monthlyNetSalary: 37066,
      yearlyVariable: 0,
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
      setValue('candidateName', emp.full_name);
      setValue('candidateAddress', emp.address);
      setValue('designation', emp.designation);
      setValue('department', emp.department_name || 'General');
      setValue('employeeCode', emp.employee_id);
      setValue('joiningDate', emp.joining_date);
    }
  };

  const handleAutoCalculate = () => {
    const b = calculateSalaryBreakdown(formValues.annualCtc, formValues.yearlyVariable);
    setValue('basic', b.basic);
    setValue('hra', b.hra);
    setValue('communicationAllowance', b.communicationAllowance);
    setValue('travelAllowance', b.travelAllowance);
    setValue('foodAllowance', b.foodAllowance);
    setValue('otherAllowances', b.otherAllowances);
    setValue('monthlyGrossSalary', b.monthlyGross);
    setValue('employeePf', b.employeePf);
    setValue('employerPf', b.employerPf);
    setValue('professionalTax', b.professionalTax);
    setValue('gratuity', b.gratuity);
    setValue('tds', b.tds);
    setValue('monthlyNetSalary', b.netSalary);
    setValue('annualCtcWords', b.annualCtcWords);
  };

  const onSubmit = async (data: OfferLetterData) => {
    setGenerating(true);
    setError(null);

    try {
      // Find employee ID or pick default
      let empId = selectedEmpId;
      if (!empId) {
        const matched = employees.find((e) => e.employee_id === data.employeeCode);
        empId = matched ? matched.id : (employees[0]?.id || 'emp-atal-pandey-1083');
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'OFFER_LETTER',
          employee_id: empId,
          title: `Full-Time Offer Letter - ${data.candidateName}`,
          data_snapshot: data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to generate offer letter.');
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
      
      {/* Top Bar */}
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
              <FileText className="h-5 w-5 text-blue-600" />
              Full-Time Offer Letter Generator
            </h1>
            <p className="text-xs text-slate-500">
              16-17 Page authentic Varsaka contract with Annexures 1A through III B
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'form' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Configuration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Live Preview (16 Pages)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Generation Error:</strong> {error}
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Quick Select Employee */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-blue-950 font-bold">
              <User className="h-4 w-4 text-blue-600" />
              <span>Select Existing Candidate / Employee:</span>
            </div>
            <select
              value={selectedEmpId}
              onChange={(e) => handleSelectEmployee(e.target.value)}
              className="px-3 py-1.5 border border-blue-300 rounded-lg bg-white text-blue-950 font-medium outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">-- Choose from Employee Directory --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_id}) - {emp.designation}
                </option>
              ))}
            </select>
          </div>

          {/* Form Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Candidate & Contract Info */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
              <h2 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Candidate Details</h2>
              
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Candidate Name</label>
                <input
                  {...register('candidateName', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Designation</label>
                <input
                  {...register('designation', { required: true })}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department</label>
                  <input
                    {...register('department')}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Employee Code</label>
                  <input
                    {...register('employeeCode')}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Offer Date</label>
                  <input
                    type="date"
                    {...register('offerDate')}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date of Joining</label>
                  <input
                    type="date"
                    {...register('joiningDate')}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Residential Address</label>
                <textarea
                  rows={3}
                  {...register('candidateAddress')}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bond Period (Months)</label>
                  <input
                    type="number"
                    {...register('bondPeriodMonths', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bond Penalty (₹)</label>
                  <input
                    type="number"
                    {...register('bondPenaltyAmount', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Compensation & Annexure 1A Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="font-bold text-slate-900">Annexure 1A: CTC Breakdown</h2>
                <button
                  type="button"
                  onClick={handleAutoCalculate}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-200 transition"
                >
                  <Sparkles className="h-3 w-3" />
                  Auto-Calculate Breakup
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Annual CTC (₹)</label>
                  <input
                    type="number"
                    {...register('annualCtc', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Yearly Variable (₹)</label>
                  <input
                    type="number"
                    {...register('yearlyVariable', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="text-slate-500 block">Basic Pay:</label>
                  <input {...register('basic', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-500 block">HRA:</label>
                  <input {...register('hra', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-500 block">Internet / Comm:</label>
                  <input {...register('communicationAllowance', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-500 block">Travel Allowance:</label>
                  <input {...register('travelAllowance', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-500 block">Food Allowance:</label>
                  <input {...register('foodAllowance', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-500 block">Other Allowance:</label>
                  <input {...register('otherAllowances', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-red-50/50 p-3 rounded-lg border border-red-200">
                <div>
                  <label className="text-red-700 block">Employee PF:</label>
                  <input {...register('employeePf', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-red-700 block">Employer PF:</label>
                  <input {...register('employerPf', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-red-700 block">Prof. Tax (PT):</label>
                  <input {...register('professionalTax', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-red-700 block">Gratuity:</label>
                  <input {...register('gratuity', { valueAsNumber: true })} className="w-full p-1 border rounded font-mono" />
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="text-emerald-800 font-semibold block">Monthly Net In-Hand:</span>
                  <span className="font-mono font-bold text-emerald-950 text-base">
                    {formatCurrency(formValues.monthlyNetSalary)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-800 font-semibold block">Monthly Gross:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatCurrency(formValues.monthlyGrossSalary)}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {generating ? 'Registering Document...' : 'Generate & Send for Approval'}
            </button>
          </div>

        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Live Preview of 16-page contract generated with dynamic fields.
            </span>
            <button
              onClick={() => setActiveTab('form')}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              Back to Form
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden p-4 bg-slate-200">
            <OfferLetterTemplate
              data={formValues}
              documentNumber="VAR-OFF-PREVIEW"
              verificationId="VVR-OFF-PREVIEW"
              verificationUrl="http://localhost:3000/verify/VVR-OFF-PREVIEW"
            />
          </div>
        </div>
      )}

    </div>
  );
}
