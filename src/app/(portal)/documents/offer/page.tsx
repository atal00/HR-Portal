'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { OfferLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { calculateSalaryBreakdown, formatCurrency, getPublicVerificationBaseUrl } from '@/lib/utils';
import { OfferLetterTemplate } from '@/components/documents/OfferLetterTemplate';
import { FileText, Eye, CheckCircle2, Sparkles, User, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
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
      candidateName: '',
      candidateAddress: '',
      designation: '',
      department: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employeeCode: '',
      annualCtc: 600000,
      annualCtcWords: 'Six Lakh Rupees Only',
      
      // Bond decision
      bondIncluded: false,
      bondPeriodMonths: 24,
      bondPenaltyAmount: 300000,
      bondTerms: 'You will sign the bond period of 24 months from your date of joining in the organization. You must pay the company ₹3,00,000 if the bond is broken by you.',
      bondEffectiveDate: new Date().toISOString().split('T')[0],
      noticePeriodMonths: 3,

      // Custom clause
      additionalClauses: '',

      // Salary revision
      isSalaryRevision: false,
      previousCtc: 500000,
      revisedCtc: 600000,
      revisionEffectiveDate: new Date().toISOString().split('T')[0],

      basic: 20000,
      hra: 10000,
      communicationAllowance: 5000,
      travelAllowance: 5000,
      foodAllowance: 5000,
      otherAllowances: 5000,
      monthlyGrossSalary: 50000,
      employeePf: 1800,
      employerPf: 1800,
      professionalTax: 200,
      gratuity: 962,
      tds: 0,
      monthlyNetSalary: 44438,
      yearlyVariable: 0,
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
      setValue('candidateName', emp.full_name);
      setValue('candidateAddress', emp.permanent_address || emp.address);
      setValue('designation', emp.designation);
      setValue('department', actualDept);
      setValue('employeeCode', emp.employee_id);
      setValue('joiningDate', emp.joining_date);

      // Auto-load master salary record if present
      fetch(`/api/salary/${emp.id}`)
        .then(async (res) => {
          if (res.ok) {
            const sal = await res.json();
            if (sal && sal.annual_ctc) {
              setValue('annualCtc', sal.annual_ctc);
              const b = calculateSalaryBreakdown(sal.annual_ctc, sal.variable_pay || 0);
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
            }
          }
        })
        .catch(() => {});
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
      let empId = selectedEmpId;
      if (!empId) {
        const matched = employees.find((e) => e.employee_id === data.employeeCode);
        empId = matched ? matched.id : (employees[0]?.id || 'emp-placeholder');
      }

      const docTitle = data.isSalaryRevision
        ? `Compensation Revision Offer Letter - ${data.candidateName}`
        : `Full-Time Offer Letter - ${data.candidateName}`;

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'OFFER_LETTER',
          employee_id: empId,
          title: docTitle,
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

  const verificationBase = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL || window.location.origin)
    : 'https://varsaka.com';

  return (
    <div className="space-y-6">
      
      {/* Header */}
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
              Offer Letter & Contract Generator
            </h1>
            <p className="text-xs text-slate-500">
              Generate full-time employment agreements, bond covenants, and compensation revisions
            </p>
          </div>
        </div>

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
            Live Document Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span><strong>Generation Error:</strong> {error}</span>
        </div>
      )}

      {activeTab === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Employee Selection Quick-Fill */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-blue-950 flex items-center gap-1.5">
                <User className="h-4 w-4 text-blue-600" />
                Select Existing Employee / Candidate
              </span>
              <p className="text-blue-700 text-[11px] mt-0.5">
                Auto-populates candidate credentials and actual department dynamically.
              </p>
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
              <h2 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Candidate & Role Specification</h2>
              
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Candidate Name *</label>
                <input
                  {...register('candidateName', { required: true })}
                  placeholder="Candidate full name"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Designation *</label>
                <input
                  {...register('designation', { required: true })}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Department *</label>
                  <input
                    {...register('department', { required: true })}
                    placeholder="e.g. Engineering & Technology"
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Employee Code</label>
                  <input
                    {...register('employeeCode')}
                    placeholder="e.g. EMP-VL-1001"
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Offer Issue Date</label>
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
                  rows={2}
                  {...register('candidateAddress')}
                  placeholder="Complete residential address"
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Salary Hike / Revision Toggle (Requirement 14) */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900">Is this a Salary Hike / Revision Offer Letter?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('isSalaryRevision')}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>
                {formValues.isSalaryRevision && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200">
                    <div>
                      <label className="text-[11px] font-semibold text-amber-900 block">Previous CTC (₹)</label>
                      <input
                        type="number"
                        {...register('previousCtc', { valueAsNumber: true })}
                        className="w-full p-1.5 border border-amber-300 rounded bg-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-amber-900 block">Revision Effective Date</label>
                      <input
                        type="date"
                        {...register('revisionEffectiveDate')}
                        className="w-full p-1.5 border border-amber-300 rounded bg-white text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-amber-800 col-span-2">
                      Generates a separate, immutable revision document. The original employment contract remains permanent and unaffected.
                    </p>
                  </div>
                )}
              </div>

              {/* Employment Bond Decision (Requirements 10 & 11) */}
              <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">Employment Bond Decision</span>
                    <span className="text-[11px] text-slate-500">Does this offer include an employment bond?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-xs">
                      <input
                        type="radio"
                        value="false"
                        checked={formValues.bondIncluded === false}
                        onChange={() => setValue('bondIncluded', false)}
                        className="text-blue-600"
                      />
                      <span>No</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer font-semibold text-xs text-blue-700">
                      <input
                        type="radio"
                        value="true"
                        checked={formValues.bondIncluded === true}
                        onChange={() => setValue('bondIncluded', true)}
                        className="text-blue-600"
                      />
                      <span>Yes</span>
                    </label>
                  </div>
                </div>

                {formValues.bondIncluded && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Bond Duration (Months)</label>
                        <input
                          type="number"
                          {...register('bondPeriodMonths', { valueAsNumber: true })}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Bond Penalty Amount (₹)</label>
                        <input
                          type="number"
                          {...register('bondPenaltyAmount', { valueAsNumber: true })}
                          className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Controlled Bond Clause Statement
                      </label>
                      <textarea
                        rows={2}
                        {...register('bondTerms')}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Controlled Custom Authorized Clause (Requirement 2) */}
              <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Additional Employment Clause</span>
                  <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    CUSTOM AUTHORIZED CONTENT
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Approved core company legal clauses remain immutable. Authorized HR users may enter custom operational stipulations below.
                </p>
                <textarea
                  rows={3}
                  {...register('additionalClauses')}
                  placeholder="Optional custom authorized clauses or specific work stipulations..."
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs outline-none focus:ring-2 focus:ring-blue-600"
                />
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
                  <label className="font-semibold text-slate-700 block mb-1">Annual CTC (₹) *</label>
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
              Live Preview of official offer letter contract with dynamic clauses and bond configurations.
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
              verificationUrl={`${verificationBase}/verify/VVR-OFF-PREVIEW`}
            />
          </div>
        </div>
      )}

    </div>
  );
}
