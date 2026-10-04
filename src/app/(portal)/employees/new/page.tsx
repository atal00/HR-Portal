'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import { calculateCompensation, calculateNetInHand } from '@/lib/compensation';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Calculator,
  User,
  Banknote,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Edit3,
  CheckCircle2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Loading';

interface FullEmployeeFormData {
  // Controlled ID
  employee_id: string;

  // Section A - Personal Information
  full_name: string;
  father_name: string;
  mother_name: string;
  date_of_birth: string;
  gender: string;
  personal_email: string;
  email: string; // Corporate Email
  phone: string; // Primary Contact
  alternate_phone: string;
  address: string; // Permanent Address
  current_address: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;

  // Section B - Identity / Statutory
  pan_number: string;
  aadhaar_number: string;
  passport_number: string;
  uan: string;
  pf_number: string;
  esic_number: string;

  // Section C - Employment Information
  joining_date: string;
  department_id: string;
  custom_department?: string;
  designation: string;
  employment_type: 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';
  work_location: string;
  reporting_manager: string;
  probation_period: string;
  confirmation_date: string;
  notice_period: string;
  status: 'ACTIVE' | 'INTERN' | 'ON_NOTICE' | 'SEPARATED' | 'INACTIVE';
  date_of_separation?: string;
  last_working_date?: string;
  separation_reason?: string;

  // Section D - Bank & Payroll Information
  bank_name: string;
  bank_account_holder_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  salary_structure: string;
  annual_ctc: number;
  variable_pay: number;
  basic: number;
  hra: number;
  special_allowance: number;
  conveyance: number;
  other_allowances: number;
  monthly_gross: number;
  employee_pf: number;
  employer_pf: number;
  professional_tax: number;
  tds: number;
  esic: number;
  other_deductions: number;
  net_salary: number;
}

type SectionId = 'A' | 'B' | 'C' | 'D';

