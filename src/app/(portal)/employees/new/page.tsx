'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { calculateSalaryBreakdown, formatCurrency } from '@/lib/utils';
import { ArrowLeft, Save, Sparkles, Building2, User, Banknote } from 'lucide-react';

interface EmployeeFormData {
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  department_id: string;
  designation: string;
  joining_date: string;
  employment_type: 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';
  work_location: string;
  reporting_manager: string;
  status: 'ACTIVE' | 'INTERN' | 'ON_NOTICE' | 'SEPARATED' | 'INACTIVE';
  
  // Salary
  annual_ctc: number;
  variable_pay: number;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EmployeeFormData>({
    defaultValues: {
      employee_id: 'VL 1086',
      full_name: '',
      email: '',
      phone: '+91 ',
      address: '',
      department_id: 'dept-eng',
      designation: 'Software Development Engineer',
      joining_date: new Date().toISOString().split('T')[0],
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      reporting_manager: 'Rajesh Nair',
      status: 'ACTIVE',
      annual_ctc: 600000,
      variable_pay: 0,
    }
  });

  const annualCtc = watch('annual_ctc') || 0;
  const variablePay = watch('variable_pay') || 0;
  const breakdown = calculateSalaryBreakdown(annualCtc, variablePay);

  const onSubmit = async (data: EmployeeFormData) => {
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create Employee
      const empRes = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: data.employee_id,
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          department_id: data.department_id,
          designation: data.designation,
          joining_date: data.joining_date,
          employment_type: data.employment_type,
          work_location: data.work_location,
          reporting_manager: data.reporting_manager,
          status: data.status,
        }),
      });

      const empData = await empRes.json();
      if (!empRes.ok) {
        throw new Error(empData.error || 'Failed to create employee profile.');
      }

      // 2. Create Initial Salary Record
      await fetch(`/api/salary/${empData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annual_ctc: breakdown.annualCtc,
          monthly_gross: breakdown.monthlyGross,
          basic: breakdown.basic,
          hra: breakdown.hra,
          communication_allowance: breakdown.communicationAllowance,
          travel_allowance: breakdown.travelAllowance,
          food_allowance: breakdown.foodAllowance,
          other_allowances: breakdown.otherAllowances,
          employee_pf: breakdown.employeePf,
          employer_pf: breakdown.employerPf,
          professional_tax: breakdown.professionalTax,
          gratuity: breakdown.gratuity,
          tds: breakdown.tds,
          variable_pay: breakdown.variablePay,
          net_salary: breakdown.netSalary,
          effective_date: data.joining_date,
        }),
      });

      router.push(`/employees/${empData.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Back button & Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Onboard New Employee</h1>
            <p className="text-xs text-slate-500">Create personnel profile and initialize compensation structure</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
          <strong>Validation Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Basic Identity Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="h-4 w-4 text-blue-600" />
            Personal & Identification Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Employee ID *</label>
              <input
                {...register('employee_id', { required: true })}
                placeholder="e.g. VL 1086"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Full Legal Name *</label>
              <input
                {...register('full_name', { required: true })}
                placeholder="e.g. Atal Kumar Pandey"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Corporate Email Address *</label>
              <input
                type="email"
                {...register('email', { required: true })}
                placeholder="candidate@varsaka.com"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Contact Phone *</label>
              <input
                {...register('phone', { required: true })}
                placeholder="+91 9876543210"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Permanent Residential Address *</label>
              <textarea
                rows={2}
                {...register('address', { required: true })}
                placeholder="Door No, Street, Landmark, District, State, PIN code"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Organizational Assignment Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="h-4 w-4 text-blue-600" />
            Role & Organizational Assignment
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Department *</label>
              <select
                {...register('department_id')}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="dept-eng">Engineering & Technology</option>
                <option value="dept-fin-ops">Finance & Operations</option>
                <option value="dept-hr">Human Resources</option>
                <option value="dept-product">Product & Design</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Official Designation *</label>
              <input
                {...register('designation', { required: true })}
                placeholder="e.g. Senior QA Engineer"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Date of Joining *</label>
              <input
                type="date"
                {...register('joining_date', { required: true })}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Engagement Type</label>
              <select
                {...register('employment_type')}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="FULL_TIME">Full-Time Regular</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contractual</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
              <input
                {...register('work_location')}
                placeholder="Hyderabad, India"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reporting Manager</label>
              <input
                {...register('reporting_manager')}
                placeholder="e.g. Rajesh Nair"
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Initial Status</label>
              <select
                {...register('status')}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INTERN">INTERN</option>
                <option value="ON_NOTICE">ON_NOTICE</option>
                <option value="SEPARATED">SEPARATED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compensation Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-blue-950 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              Compensation Structure (Restricted)
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Auto-Computed Salary Model</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Annual CTC (₹) *</label>
              <input
                type="number"
                {...register('annual_ctc', { valueAsNumber: true })}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Annual Variable Pay (₹)</label>
              <input
                type="number"
                {...register('variable_pay', { valueAsNumber: true })}
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-sm"
              />
            </div>
          </div>

          {/* Auto-Breakup Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-500">Monthly Gross:</span>
              <div className="font-bold text-slate-900 font-mono mt-0.5">{formatCurrency(breakdown.monthlyGross)}</div>
            </div>
            <div>
              <span className="text-slate-500">Basic Pay (40%):</span>
              <div className="font-bold text-slate-900 font-mono mt-0.5">{formatCurrency(breakdown.basic)}</div>
            </div>
            <div>
              <span className="text-slate-500">Total Deductions:</span>
              <div className="font-bold text-red-700 font-mono mt-0.5">{formatCurrency(breakdown.totalDeductions)}</div>
            </div>
            <div>
              <span className="text-slate-500">Monthly Net (In-hand):</span>
              <div className="font-bold text-emerald-600 font-mono text-sm mt-0.5">{formatCurrency(breakdown.netSalary)}</div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/employees"
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting ? 'Registering Employee...' : 'Complete Registration'}
          </button>
        </div>

      </form>

    </div>
  );
}
