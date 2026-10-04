'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { OfferLetterData } from '@/types/document';
import { Employee } from '@/types/database';
import { calculateCompensation, calculateNetInHand } from '@/lib/compensation';
import { formatCurrency, numberToWordsINR } from '@/lib/utils';
import { OfferLetterTemplate } from '@/components/documents/OfferLetterTemplate';
import {
  FileText,
  Eye,
  CheckCircle2,
  Sparkles,
  User,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Edit3,
  RotateCcw,
  Check,
  Lock,
  Type,
} from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/Loading';

export default function GenerateOfferLetterPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [salarySourceStatus, setSalarySourceStatus] = useState<'IDLE' | 'LOADING' | 'LOADED' | 'NOT_FOUND'>('IDLE');
  const [salaryMeta, setSalaryMeta] = useState<{ effectiveDate?: string; annualCtc?: number } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const { register, handleSubmit, watch, setValue, getValues } = useForm<OfferLetterData>({
    defaultValues: {
      offerType: 'direct-fulltime',
      offerDate: new Date().toISOString().split('T')[0],
      candidateName: '',
      candidateAddress: '',
      designation: '',
      department: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employeeCode: '',
      annualCtc: 0,
      annualCtcWords: '',
      
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
      previousCtc: 0,
      revisedCtc: 0,
      revisionEffectiveDate: new Date().toISOString().split('T')[0],

      // Monthly components initialized cleanly
      basic: 0,
      hra: 0,
      communicationAllowance: 0,
      travelAllowance: 0,
      foodAllowance: 0,
      otherAllowances: 0,
      monthlyGrossSalary: 0,
      employeePf: 0,
      employerPf: 0,
      professionalTax: 0,
      gratuity: 0,
      tds: 0,
      monthlyNetSalary: 0,
      yearlyVariable: 0,

      // Net In-Hand controlled override snapshot fields
      calculatedNetInHand: 0,
      finalNetInHand: 0,
      netInHandMode: 'AUTO',
      overrideReason: '',

      // Controlled font selection (Old Standard TT as default old-style serif)
      fontFamily: 'old-style',
    }
  });

  const formValues = watch();

  // Load current user and active branding settings on mount
  useEffect(() => {
    async function initPage() {
      try {
        // Fetch current user
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const u = await userRes.json();
          setCurrentUser(u);
        }

        // Fetch active corporate branding & signatory
        const brandRes = await fetch('/api/settings/branding');
        if (brandRes.ok) {
          const brandData = await brandRes.json();
          if (brandData?.signatory?.is_active) {
            setValue('signatory', {
              name: brandData.signatory.name,
              title: brandData.signatory.title,
              department: brandData.signatory.department,
              company: brandData.signatory.company,
              signature_url: brandData.signatory.signature_url,
              version: brandData.signatory.version,
            });
          }
          if (brandData?.stamp?.is_active) {
            setValue('stamp', {
              stamp_url: brandData.stamp.stamp_url,
              version: brandData.stamp.version,
            });
          }
        }

        // Fetch employee directory
        const empRes = await fetch('/api/employees?activeOnly=true');
        if (empRes.ok) {
          const list: Employee[] = await empRes.json();
          const activeList = list.filter(
            (e) => e.status !== 'INACTIVE' && e.status !== 'SEPARATED' && (e as any).deletion_status !== 'DELETED'
          );
          setEmployees(activeList);
        }
      } catch (e) {
        console.error('Failed to initialize offer generator:', e);
      }
    }
    initPage();
  }, [setValue]);

  // Shared function to recompute net in hand from current form state
  const recomputeNetFromComponents = useCallback((modeOverride?: 'AUTO' | 'MANUAL') => {
    const vals = getValues();
    const gross = (vals.basic || 0) +
      (vals.hra || 0) +
      (vals.communicationAllowance || 0) +
      (vals.travelAllowance || 0) +
      (vals.foodAllowance || 0) +
      (vals.otherAllowances || 0);

    const calcResult = calculateNetInHand({
      monthlyGross: gross,
      employeePf: vals.employeePf || 0,
      employerPf: vals.employerPf || 0,
      professionalTax: vals.professionalTax || 0,
      gratuity: vals.gratuity || 0,
      tds: vals.tds || 0,
    });

    setValue('monthlyGrossSalary', gross);
    setValue('calculatedNetInHand', calcResult.netSalary);

    const activeMode = modeOverride || vals.netInHandMode || 'AUTO';
    if (activeMode === 'AUTO') {
      setValue('finalNetInHand', calcResult.netSalary);
      setValue('monthlyNetSalary', calcResult.netSalary);
    }
  }, [getValues, setValue]);

  // Load employee compensation dynamically when employee or effective date changes
  const loadEmployeeCompensation = useCallback(async (empId: string, effectiveDate?: string) => {
    if (!empId) {
      setSalarySourceStatus('IDLE');
      setSalaryMeta(null);
      return;
    }

    setSalarySourceStatus('LOADING');
    try {
      const url = effectiveDate
        ? `/api/salary/${empId}?effectiveDate=${encodeURIComponent(effectiveDate)}`
        : `/api/salary/${empId}`;
      const res = await fetch(url);

      if (res.ok) {
        const sal = await res.json();
        if (sal && sal.annual_ctc !== undefined && sal.annual_ctc !== null) {
          setSalarySourceStatus('LOADED');
          setSalaryMeta({
            effectiveDate: sal.effective_date,
            annualCtc: sal.annual_ctc,
          });

          // Safe numeric extractor distinguishing legitimate stored 0 from undefined / null / empty
          const extractNumeric = (keys: string[], defaultFallback: number = 0): number => {
            for (const key of keys) {
              if (sal[key] !== undefined && sal[key] !== null && sal[key] !== '') {
                const parsed = Number(sal[key]);
                if (!isNaN(parsed)) return parsed;
              }
            }
            return defaultFallback;
          };

          // Populate authoritative persisted compensation components
          const annualCtc = extractNumeric(['annual_ctc', 'annualCtc'], 0);
          const variablePay = extractNumeric(['variable_pay', 'variablePay', 'yearly_variable_pay', 'yearly_variable', 'yearlyVariable'], 0);
          const basic = extractNumeric(['basic', 'basic_pay', 'basicPay'], 0);
          const hra = extractNumeric(['hra'], 0);
          const comm = extractNumeric(['communication_allowance', 'internet_allowance', 'communicationAllowance', 'internetAllowance'], 0);
          const travel = extractNumeric(['travel_allowance', 'travelAllowance'], 0);
          const food = extractNumeric(['food_allowance', 'foodAllowance'], 0);
          const other = extractNumeric(['other_allowances', 'other_allowance', 'otherAllowances', 'otherAllowance'], 0);

          const empPf = extractNumeric(['employee_pf', 'employee_pf_contribution', 'employeePf', 'emp_pf', 'pf_employee'], 0);
          const emplyrPf = extractNumeric(['employer_pf', 'employer_pf_contribution', 'employerPf', 'emplyr_pf', 'pf_employer'], 0);
          const pt = extractNumeric(['professional_tax', 'prof_tax', 'professionalTax', 'pt'], 0);
          const grat = extractNumeric(['gratuity'], 0);
          const tds = extractNumeric(['tds', 'tds_other_deductions', 'other_deductions', 'otherDeductions'], 0);

          const monthlyGross = extractNumeric(
            ['monthly_gross', 'monthlyGross', 'monthly_gross_salary', 'monthlyGrossSalary'],
            basic + hra + comm + travel + food + other
          );

          setValue('annualCtc', annualCtc);
          setValue('yearlyVariable', variablePay);
          setValue('basic', basic);
          setValue('hra', hra);
          setValue('communicationAllowance', comm);
          setValue('travelAllowance', travel);
          setValue('foodAllowance', food);
          setValue('otherAllowances', other);
          setValue('monthlyGrossSalary', monthlyGross);
          setValue('employeePf', empPf);
          setValue('employerPf', emplyrPf);
          setValue('professionalTax', pt);
          setValue('gratuity', grat);
          setValue('tds', tds);
          setValue('annualCtcWords', annualCtc > 0 ? `${numberToWordsINR(annualCtc)} Rupees Only` : '');

          // Check if there is an authoritative saved net salary directly from master compensation
          const persistedNet = extractNumeric(
            ['net_salary', 'netSalary', 'monthly_net_salary', 'monthlyNetSalary', 'finalNetInHand', 'in_hand_salary'],
            -1
          );

          let finalNet = persistedNet;
          if (finalNet < 0) {
            const calcResult = calculateNetInHand({
              monthlyGross,
              employeePf: empPf,
              employerPf: emplyrPf,
              professionalTax: pt,
              gratuity: grat,
              tds,
            });
            finalNet = calcResult.netSalary;
          }

          setValue('calculatedNetInHand', finalNet);
          setValue('finalNetInHand', finalNet);
          setValue('monthlyNetSalary', finalNet);
          setValue('netInHandMode', 'AUTO');
          setValue('overrideReason', '');
          return;
        }
      }

      // No salary record found
      setSalarySourceStatus('NOT_FOUND');
      setSalaryMeta(null);
      // Reset values to clean 0 state without destroying candidate identity
      setValue('annualCtc', 0);
      setValue('yearlyVariable', 0);
      setValue('basic', 0);
      setValue('hra', 0);
      setValue('communicationAllowance', 0);
      setValue('travelAllowance', 0);
      setValue('foodAllowance', 0);
      setValue('otherAllowances', 0);
      setValue('monthlyGrossSalary', 0);
      setValue('employeePf', 0);
      setValue('employerPf', 0);
      setValue('professionalTax', 0);
      setValue('gratuity', 0);
      setValue('tds', 0);
      setValue('monthlyNetSalary', 0);
      setValue('calculatedNetInHand', 0);
      setValue('finalNetInHand', 0);
      setValue('netInHandMode', 'AUTO');
      setValue('overrideReason', '');
      setValue('annualCtcWords', '');
    } catch (e) {
      console.error('Failed to load employee compensation:', e);
      setSalarySourceStatus('NOT_FOUND');
      setSalaryMeta(null);
    }
  }, [setValue]);

  // Handle employee dropdown change
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    setError(null);

    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const actualDept = emp.department_name || emp.department || emp.custom_department || '';
      setValue('candidateName', emp.full_name);
      setValue('candidateAddress', emp.permanent_address || emp.address || '');
      setValue('designation', emp.designation || '');
      setValue('department', actualDept);
      setValue('employeeCode', emp.employee_id || '');
      if (emp.joining_date) {
        setValue('joiningDate', emp.joining_date);
      }

      // Load active compensation record effective for the current offer date
      const effectiveDate = formValues.offerDate || new Date().toISOString().split('T')[0];
      loadEmployeeCompensation(emp.id, effectiveDate);
    } else {
      // Clear selection
      setValue('candidateName', '');
      setValue('candidateAddress', '');
      setValue('designation', '');
      setValue('department', '');
      setValue('employeeCode', '');
      setSalarySourceStatus('IDLE');
      setSalaryMeta(null);
    }
  };

  // Re-fetch compensation when Offer Date or Revision Effective Date changes
  const handleEffectiveDateChange = (newDate: string) => {
    setValue('offerDate', newDate);
    if (selectedEmpId) {
      loadEmployeeCompensation(selectedEmpId, newDate);
    }
  };

  // Auto-calculate full breakdown from Annual CTC & Variable Pay
  const handleAutoCalculateFromCtc = () => {
    const annualCtc = Number(formValues.annualCtc) || 0;
    const variablePay = Number(formValues.yearlyVariable) || 0;
    if (annualCtc <= 0) {
      setError('Please specify a valid Annual CTC greater than 0 before calculating.');
      return;
    }
    setError(null);

    const b = calculateCompensation(annualCtc, variablePay);
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
    setValue('calculatedNetInHand', b.netSalary);
    setValue('finalNetInHand', b.netSalary);
    setValue('monthlyNetSalary', b.netSalary);
    setValue('netInHandMode', 'AUTO');
    setValue('overrideReason', '');
    setValue('annualCtcWords', b.annualCtcWords);
  };

  // Controlled Net In-Hand Override toggles
  const handleEnableOverride = () => {
    setValue('netInHandMode', 'MANUAL');
  };

  const handleRevertToAuto = () => {
    setValue('netInHandMode', 'AUTO');
    setValue('overrideReason', '');
    recomputeNetFromComponents('AUTO');
  };

  const handleManualNetChange = (val: number) => {
    setValue('finalNetInHand', val);
    setValue('monthlyNetSalary', val);
  };

  // Form submission
  const onSubmit = async (data: OfferLetterData) => {
    setGenerating(true);
    setError(null);

    try {
      if (!data.candidateName?.trim()) {
        throw new Error('Please select or specify a candidate name.');
      }
      if (!data.annualCtc || data.annualCtc <= 0) {
        throw new Error('Annual CTC must be greater than 0.');
      }

      // Mandatory safety check for manual override
      if (data.netInHandMode === 'MANUAL') {
        if (!data.overrideReason?.trim()) {
          throw new Error('A justification reason is required when manually overriding the Net In-Hand salary.');
        }
      }

      let empId = selectedEmpId;
      if (!empId) {
        const matched = employees.find((e) => e.employee_id === data.employeeCode);
        empId = matched ? matched.id : (employees[0]?.id || 'emp-placeholder');
      }

      const docTitle = data.isSalaryRevision
        ? `Compensation Revision Offer Letter - ${data.candidateName}`
        : `Full-Time Offer Letter - ${data.candidateName}`;

      // Package full immutable snapshot
      const snapshot: OfferLetterData = {
        ...data,
        calculatedNetInHand: data.calculatedNetInHand || data.monthlyNetSalary,
        finalNetInHand: data.netInHandMode === 'MANUAL' ? data.finalNetInHand : (data.calculatedNetInHand || data.monthlyNetSalary),
        netInHandMode: data.netInHandMode || 'AUTO',
        overrideReason: data.netInHandMode === 'MANUAL' ? data.overrideReason : undefined,
        overriddenBy: data.netInHandMode === 'MANUAL' ? (currentUser?.email || 'Authorized HR User') : undefined,
        overriddenAt: data.netInHandMode === 'MANUAL' ? new Date().toISOString() : undefined,
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: 'OFFER_LETTER',
          employee_id: empId,
          title: docTitle,
          data_snapshot: snapshot,
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

  const isManualMode = formValues.netInHandMode === 'MANUAL';

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
          
          {/* Employee Selection Quick-Fill & Source-of-Truth Sync */}
          <div className="bg-white border border-blue-200 p-4 rounded-xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-blue-600" />
                  Select Employee / Candidate (Source of Truth)
                </span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Dynamically pulls profile credentials and the active compensation structure effective for the offer date.
                </p>
              </div>
              <select
                value={selectedEmpId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="px-3 py-2 border border-blue-300 rounded-lg bg-blue-50/50 text-blue-950 font-medium outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">-- Choose from Employee Directory --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id}) — {emp.designation}
                  </option>
                ))}
              </select>
            </div>

            {/* Compensation Source Status Banner */}
            {salarySourceStatus === 'LOADED' && salaryMeta && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Active Compensation Record Loaded:</strong> Effective Date: <strong>{salaryMeta.effectiveDate}</strong> (Annual CTC: {formatCurrency(salaryMeta.annualCtc || 0)})
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                  Source of Truth ✓
                </span>
              </div>
            )}

            {salarySourceStatus === 'NOT_FOUND' && selectedEmpId && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    No master compensation record found for this employee on this effective date. Enter salary components below or auto-calculate from CTC.
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  No Saved Record
                </span>
              </div>
            )}

            {salarySourceStatus === 'LOADING' && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                <span>Loading active compensation record for selected effective date...</span>
              </div>
            )}
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
                    placeholder="e.g. VL 1001"
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Offer Issue Date</label>
                  <input
                    type="date"
                    value={formValues.offerDate}
                    onChange={(e) => handleEffectiveDateChange(e.target.value)}
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

              {/* Controlled Document Typography Selection (Bug 5) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Type className="h-4 w-4 text-blue-600" />
                  Offer Letter Typography Style
                </label>
                <p className="text-[11px] text-slate-500">
                  Select the approved typographic style for the document body and contract clauses.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setValue('fontFamily', 'old-style')}
                    className={`p-2 rounded border text-left transition ${
                      formValues.fontFamily === 'old-style'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-serif">Old-Style Serif</div>
                    <div className="text-[10px] text-slate-500 font-normal">Old Standard TT</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('fontFamily', 'typewriter')}
                    className={`p-2 rounded border text-left transition ${
                      formValues.fontFamily === 'typewriter'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-mono">Typewriter Serif</div>
                    <div className="text-[10px] text-slate-500 font-normal">Courier Prime</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue('fontFamily', 'default')}
                    className={`p-2 rounded border text-left transition ${
                      formValues.fontFamily === 'default'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-sans">Default Modern</div>
                    <div className="text-[10px] text-slate-500 font-normal">Inter Sans</div>
                  </button>
                </div>
              </div>

              {/* Salary Hike / Revision Toggle */}
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
                        onChange={(e) => {
                          setValue('revisionEffectiveDate', e.target.value);
                          if (selectedEmpId) {
                            loadEmployeeCompensation(selectedEmpId, e.target.value);
                          }
                        }}
                        className="w-full p-1.5 border border-amber-300 rounded bg-white text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-amber-800 col-span-2">
                      Generates a separate, immutable revision document. The original employment contract remains permanent and unaffected.
                    </p>
                  </div>
                )}
              </div>

              {/* Employment Bond Decision */}
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

              {/* Controlled Custom Authorized Clause */}
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="font-bold text-slate-900">Annexure 1A: Compensation Structure</h2>
                  <span className="text-[11px] text-slate-500">
                    {salarySourceStatus === 'LOADED' ? 'Loaded from employee record' : 'Draft compensation structure'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoCalculateFromCtc}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-bold bg-blue-50 px-2.5 py-1 rounded border border-blue-200 transition shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  Auto-Calculate from CTC
                </button>
              </div>

              {/* Annual CTC & Variable */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Annual CTC (₹) *</label>
                  <input
                    type="number"
                    {...register('annualCtc', { valueAsNumber: true })}
                    onChange={(e) => {
                      setValue('annualCtc', Number(e.target.value) || 0);
                      const val = Number(e.target.value) || 0;
                      setValue('annualCtcWords', val > 0 ? `${numberToWordsINR(val)} Rupees Only` : '');
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono font-bold text-slate-900 text-sm"
                  />
                  {formValues.annualCtcWords && (
                    <div className="text-[10px] text-slate-500 italic mt-0.5">{formValues.annualCtcWords}</div>
                  )}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Yearly Variable Pay (₹)</label>
                  <input
                    type="number"
                    {...register('yearlyVariable', { valueAsNumber: true })}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Monthly Earnings Components</span>
                  <span className="text-slate-500 font-normal text-[11px]">
                    Gross: <strong>{formatCurrency(formValues.monthlyGrossSalary || 0)}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="text-slate-500 block">Basic Pay (₹):</label>
                    <input
                      type="number"
                      {...register('basic', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('basic', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">HRA (₹):</label>
                    <input
                      type="number"
                      {...register('hra', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('hra', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Internet / Comm (₹):</label>
                    <input
                      type="number"
                      {...register('communicationAllowance', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('communicationAllowance', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Travel Allowance (₹):</label>
                    <input
                      type="number"
                      {...register('travelAllowance', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('travelAllowance', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Food Allowance (₹):</label>
                    <input
                      type="number"
                      {...register('foodAllowance', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('foodAllowance', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block">Other Allowance (₹):</label>
                    <input
                      type="number"
                      {...register('otherAllowances', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('otherAllowances', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700 block">Monthly Statutory & Other Deductions</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-red-50/50 p-3 rounded-lg border border-red-200">
                  <div>
                    <label className="text-red-700 block">Employee PF (₹):</label>
                    <input
                      type="number"
                      {...register('employeePf', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('employeePf', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-red-200 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-red-700 block">Employer PF (₹):</label>
                    <input
                      type="number"
                      {...register('employerPf', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('employerPf', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-red-200 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-red-700 block">Prof. Tax (PT) (₹):</label>
                    <input
                      type="number"
                      {...register('professionalTax', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('professionalTax', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-red-200 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-red-700 block">Gratuity (₹):</label>
                    <input
                      type="number"
                      {...register('gratuity', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('gratuity', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-red-200 rounded bg-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-red-700 block">TDS / Other Deductions (₹):</label>
                    <input
                      type="number"
                      {...register('tds', { valueAsNumber: true })}
                      onChange={(e) => {
                        setValue('tds', Number(e.target.value) || 0);
                        recomputeNetFromComponents();
                      }}
                      className="w-full p-1 border border-red-200 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Net In-Hand Calculation & Controlled Override Box (Requirements C, D, E) */}
              <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-950 text-xs">Monthly Net In-Hand</span>
                    {!isManualMode ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="h-3 w-3" />
                        Auto Calculated ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                        <AlertTriangle className="h-3 w-3 text-amber-700" />
                        Manual Override
                      </span>
                    )}
                  </div>

                  {!isManualMode ? (
                    <button
                      type="button"
                      onClick={handleEnableOverride}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-white px-2 py-1 rounded border border-blue-200 hover:border-blue-400 shadow-2xs transition"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit / Override
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRevertToAuto}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white px-2 py-1 rounded border border-slate-300 hover:border-slate-400 shadow-2xs transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Revert to Auto
                    </button>
                  )}
                </div>

                {!isManualMode ? (
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <div className="font-mono font-black text-emerald-950 text-xl tracking-tight">
                        {formatCurrency(formValues.finalNetInHand || formValues.calculatedNetInHand || formValues.monthlyNetSalary || 0)}
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        Formula: Monthly Gross ({formatCurrency(formValues.monthlyGrossSalary || 0)}) − Total Deductions
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500 block text-[10px]">Monthly Gross:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(formValues.monthlyGrossSalary || 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-1 border-t border-amber-200/80">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Calculated value:</span>
                        <div className="font-mono font-bold text-slate-700 text-sm bg-slate-100 p-2 rounded border border-slate-200">
                          {formatCurrency(formValues.calculatedNetInHand || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-900 font-bold block mb-0.5">Manual override (₹) *</span>
                        <input
                          type="number"
                          value={formValues.finalNetInHand || 0}
                          onChange={(e) => handleManualNetChange(Number(e.target.value) || 0)}
                          className="w-full p-2 border-2 border-amber-400 rounded bg-white font-mono font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-amber-950 block mb-1">
                        Reason for override * <span className="text-amber-700 font-normal">(Required for document snapshot audit)</span>
                      </label>
                      <input
                        {...register('overrideReason')}
                        placeholder="e.g. Special relocation compensation adjustment or custom statutory tax bracket"
                        className="w-full p-2 border border-amber-300 rounded-lg bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="p-2 bg-amber-100/60 rounded border border-amber-200 text-[10px] text-amber-900 flex items-start gap-1.5">
                      <Lock className="h-3 w-3 shrink-0 mt-0.5 text-amber-700" />
                      <span>
                        <strong>Safety Guarantee:</strong> Changing Net In-Hand applies ONLY to this Offer Letter draft snapshot. The employee's master salary/payroll record will NOT be modified.
                      </span>
                    </div>
                  </div>
                )}
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
              aria-busy={generating}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50 select-none cursor-pointer"
            >
              {generating ? (
                <>
                  <LoadingSpinner size="sm" variant="white" label="Generating Offer Letter..." />
                  <span>Generating Offer Letter...</span>
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
