'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { SalarySlipData } from '@/types/document';
import { Employee } from '@/types/database';
import { numberToWordsINR } from '@/lib/utils';
import { SalarySlipTemplate } from '@/components/documents/SalarySlipTemplate';
import { Banknote, Eye, CheckCircle2, User, ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/Loading';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function GenerateSalarySlipPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue } = useForm<SalarySlipData>({
    defaultValues: {
      month: MONTHS[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1],
      year: new Date().getFullYear(),
      employeeId: '',
      employeeName: '',
      designation: '',
      department: '',
      joiningDate: '',
      bankAccountNumber: '',
      panNumber: '',
      pfNumber: '',
      paidDays: 30,
      lossOfPayDays: 0,
      basic: 0,
      hra: 0,
      communicationAllowance: 0,
      travelAllowance: 0,
      foodAllowance: 0,
      otherAllowances: 0,
      grossSalary: 0,
      employeePf: 0,
      employerPf: 0,
      professionalTax: 0,
      gratuity: 0,
      tds: 0,
      totalDeductions: 0,
      netSalary: 0,
      netSalaryInWords: 'Zero Rupees Only',
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

  const handleSelectEmployee = async (empId: string, preloadedEmp?: Employee) => {
    setSelectedEmpId(empId);
    const emp = preloadedEmp || employees.find((e) => e.id === empId);
    if (!emp) return;

    const actualDept = emp.department_name || emp.department || emp.custom_department || '';

    setValue('employeeName', emp.full_name);
    setValue('employeeId', emp.employee_id);
    setValue('designation', emp.designation);
    setValue('department', actualDept);
    setValue('joiningDate', emp.joining_date);

    // Automatically fetch confidential salary structure for this employee
    try {
      const salRes = await fetch(`/api/salary/${emp.id}`);
      if (salRes.ok) {
        const sal: any = await salRes.json();
        const basic = Number(sal.basic ?? sal.basic_pay ?? 0);
        const hra = Number(sal.hra ?? 0);
        const comm = Number(sal.communication_allowance ?? sal.internet_allowance ?? 0);
        const travel = Number(sal.travel_allowance ?? 0);
        const food = Number(sal.food_allowance ?? 0);
        const other = Number(sal.other_allowances ?? sal.other_allowance ?? 0);
        const gross = Number(sal.monthly_gross ?? (basic + hra + comm + travel + food + other));
        const empPf = Number(sal.employee_pf ?? sal.employee_pf_contribution ?? 0);
        const emplyrPf = Number(sal.employer_pf ?? sal.employer_pf_contribution ?? 0);
        const pt = Number(sal.professional_tax ?? sal.prof_tax ?? 0);
        const grat = Number(sal.gratuity ?? 0);
        const tds = Number(sal.tds ?? sal.other_deductions ?? 0);

        setValue('basic', basic);
        setValue('hra', hra);
        setValue('communicationAllowance', comm);
        setValue('travelAllowance', travel);
        setValue('foodAllowance', food);
        setValue('otherAllowances', other);
        setValue('grossSalary', gross);
        setValue('employeePf', empPf);
        setValue('employerPf', emplyrPf);
        setValue('professionalTax', pt);
        setValue('gratuity', grat);
        setValue('tds', tds);

        const totalDed = empPf + emplyrPf + pt + grat + tds;
        setValue('totalDeductions', totalDed);
        const net = sal.net_salary !== undefined && sal.net_salary !== null ? Number(sal.net_salary) : Math.max(0, gross - totalDed);
        setValue('netSalary', net);
        setValue('netSalaryInWords', numberToWordsINR(net));

        // Employee-specific PAN
        const pan = sal.pan_number || emp.pan_number || '';
        setValue('panNumber', pan);

        // Employee-specific Bank Info
        const bankName = sal.bank_name || emp.bank_name || '';
        const acct = sal.bank_account_number || emp.bank_account_number || '';
        let bankDisplay = '';
        if (acct) {
          const masked = acct.length > 4 ? `•••• ${acct.slice(-4)}` : acct;
          bankDisplay = bankName ? `${bankName} - ${masked}` : masked;
        }
        setValue('bankAccountNumber', bankDisplay);
        setValue('pfNumber', sal.pf_number || emp.pf_number || '');
      } else {
        // Fallback to employee records if salary API not yet configured
        const pan = emp.pan_number || '';
        setValue('panNumber', pan);
        const bankName = emp.bank_name || '';
        const acct = emp.bank_account_number || '';
        let bankDisplay = '';
        if (acct) {
          const masked = acct.length > 4 ? `•••• ${acct.slice(-4)}` : acct;
          bankDisplay = bankName ? `${bankName} - ${masked}` : masked;
        }
        setValue('bankAccountNumber', bankDisplay);
        setValue('pfNumber', emp.pf_number || '');
      }
    } catch (e) {
      console.error('Error fetching payroll record:', e);
    }
  };

  const onSubmit = async (data: SalarySlipData) => {
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
          document_type: 'SALARY_SLIP',
          employee_id: empId,
          title: `Monthly Salary Slip - ${data.month} ${data.year} (${data.employeeName})`,
          data_snapshot: data,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to generate salary slip.');
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
              <Banknote className="h-5 w-5 text-emerald-600" />
              Monthly Salary Slip Generator
            </h1>
            <p className="text-xs text-slate-500">
              Auto-populates from payroll record with amount in words and QR verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md transition ${activeTab === 'form' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Configuration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
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
          
          {/* Employee & Month Selection */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-emerald-950 font-bold block mb-1">Select Employee:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg bg-white text-emerald-950 font-medium outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-emerald-950 font-bold block mb-1">Payroll Month:</label>
              <select
                {...register('month')}
                className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg bg-white text-emerald-950 font-medium outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-emerald-950 font-bold block mb-1">Payroll Year:</label>
              <input
                type="number"
                {...register('year', { valueAsNumber: true })}
                className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg bg-white text-emerald-950 font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Dual Column Form: Earnings & Deductions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            
            {/* Earnings */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 border-b pb-2">Monthly Earnings</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1">Basic Salary (₹)</label>
                  <input type="number" {...register('basic', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">HRA (₹)</label>
                  <input type="number" {...register('hra', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Internet & Comm. (₹)</label>
                  <input type="number" {...register('communicationAllowance', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Travel Allowance (₹)</label>
                  <input type="number" {...register('travelAllowance', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Food Allowance (₹)</label>
                  <input type="number" {...register('foodAllowance', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Other Allowances (₹)</label>
                  <input type="number" {...register('otherAllowances', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono" />
                </div>
              </div>

              <div className="pt-2">
                <label className="font-bold text-slate-900 block mb-1">Monthly Gross (₹)</label>
                <input type="number" {...register('grossSalary', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono font-bold text-sm bg-slate-50" />
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h2 className="font-bold text-slate-900 border-b pb-2">Monthly Deductions</h2>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1">Employee PF (₹)</label>
                  <input type="number" {...register('employeePf', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Employer PF (₹)</label>
                  <input type="number" {...register('employerPf', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Professional Tax (₹)</label>
                  <input type="number" {...register('professionalTax', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Gratuity (₹)</label>
                  <input type="number" {...register('gratuity', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">TDS / Income Tax (₹)</label>
                  <input type="number" {...register('tds', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700" />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Total Deductions (₹)</label>
                  <input type="number" {...register('totalDeductions', { valueAsNumber: true })} className="w-full p-2 border rounded font-mono text-red-700 font-bold bg-red-50" />
                </div>
              </div>

              <div className="pt-2">
                <label className="font-bold text-emerald-800 block mb-1">Net Disbursed Take-home (₹)</label>
                <input type="number" {...register('netSalary', { valueAsNumber: true })} className="w-full p-2 border border-emerald-300 rounded font-mono font-bold text-sm bg-emerald-50 text-emerald-950" />
              </div>
            </div>

          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview Pay Slip
            </button>
            <button
              type="submit"
              disabled={generating}
              aria-busy={generating}
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 select-none cursor-pointer"
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" variant="white" label="Generating Salary Slip..." />
                  <span>Generating Salary Slip...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Generate &amp; Issue Salary Slip</span>
                </>
              )}
            </button>
          </div>

        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Live Preview of official Monthly Salary Slip
            </span>
            <button
              onClick={() => setActiveTab('form')}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 text-center"
            >
              Back to Form
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-x-auto p-2 sm:p-6 bg-slate-200 flex justify-start md:justify-center">
            <div className="min-w-[794px] shrink-0">
              <SalarySlipTemplate
                data={formValues}
                documentNumber="VAR-SAL-PREVIEW"
                verificationId="VVR-SAL-PREVIEW"
                verificationUrl="http://localhost:3000/verify/VVR-SAL-PREVIEW"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