export default function NewEmployeePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('A');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors }
  } = useForm<FullEmployeeFormData>({
    mode: 'onBlur',
    defaultValues: {
      employee_id: 'Loading...',
      full_name: '',
      father_name: '',
      mother_name: '',
      date_of_birth: '',
      gender: 'Male',
      personal_email: '',
      email: '',
      phone: '+91 ',
      alternate_phone: '',
      address: '',
      current_address: '',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      pin_code: '',

      pan_number: '',
      aadhaar_number: '',
      passport_number: '',
      uan: '',
      pf_number: '',
      esic_number: '',

      joining_date: new Date().toISOString().split('T')[0],
      department_id: 'dept-eng',
      custom_department: '',
      designation: 'Software Development Engineer',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      reporting_manager: '',
      probation_period: '6 months',
      confirmation_date: '',
      notice_period: '60 days',
      status: 'ACTIVE',

      bank_name: '',
      bank_account_holder_name: '',
      bank_account_number: '',
      bank_ifsc: '',
      salary_structure: 'Standard Annual CTC',
      annual_ctc: 600000,
      variable_pay: 0,
      basic: 20000,
      hra: 10000,
      special_allowance: 12400,
      conveyance: 1600,
      other_allowances: 6000,
      monthly_gross: 50000,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      tds: 0,
      esic: 0,
      other_deductions: 0,
      net_salary: 45238,
    }
  });

  const watchEmpId = watch('employee_id');
  const annualCtc = watch('annual_ctc') || 0;
  const variablePay = watch('variable_pay') || 0;
  const watchDepartmentId = watch('department_id');
  const watchFullName = watch('full_name');

  // Watched deduction & earning fields for live Net In-Hand computation
  const watchMonthlyGross = watch('monthly_gross');
  const watchBasic = watch('basic');
  const watchEmployeePf = watch('employee_pf');
  const watchEmployerPf = watch('employer_pf');
  const watchPt = watch('professional_tax');
  const watchTds = watch('tds');
  const watchEsic = watch('esic');
  const watchOtherDeductions = watch('other_deductions');

  // Load next sequential employee ID on mount
  useEffect(() => {
    async function loadNextId() {
      try {
        const res = await fetch('/api/employees/next-id');
        if (res.ok) {
          const data = await res.json();
          if (data.nextId) {
            setValue('employee_id', data.nextId);
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch employee ID:', err);
        setValue('employee_id', 'AUTO');
      }
    }
    loadNextId();
  }, [setValue]);

  // Sync account holder name with legal name if empty
  useEffect(() => {
    if (watchFullName) {
      const currentHolder = watch('bank_account_holder_name');
      if (!currentHolder) {
        setValue('bank_account_holder_name', watchFullName);
      }
    }
  }, [watchFullName, setValue, watch]);

  // Live Net-In-Hand Recalculation whenever earnings or deduction fields change
  useEffect(() => {
    const gross = Number(watchMonthlyGross) || 0;
    const empPf = Number(watchEmployeePf) || 0;
    const emplyrPf = Number(watchEmployerPf) || 0;
    const pt = Number(watchPt) || 0;
    const b = Number(watchBasic) || 0;
    const gratuity = Math.round((b * 15) / (26 * 12));
    const tdsVal = Number(watchTds) || 0;
    const esicVal = Number(watchEsic) || 0;
    const otherDed = Number(watchOtherDeductions) || 0;

    const res = calculateNetInHand({
      monthlyGross: gross,
      employeePf: empPf,
      employerPf: emplyrPf,
      professionalTax: pt,
      gratuity,
      tds: tdsVal,
      esic: esicVal,
      otherDeductions: otherDed,
    });

    setValue('net_salary', res.netSalary);
  }, [
    watchMonthlyGross,
    watchBasic,
    watchEmployeePf,
    watchEmployerPf,
    watchPt,
    watchTds,
    watchEsic,
    watchOtherDeductions,
    setValue
  ]);

  // Action A: Auto-Calculate Breakdown from Annual CTC
  const handleRecalculateSalary = () => {
    const b = calculateCompensation(annualCtc, variablePay);
    setValue('basic', b.basic);
    setValue('hra', b.hra);
    setValue('monthly_gross', b.monthlyGross);
    setValue('employee_pf', b.employeePf);
    setValue('employer_pf', b.employerPf);
    setValue('professional_tax', b.professionalTax);
    setValue('tds', b.tds);
    setValue('net_salary', b.netSalary);
    setValue('special_allowance', Math.max(0, b.monthlyGross - (b.basic + b.hra + 1600)));
    setValue('conveyance', 1600);
    setValue('other_allowances', b.otherAllowances);
    toast.success('Salary component breakdown auto-calculated.');
  };

  // Action B: Calculate Net In-Hand from current values displayed in deduction fields
  const handleCalculateInHand = () => {
    const gross = Number(watch('monthly_gross')) || 0;
    const empPf = Number(watch('employee_pf')) || 0;
    const emplyrPf = Number(watch('employer_pf')) || 0;
    const pt = Number(watch('professional_tax')) || 0;
    const b = Number(watch('basic')) || 0;
    const gratuity = Math.round((b * 15) / (26 * 12));
    const tdsVal = Number(watch('tds')) || 0;
    const esicVal = Number(watch('esic')) || 0;
    const otherDedVal = Number(watch('other_deductions')) || 0;

    const res = calculateNetInHand({
      monthlyGross: gross,
      employeePf: empPf,
      employerPf: emplyrPf,
      professionalTax: pt,
      gratuity,
      tds: tdsVal,
      esic: esicVal,
      otherDeductions: otherDedVal,
    });

    setValue('net_salary', res.netSalary);
    toast.success(`Net In-Hand recalculated: ${formatCurrency(res.netSalary)}`);
  };

  const onSubmit = async (data: FullEmployeeFormData) => {
    setSubmitting(true);
    setError(null);

    // Validate Employee ID format
    if (!/^[A-Z0-9 -]{3,30}$/i.test(data.employee_id.trim())) {
      setError('Employee ID must be 3-30 alphanumeric characters (hyphens and spaces allowed).');
      setSubmitting(false);
      return;
    }

    // Ensure Step 4 Bank fields are present & validated
    const bankName = data.bank_name?.trim();
    const accountHolder = data.bank_account_holder_name?.trim();
    const accountNumber = data.bank_account_number?.trim();
    const ifsc = data.bank_ifsc?.trim().toUpperCase();

    if (!bankName) {
      setError('Bank Name is required.');
      setSubmitting(false);
      return;
    }
    if (!accountHolder) {
      setError('Account Holder Name is required.');
      setSubmitting(false);
      return;
    }
    if (!accountNumber || !/^[0-9]{9,18}$/.test(accountNumber)) {
      setError('Please provide a valid Indian Bank Account Number (9 to 18 numeric digits).');
      setSubmitting(false);
      return;
    }
    if (!ifsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setError('Please provide a valid 11-character Indian IFSC code (e.g. HDFC0001234).');
      setSubmitting(false);
      return;
    }

    // Compute final authoritative Net In-Hand from current values before saving
    const finalGross = Number(data.monthly_gross) || 0;
    const finalEmpPf = Number(data.employee_pf) || 0;
    const finalEmplyrPf = Number(data.employer_pf) || 0;
    const finalPt = Number(data.professional_tax) || 0;
    const finalBasic = Number(data.basic) || 0;
    const finalGratuity = Math.round((finalBasic * 15) / (26 * 12));
    const finalTds = Number(data.tds) || 0;
    const finalEsic = Number(data.esic) || 0;
    const finalOtherDed = Number(data.other_deductions) || 0;

    const computedNet = calculateNetInHand({
      monthlyGross: finalGross,
      employeePf: finalEmpPf,
      employerPf: finalEmplyrPf,
      professionalTax: finalPt,
      gratuity: finalGratuity,
      tds: finalTds,
      esic: finalEsic,
      otherDeductions: finalOtherDed,
    }).netSalary;

    try {
      const payload = {
        // Core & Section A
        employee_id: data.employee_id.trim(),
        full_name: data.full_name.trim(),
        father_name: data.father_name?.trim() || undefined,
        mother_name: data.mother_name?.trim() || undefined,
        date_of_birth: data.date_of_birth || undefined,
        gender: data.gender || undefined,
        personal_email: data.personal_email?.trim() || undefined,
        email: data.email.trim(),
        phone: data.phone.trim(),
        alternate_phone: data.alternate_phone?.trim() || undefined,
        address: data.address.trim(),
        current_address: data.current_address?.trim() || undefined,
        city: data.city.trim(),
        state: data.state.trim(),
        country: data.country?.trim() || 'India',
        pin_code: data.pin_code.trim(),

        // Section B - Identity / Statutory
        pan_number: data.pan_number?.trim() || undefined,
        aadhaar_number: data.aadhaar_number?.trim() || undefined,
        passport_number: data.passport_number?.trim() || undefined,
        uan: data.uan?.trim() || undefined,
        pf_number: data.pf_number?.trim() || undefined,
        esic_number: data.esic_number?.trim() || undefined,

        // Section C - Employment Details
        joining_date: data.joining_date,
        department_id: data.department_id,
        custom_department: data.custom_department?.trim() || undefined,
        designation: data.designation.trim(),
        employment_type: data.employment_type,
        work_location: data.work_location.trim(),
        reporting_manager: data.reporting_manager?.trim() || undefined,
        probation_period: data.probation_period?.trim() || undefined,
        confirmation_date: data.confirmation_date || undefined,
        notice_period: data.notice_period?.trim() || undefined,
        status: data.status,
        date_of_separation: data.date_of_separation || undefined,
        last_working_date: data.last_working_date || undefined,
        separation_reason: data.separation_reason?.trim() || undefined,

        // Section D - Bank & Payroll
        bank_name: bankName,
        bank_account_holder_name: accountHolder,
        bank_account_number: accountNumber,
        bank_ifsc: ifsc,
        salary_structure: data.salary_structure || undefined,

        // Section D - Salary Breakdown Payload
        salary: {
          annual_ctc: Number(data.annual_ctc) || 0,
          variable_pay: Number(data.variable_pay) || 0,
          monthly_gross: finalGross,
          basic: finalBasic,
          hra: Number(data.hra) || 0,
          special_allowance: Number(data.special_allowance) || 0,
          conveyance: Number(data.conveyance) || 0,
          other_allowances: Number(data.other_allowances) || 0,
          employee_pf: finalEmpPf,
          employer_pf: finalEmplyrPf,
          professional_tax: finalPt,
          gratuity: finalGratuity,
          tds: finalTds,
          esic: finalEsic,
          other_deductions: finalOtherDed,
          net_salary: computedNet,
          effective_date: data.joining_date || undefined,
        },
      };

      const empRes = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const empData = await empRes.json();
      if (!empRes.ok) {
        throw new Error(empData.error || 'Failed to create employee master record.');
      }

      toast.success('Employee onboarded successfully!');
      router.push(`/employees/${empData.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during employee creation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exactly 4 Onboarding Steps (KYC Step 5 Removed)
  const SECTIONS = [
    { id: 'A', step: 1, label: 'Personal Information', icon: User },
    { id: 'B', step: 2, label: 'Statutory & Identity', icon: ShieldCheck },
    { id: 'C', step: 3, label: 'Employment Details', icon: Briefcase },
    { id: 'D', step: 4, label: 'Bank & Payroll', icon: Banknote },
  ] as const;

  const handleNext = async (current: 'A' | 'B' | 'C') => {
    let isValid = true;
    if (current === 'A') {
      isValid = await trigger([
        'full_name',
        'gender',
        'phone',
        'address',
        'city',
        'state',
        'pin_code',
        'email',
        'employee_id'
      ]);
    } else if (current === 'B') {
      isValid = await trigger();
    } else if (current === 'C') {
      isValid = await trigger(['joining_date', 'department_id', 'designation', 'employment_type', 'work_location']);
    }

    if (!isValid) {
      toast.error('Please complete the required fields in this section before proceeding.');
      return;
    }

    if (current === 'A') setActiveSection('B');
    else if (current === 'B') setActiveSection('C');
    else if (current === 'C') setActiveSection('D');
  };

  const handleBack = (current: 'B' | 'C' | 'D') => {
    if (current === 'B') setActiveSection('A');
    else if (current === 'C') setActiveSection('B');
    else if (current === 'D') setActiveSection('C');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Onboard New Employee — Central Master Data
            </h1>
            <p className="text-xs text-slate-500">
              Primary employee source-of-truth feeding offer letters, relieving orders, and payroll
            </p>
          </div>
        </div>

        {/* Controlled Employee ID Component */}
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500">Employee ID:</span>
          {isEditingId ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                {...register('employee_id', { required: true })}
                className="font-mono text-xs font-bold px-2 py-0.5 border border-blue-400 rounded bg-blue-50/50 text-blue-900 outline-none w-28 uppercase"
                placeholder="VL 1087"
              />
              <button
                type="button"
                onClick={() => setIsEditingId(false)}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded transition flex items-center gap-0.5 cursor-pointer"
              >
                <CheckCircle2 className="h-3 w-3" /> Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {watchEmpId || 'AUTO'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingId(true)}
                className="text-[10px] font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                title="Edit auto-generated employee ID"
              >
                <Edit3 className="h-3 w-3" /> Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 4-Step Progress Stepper */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            const stepOrder: SectionId[] = ['A', 'B', 'C', 'D'];
            const isPassed = stepOrder.indexOf(activeSection) > stepOrder.indexOf(sec.id);

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  // Only allow jumping directly to earlier steps or current step; forward navigation requires Next validation
                  if (stepOrder.indexOf(sec.id) <= stepOrder.indexOf(activeSection)) {
                    setActiveSection(sec.id);
                  }
                }}
                className={`flex items-center gap-2 p-2 rounded-lg text-left transition border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70 cursor-pointer'
                    : 'bg-slate-50 text-slate-500 border-slate-200 opacity-80 cursor-not-allowed'
                }`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                  isActive
                    ? 'bg-white text-blue-700'
                    : isPassed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {isPassed ? <CheckCircle2 className="h-4 w-4" /> : sec.step}
                </div>
                <div className="min-w-0">
                  <div className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    Step {sec.step}
                  </div>
                  <div className="text-xs font-bold truncate">
                    {sec.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Master Data Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ========================================================================= */}
        {/* SECTION A — PERSONAL INFORMATION                                          */}
        {/* ========================================================================= */}
        {activeSection === 'A' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                SECTION A — PERSONAL INFORMATION
              </h2>
              <p className="text-xs text-slate-500">Legal candidate particulars, demographics, and contact coordinates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  {...register('full_name', {
                    required: 'Full Legal Name is required',
                    validate: (v) => !!v?.trim() || 'Full Legal Name cannot be empty or whitespace',
                  })}
                  placeholder="e.g. Full Legal Name"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.full_name ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.full_name && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Gender *</label>
                <select
                  {...register('gender', {
                    required: 'Gender is required',
                    validate: (v) => !!v?.trim() || 'Please select a valid gender',
                  })}
                  className={`w-full p-2.5 border rounded-lg outline-none bg-white font-medium ${
                    errors.gender ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                {errors.gender && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.gender.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Father&apos;s Name</label>
                <input
                  type="text"
                  {...register('father_name')}
                  placeholder="Father's legal name"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mother&apos;s Name</label>
                <input
                  type="text"
                  {...register('mother_name')}
                  placeholder="Mother's legal name"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  {...register('date_of_birth')}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Corporate Email *</label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Corporate Email is required',
                    validate: (v) => !!v?.trim() || 'Corporate Email cannot be empty or whitespace',
                  })}
                  placeholder="employee@varsaka.com"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.email ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.email && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Personal Email</label>
                <input
                  type="email"
                  {...register('personal_email')}
                  placeholder="personal@gmail.com"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Primary Contact Number *</label>
                <input
                  type="text"
                  {...register('phone', {
                    required: 'Primary Contact Number is required',
                    validate: (v) => {
                      const trimmed = v?.trim() || '';
                      if (!trimmed || trimmed === '+91') return 'Primary Contact Number cannot be empty';
                      return true;
                    },
                  })}
                  placeholder="+91 9876543210"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.phone ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.phone && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Alternate Contact Number</label>
                <input
                  type="text"
                  {...register('alternate_phone')}
                  placeholder="Emergency or alternate number"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">Permanent Address *</label>
                <textarea
                  rows={2}
                  {...register('address', {
                    required: 'Permanent Address is required',
                    validate: (v) => !!v?.trim() || 'Permanent Address cannot be empty or whitespace',
                  })}
                  placeholder="Full permanent residential address"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 resize-none ${
                    errors.address ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.address && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.address.message}</p>
                )}
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">Current Residential Address</label>
                <textarea
                  rows={2}
                  {...register('current_address')}
                  placeholder="Current correspondence address (if different from permanent)"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">City *</label>
                <input
                  type="text"
                  {...register('city', {
                    required: 'City is required',
                    validate: (v) => !!v?.trim() || 'City cannot be empty or whitespace',
                  })}
                  placeholder="e.g. Hyderabad"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.city ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.city && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.city.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">State *</label>
                <input
                  type="text"
                  {...register('state', {
                    required: 'State is required',
                    validate: (v) => !!v?.trim() || 'State cannot be empty or whitespace',
                  })}
                  placeholder="e.g. Telangana"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.state ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.state && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.state.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PIN Code *</label>
                <input
                  type="text"
                  {...register('pin_code', {
                    required: 'PIN Code is required',
                    validate: (v) => {
                      const trimmed = v?.trim() || '';
                      if (!trimmed) return 'PIN Code cannot be empty or whitespace';
                      if (!/^[1-9][0-9]{5}$/.test(trimmed)) {
                        return 'Enter a valid 6-digit Indian PIN Code (e.g. 500081)';
                      }
                      return true;
                    },
                  })}
                  placeholder="e.g. 500081"
                  maxLength={6}
                  className={`w-full p-2.5 border rounded-lg outline-none font-mono focus:ring-2 focus:ring-blue-600 ${
                    errors.pin_code ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.pin_code && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.pin_code.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION B — IDENTITY / STATUTORY INFORMATION                              */}
        {/* ========================================================================= */}
        {activeSection === 'B' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  SECTION B — IDENTITY / STATUTORY INFORMATION
                </h2>
                <p className="text-xs text-slate-500">Government statutory identifiers (shielded server-side with RBAC)</p>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                Restricted / Confidential
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">PAN (Permanent Account Number)</label>
                <input
                  type="text"
                  {...register('pan_number')}
                  placeholder="ABCDE1234F"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Aadhaar / National Identity Ref</label>
                <input
                  type="text"
                  {...register('aadhaar_number')}
                  placeholder="12-digit Aadhaar number"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Passport Number (if applicable)</label>
                <input
                  type="text"
                  {...register('passport_number')}
                  placeholder="Passport number"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">UAN (Universal Account Number)</label>
                <input
                  type="text"
                  {...register('uan')}
                  placeholder="12-digit UAN"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PF Number</label>
                <input
                  type="text"
                  {...register('pf_number')}
                  placeholder="Provident Fund reference"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ESIC Number</label>
                <input
                  type="text"
                  {...register('esic_number')}
                  placeholder="ESIC reference"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION C — EMPLOYMENT INFORMATION                                        */}
        {/* ========================================================================= */}
        {activeSection === 'C' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-purple-600" />
                SECTION C — EMPLOYMENT INFORMATION
              </h2>
              <p className="text-xs text-slate-500">Corporate hierarchy, placement terms, probation, and status lifecycle</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Joining *</label>
                <input
                  type="date"
                  {...register('joining_date', { required: 'Joining date is required' })}
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.joining_date ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.joining_date && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.joining_date.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department *</label>
                <select
                  {...register('department_id', { required: 'Department is required' })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="dept-eng">Engineering &amp; Technology</option>
                  <option value="dept-product">Product &amp; Design</option>
                  <option value="dept-hr">Human Resources</option>
                  <option value="dept-fin-ops">Finance &amp; Operations</option>
                  <option value="other">Other (Custom Department)</option>
                </select>
              </div>

              {watchDepartmentId === 'other' && (
                <div>
                  <label className="font-semibold text-blue-700 block mb-1">Custom Department Name *</label>
                  <input
                    type="text"
                    {...register('custom_department', { required: 'Custom Department Name is required' })}
                    placeholder="Enter department name"
                    className="w-full p-2.5 border border-blue-400 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                  />
                  {errors.custom_department && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.custom_department.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation / Role Title *</label>
                <input
                  type="text"
                  {...register('designation', {
                    required: 'Designation is required',
                    validate: (v) => !!v?.trim() || 'Designation cannot be empty',
                  })}
                  placeholder="e.g. Senior Backend Engineer"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.designation ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.designation && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.designation.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employment Type *</label>
                <select
                  {...register('employment_type')}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="FULL_TIME">Full-Time Regular</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="CONTRACT">Contractual / Consulting</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location *</label>
                <input
                  type="text"
                  {...register('work_location', {
                    required: 'Work Location is required',
                    validate: (v) => !!v?.trim() || 'Work Location cannot be empty',
                  })}
                  placeholder="e.g. Hyderabad, India"
                  className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                    errors.work_location ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                  }`}
                />
                {errors.work_location && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.work_location.message}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reporting Manager</label>
                <input
                  type="text"
                  {...register('reporting_manager')}
                  placeholder="Supervisor / Director name"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Probation Period</label>
                <input
                  type="text"
                  {...register('probation_period')}
                  placeholder="e.g. 6 months"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confirmation Date</label>
                <input
                  type="date"
                  {...register('confirmation_date')}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notice Period</label>
                <input
                  type="text"
                  {...register('notice_period')}
                  placeholder="e.g. 60 days"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employment Status *</label>
                <select
                  {...register('status')}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INTERN">INTERN</option>
                  <option value="ON_NOTICE">ON NOTICE</option>
                  <option value="SEPARATED">SEPARATED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION D — BANK & PAYROLL INFORMATION (CONFIDENTIAL)                     */}
        {/* ========================================================================= */}
        {activeSection === 'D' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  SECTION D — BANK &amp; PAYROLL INFORMATION
                </h2>
                <p className="text-xs text-slate-500">Confidential salary computation feeding payslips and offer letters</p>
              </div>
              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase">
                Confidential Compensation
              </span>
            </div>

            {/* Bank Particulars — MANDATORY FIELDS */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
                Bank Coordinates <span className="text-red-500">*</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    {...register('bank_name', {
                      required: 'Bank Name is required',
                      validate: (v) => !!v?.trim() || 'Bank Name cannot be empty or whitespace',
                    })}
                    placeholder="e.g. HDFC Bank"
                    className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                      errors.bank_name ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                    }`}
                  />
                  {errors.bank_name && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.bank_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    {...register('bank_account_holder_name', {
                      required: 'Account Holder Name is required',
                      validate: (v) => !!v?.trim() || 'Account Holder Name cannot be empty or whitespace',
                    })}
                    placeholder="Full name on bank account"
                    className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 ${
                      errors.bank_account_holder_name ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                    }`}
                  />
                  {errors.bank_account_holder_name && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.bank_account_holder_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Account Number *</label>
                  <input
                    type="text"
                    {...register('bank_account_number', {
                      required: 'Bank Account Number is required',
                      validate: (v) => {
                        const trimmed = v?.trim() || '';
                        if (!trimmed) return 'Bank Account Number cannot be empty or whitespace';
                        if (!/^[0-9]{9,18}$/.test(trimmed)) {
                          return 'Enter a valid bank account number (9 to 18 digits)';
                        }
                        return true;
                      },
                    })}
                    placeholder="e.g. 50100123456789"
                    className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono ${
                      errors.bank_account_number ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                    }`}
                  />
                  {errors.bank_account_number && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.bank_account_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    {...register('bank_ifsc', {
                      required: 'IFSC Code is required',
                      validate: (v) => {
                        const trimmed = v?.trim().toUpperCase() || '';
                        if (!trimmed) return 'IFSC Code cannot be empty or whitespace';
                        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(trimmed)) {
                          return 'Enter a valid 11-character Indian IFSC (e.g. HDFC0001234)';
                        }
                        return true;
                      },
                    })}
                    placeholder="e.g. HDFC0001234"
                    maxLength={11}
                    className={`w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono uppercase ${
                      errors.bank_ifsc ? 'border-red-400 bg-red-50/20' : 'border-slate-300'
                    }`}
                  />
                  {errors.bank_ifsc && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{errors.bank_ifsc.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Compensation & Structure */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Salary Structure &amp; Breakdown</h3>
                
                {/* Actions: Auto-Calculate Breakdown + Live Calculate In-Hand */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRecalculateSalary}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Calculate standard breakdown based on Annual CTC"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Auto-Calculate Breakdown
                  </button>

                  <button
                    type="button"
                    onClick={handleCalculateInHand}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Calculate Net In-Hand from current values displayed in deduction fields"
                  >
                    <Calculator className="h-3.5 w-3.5 text-blue-600" />
                    Calculate In-Hand
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Annual CTC (INR) *</label>
                  <input
                    type="number"
                    {...register('annual_ctc', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(annualCtc)} / year</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Monthly Gross (INR)</label>
                  <input
                    type="number"
                    {...register('monthly_gross', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(watch('monthly_gross') || 0)} / month</span>
                </div>

                <div>
                  <label className="font-semibold text-emerald-800 block mb-1 flex items-center justify-between">
                    <span>Monthly Net In-Hand (INR)</span>
                    <span className="text-[10px] text-emerald-600 font-normal">Live</span>
                  </label>
                  <input
                    type="number"
                    {...register('net_salary', { valueAsNumber: true })}
                    className="w-full p-2 border border-emerald-300 rounded-lg font-mono font-bold text-emerald-700 bg-emerald-50/50"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="font-bold text-emerald-700">{formatCurrency(watch('net_salary') || 0)} take-home</span>
                    <span className="text-slate-500 italic">Calculated from current earnings and deductions</span>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Earnings */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span>Earnings (Monthly)</span>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Credit</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Basic Salary</span>
                      <input type="number" {...register('basic', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">HRA</span>
                      <input type="number" {...register('hra', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Special Allowance</span>
                      <input type="number" {...register('special_allowance', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Conveyance</span>
                      <input type="number" {...register('conveyance', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono" />
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] text-slate-500 block">Other Allowances</span>
                      <input type="number" {...register('other_allowances', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono" />
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="font-bold text-slate-800 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span>Deductions (Monthly)</span>
                    <span className="text-[10px] text-red-600 font-bold uppercase">Debit</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Employee PF</span>
                      <input type="number" {...register('employee_pf', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Employer PF</span>
                      <input type="number" {...register('employer_pf', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Professional Tax (PT)</span>
                      <input type="number" {...register('professional_tax', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">TDS</span>
                      <input type="number" {...register('tds', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">ESIC</span>
                      <input type="number" {...register('esic', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Other Deductions</span>
                      <input type="number" {...register('other_deductions', { valueAsNumber: true })} className="w-full p-1.5 border border-slate-200 rounded font-mono text-red-700" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Wizard Navigation Action Bar */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Step <strong>{activeSection === 'A' ? 1 : activeSection === 'B' ? 2 : activeSection === 'C' ? 3 : 4}</strong> of 4</span>
            <span className="text-slate-300">|</span>
            <span>Target Employee ID: <strong className="font-mono text-blue-800">{watchEmpId}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            {activeSection === 'A' ? (
              <Link
                href="/employees"
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleBack(activeSection as 'B' | 'C' | 'D')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {activeSection !== 'D' ? (
              <button
                type="button"
                onClick={() => handleNext(activeSection as 'A' | 'B' | 'C')}
                className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-2 select-none ${
                  submitting
                    ? 'bg-emerald-500 cursor-not-allowed opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 cursor-pointer'
                }`}
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" variant="white" label="Creating Master Record..." />
                    <span>Creating Master Record...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Complete Onboarding &amp; Save</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </form>
    </div>
  );
}
