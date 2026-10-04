'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Employee, EmployeeSalary } from '@/types/database';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  User,
  ShieldCheck,
  Briefcase,
  Banknote,
  FolderOpen,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calculator
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';
import { calculateCompensation, calculateNetInHand } from '@/lib/compensation';
import { PageLoader, LoadingSpinner } from '@/components/ui/Loading';

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  // Employee ID confirmation modal state
  const [originalEmpId, setOriginalEmpId] = useState('');
  const [showIdConfirmModal, setShowIdConfirmModal] = useState(false);
  const [isEditingId, setIsEditingId] = useState(false);
  const [hasExistingSalary, setHasExistingSalary] = useState(false);

  const [formData, setFormData] = useState<Partial<Employee> & { salary?: Partial<EmployeeSalary> }>({
    employee_id: '',
    full_name: '',
    father_name: '',
    mother_name: '',
    date_of_birth: '',
    gender: 'Male',
    personal_email: '',
    email: '',
    phone: '',
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

    department_id: '',
    custom_department: '',
    designation: '',
    employment_type: 'FULL_TIME',
    work_location: '',
    reporting_manager: '',
    joining_date: '',
    probation_period: '',
    confirmation_date: '',
    notice_period: '',
    status: 'ACTIVE',
    date_of_separation: '',
    last_working_date: '',
    separation_reason: '',

    bank_name: '',
    bank_account_holder_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    salary_structure: 'Standard Annual CTC',

    salary: {
      annual_ctc: 0,
      variable_pay: 0,
      monthly_gross: 0,
      basic: 0,
      hra: 0,
      special_allowance: 0,
      conveyance: 0,
      other_allowances: 0,
      employee_pf: 0,
      employer_pf: 0,
      professional_tax: 0,
      gratuity: 0,
      tds: 0,
      esic: 0,
      other_deductions: 0,
      net_salary: 0,
      effective_date: '',
    },

    kyc_documents: {},
  });

  const STANDARD_DEPTS = ['dept-eng', 'dept-fin-ops', 'dept-hr', 'dept-product'];

  useEffect(() => {
    async function loadEmp() {
      try {
        const res = await fetch(`/api/employees/${id}`);
        if (res.ok) {
          const data: Employee = await res.json();
          setOriginalEmpId(data.employee_id);
          const isStandard = STANDARD_DEPTS.includes(data.department_id);

          let salaryData: any = null;
          try {
            const salRes = await fetch(`/api/salary/${id}`);
            if (salRes.ok) {
              salaryData = await salRes.json();
              setHasExistingSalary(true);
            } else {
              setHasExistingSalary(false);
            }
          } catch {
            setHasExistingSalary(false);
          }

          setFormData({
            employee_id: data.employee_id,
            full_name: data.full_name,
            father_name: data.father_name || '',
            mother_name: data.mother_name || '',
            date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
            gender: data.gender || 'Male',
            personal_email: data.personal_email || '',
            email: data.email,
            phone: data.phone,
            alternate_phone: data.alternate_phone || '',
            address: data.permanent_address || data.address || '',
            current_address: data.current_address || '',
            city: data.city || 'Hyderabad',
            state: data.state || 'Telangana',
            country: data.country || 'India',
            pin_code: data.pin_code || '',

            pan_number: data.pan_number || '',
            aadhaar_number: data.aadhaar_number || '',
            passport_number: data.passport_number || '',
            uan: data.uan || '',
            pf_number: data.pf_number || '',
            esic_number: data.esic_number || '',

            department_id: isStandard ? data.department_id : 'other',
            custom_department: isStandard ? '' : (data.department_name || ''),
            designation: data.designation,
            employment_type: data.employment_type || 'FULL_TIME',
            work_location: data.work_location,
            reporting_manager: data.reporting_manager || '',
            joining_date: data.joining_date ? data.joining_date.split('T')[0] : '',
            probation_period: data.probation_period || '',
            confirmation_date: data.confirmation_date ? data.confirmation_date.split('T')[0] : '',
            notice_period: data.notice_period || '',
            status: data.status,
            date_of_separation: data.date_of_separation ? data.date_of_separation.split('T')[0] : '',
            last_working_date: data.last_working_date ? data.last_working_date.split('T')[0] : '',
            separation_reason: data.separation_reason || '',

            bank_name: data.bank_name || '',
            bank_account_holder_name: data.bank_account_holder_name || '',
            bank_account_number: data.bank_account_number || '',
            bank_ifsc: data.bank_ifsc || '',
            salary_structure: data.salary_structure || 'Standard Annual CTC',

            salary: {
              annual_ctc: salaryData ? Number(salaryData.annual_ctc) || 0 : 0,
              variable_pay: salaryData ? Number(salaryData.variable_pay) || 0 : 0,
              monthly_gross: salaryData ? Number(salaryData.monthly_gross) || 0 : 0,
              basic: salaryData ? Number(salaryData.basic) || 0 : 0,
              hra: salaryData ? Number(salaryData.hra) || 0 : 0,
              special_allowance: salaryData ? Number(salaryData.special_allowance) || 0 : 0,
              conveyance: salaryData ? Number(salaryData.conveyance) || 0 : 0,
              other_allowances: salaryData ? Number(salaryData.other_allowances) || 0 : 0,
              employee_pf: salaryData ? Number(salaryData.employee_pf) || 0 : 0,
              employer_pf: salaryData ? Number(salaryData.employer_pf) || 0 : 0,
              professional_tax: salaryData ? Number(salaryData.professional_tax) || 0 : 0,
              gratuity: salaryData ? Number(salaryData.gratuity) || 0 : 0,
              tds: salaryData ? Number(salaryData.tds) || 0 : 0,
              esic: salaryData ? Number(salaryData.esic) || 0 : 0,
              other_deductions: salaryData ? Number(salaryData.other_deductions) || 0 : 0,
              net_salary: salaryData ? Number(salaryData.net_salary) || 0 : 0,
              effective_date: salaryData?.effective_date ? salaryData.effective_date.split('T')[0] : (data.joining_date ? data.joining_date.split('T')[0] : ''),
            },

            kyc_documents: data.kyc_documents || {},
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadEmp();
  }, [id]);

  // Auto-Calculate Breakdown from Annual CTC & Variable Pay
  const handleRecalculateSalary = () => {
    if (!formData.salary) return;
    const ctc = Number(formData.salary.annual_ctc) || 0;
    const variable = Number(formData.salary.variable_pay) || 0;
    const b = calculateCompensation(ctc, variable);
    setFormData((prev) => ({
      ...prev,
      salary: {
        ...prev.salary,
        annual_ctc: ctc,
        variable_pay: variable,
        monthly_gross: b.monthlyGross,
        basic: b.basic,
        hra: b.hra,
        employee_pf: b.employeePf,
        employer_pf: b.employerPf,
        professional_tax: b.professionalTax,
        gratuity: b.gratuity,
        tds: b.tds,
        net_salary: b.netSalary,
        special_allowance: Math.max(0, b.monthlyGross - (b.basic + b.hra + 1600)),
        conveyance: 1600,
        other_allowances: b.otherAllowances,
      },
    }));
    toast.success('Salary component breakdown auto-calculated.');
  };

  // Live recalculate Net In-Hand from current values
  const handleCalculateInHand = () => {
    if (!formData.salary) return;
    const gross = Number(formData.salary.monthly_gross) || 0;
    const empPf = Number(formData.salary.employee_pf) || 0;
    const emplyrPf = Number(formData.salary.employer_pf) || 0;
    const pt = Number(formData.salary.professional_tax) || 0;
    const b = Number(formData.salary.basic) || 0;
    const gratuity = Number(formData.salary.gratuity) || Math.round((b * 15) / (26 * 12));
    const tdsVal = Number(formData.salary.tds) || 0;
    const esicVal = Number(formData.salary.esic) || 0;
    const otherDedVal = Number(formData.salary.other_deductions) || 0;

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

    setFormData((prev) => ({
      ...prev,
      salary: {
        ...prev.salary,
        net_salary: res.netSalary,
      },
    }));
    toast.success(`Net In-Hand recalculated: ${formatCurrency(res.netSalary)}`);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If Employee ID was modified, require explicit confirmation modal
    if (formData.employee_id && formData.employee_id.trim() !== originalEmpId) {
      if (!/^[A-Z0-9 -]{3,30}$/i.test(formData.employee_id.trim())) {
        setError('Employee ID must be 3-30 alphanumeric characters (hyphens and spaces allowed).');
        return;
      }
      setShowIdConfirmModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    setSubmitting(true);
    setError(null);
    setShowIdConfirmModal(false);

    if (formData.department_id === 'other') {
      const trimmed = (formData.custom_department || '').trim();
      if (!trimmed || trimmed.length < 2) {
        setError('Other Department Name must be at least 2 characters.');
        setSubmitting(false);
        return;
      }
      if (trimmed.length > 100) {
        setError('Other Department Name cannot exceed 100 characters.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const finalPayload = {
        ...formData,
        salary: formData.salary ? {
          ...formData.salary,
          annual_ctc: Number(formData.salary.annual_ctc) || 0,
          variable_pay: Number(formData.salary.variable_pay) || 0,
          monthly_gross: Number(formData.salary.monthly_gross) || 0,
          basic: Number(formData.salary.basic) || 0,
          hra: Number(formData.salary.hra) || 0,
          special_allowance: Number(formData.salary.special_allowance) || 0,
          conveyance: Number(formData.salary.conveyance) || 0,
          other_allowances: Number(formData.salary.other_allowances) || 0,
          employee_pf: Number(formData.salary.employee_pf) || 0,
          employer_pf: Number(formData.salary.employer_pf) || 0,
          professional_tax: Number(formData.salary.professional_tax) || 0,
          gratuity: Number(formData.salary.gratuity) || 0,
          tds: Number(formData.salary.tds) || 0,
          esic: Number(formData.salary.esic) || 0,
          other_deductions: Number(formData.salary.other_deductions) || 0,
          net_salary: Number(formData.salary.net_salary) || 0,
          effective_date: formData.salary.effective_date || formData.joining_date || undefined,
        } : undefined,
      };

      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update employee master record.');
      }

      toast.success('Employee master record and compensation saved successfully.');
      router.push(`/employees/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLoader
        title="Loading Master Profile..."
        subtitle="Retrieving employee personal information, statutory records, and payroll configuration."
      />
    );
  }

  const SECTIONS = [
    { id: 'A', label: 'A. Personal Profile', icon: User },
    { id: 'B', label: 'B. Statutory / KYC', icon: ShieldCheck },
    { id: 'C', label: 'C. Employment Details', icon: Briefcase },
    { id: 'D', label: 'D. Bank & Payroll', icon: Banknote },
    { id: 'E', label: 'E. Documents & Refs', icon: FolderOpen },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/employees/${id}`}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Edit Employee Master Record — {formData.full_name}
            </h1>
            <p className="text-xs text-slate-500">
              Update personnel information, statutory data, employment terms, and payroll configuration
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
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="font-mono text-xs font-bold px-2 py-0.5 border border-blue-400 rounded bg-blue-50/50 text-blue-900 outline-none w-28 uppercase"
                placeholder="VL 1086"
              />
              <button
                type="button"
                onClick={() => setIsEditingId(false)}
                className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded transition flex items-center gap-0.5"
              >
                <CheckCircle2 className="h-3 w-3" /> Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {formData.employee_id}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingId(true)}
                className="text-[10px] font-bold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition flex items-center gap-1"
                title="Edit Employee ID"
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

      {/* Section Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {sec.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handlePreSubmit} className="space-y-6">
        
        {/* SECTION A — Personal Profile */}
        {activeSection === 'A' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              SECTION A — Personal Particulars
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="lg:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Gender</label>
                <select
                  value={formData.gender || 'Male'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Father&apos;s Name</label>
                <input
                  type="text"
                  value={formData.father_name || ''}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mother&apos;s Name</label>
                <input
                  type="text"
                  value={formData.mother_name || ''}
                  onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Personal Email</label>
                <input
                  type="email"
                  value={formData.personal_email || ''}
                  onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Primary Contact *</label>
                <input
                  type="text"
                  required
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Alternate Contact</label>
                <input
                  type="text"
                  value={formData.alternate_phone || ''}
                  onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">Permanent Residential Address *</label>
                <textarea
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">Current Correspondence Address</label>
                <textarea
                  rows={2}
                  value={formData.current_address || ''}
                  onChange={(e) => setFormData({ ...formData, current_address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PIN Code</label>
                <input
                  type="text"
                  value={formData.pin_code || ''}
                  onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION B — Statutory & Identity Information */}
        {activeSection === 'B' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              SECTION B — Statutory &amp; Identity Identifiers
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">PAN Number</label>
                <input
                  type="text"
                  value={formData.pan_number || ''}
                  onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Aadhaar Number</label>
                <input
                  type="text"
                  value={formData.aadhaar_number || ''}
                  onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Passport Number</label>
                <input
                  type="text"
                  value={formData.passport_number || ''}
                  onChange={(e) => setFormData({ ...formData, passport_number: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">UAN</label>
                <input
                  type="text"
                  value={formData.uan || ''}
                  onChange={(e) => setFormData({ ...formData, uan: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">PF Number</label>
                <input
                  type="text"
                  value={formData.pf_number || ''}
                  onChange={(e) => setFormData({ ...formData, pf_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">ESIC Number</label>
                <input
                  type="text"
                  value={formData.esic_number || ''}
                  onChange={(e) => setFormData({ ...formData, esic_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION C — Employment Information */}
        {activeSection === 'C' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-purple-600" />
              SECTION C — Employment Terms &amp; Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date of Joining *</label>
                <input
                  type="date"
                  value={formData.joining_date || ''}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Department *</label>
                <select
                  value={formData.department_id || 'dept-eng'}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="dept-eng">Engineering &amp; Technology</option>
                  <option value="dept-product">Product &amp; Design</option>
                  <option value="dept-hr">Human Resources</option>
                  <option value="dept-fin-ops">Finance &amp; Operations</option>
                  <option value="other">Other (Custom Department)</option>
                </select>
              </div>

              {formData.department_id === 'other' && (
                <div>
                  <label className="font-semibold text-blue-700 block mb-1">Custom Department Name *</label>
                  <input
                    type="text"
                    value={formData.custom_department || ''}
                    onChange={(e) => setFormData({ ...formData, custom_department: e.target.value })}
                    className="w-full p-2.5 border border-blue-400 bg-blue-50/40 rounded-lg outline-none font-bold"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Designation *</label>
                <input
                  type="text"
                  value={formData.designation || ''}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employment Type</label>
                <select
                  value={formData.employment_type || 'FULL_TIME'}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="FULL_TIME">Full-Time Regular</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="CONTRACT">Contractual</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Work Location *</label>
                <input
                  type="text"
                  value={formData.work_location || ''}
                  onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reporting Manager</label>
                <input
                  type="text"
                  value={formData.reporting_manager || ''}
                  onChange={(e) => setFormData({ ...formData, reporting_manager: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Probation Period</label>
                <input
                  type="text"
                  value={formData.probation_period || ''}
                  onChange={(e) => setFormData({ ...formData, probation_period: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notice Period</label>
                <input
                  type="text"
                  value={formData.notice_period || ''}
                  onChange={(e) => setFormData({ ...formData, notice_period: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Employment Status</label>
                <select
                  value={formData.status || 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INTERN">INTERN</option>
                  <option value="ON_NOTICE">ON NOTICE</option>
                  <option value="SEPARATED">SEPARATED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Confirmation Date</label>
                <input
                  type="date"
                  value={formData.confirmation_date || ''}
                  onChange={(e) => setFormData({ ...formData, confirmation_date: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Last Working Date</label>
                <input
                  type="date"
                  value={formData.last_working_date || ''}
                  onChange={(e) => setFormData({ ...formData, last_working_date: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="font-semibold text-slate-700 block mb-1">Separation Reason</label>
                <input
                  type="text"
                  value={formData.separation_reason || ''}
                  onChange={(e) => setFormData({ ...formData, separation_reason: e.target.value })}
                  placeholder="Reason for resignation / relieving / exit"
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION D — Bank & Payroll Information */}
        {activeSection === 'D' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              SECTION D — Bank Coordinates &amp; Salary Structure
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={formData.bank_account_holder_name || ''}
                  onChange={(e) => setFormData({ ...formData, bank_account_holder_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Number</label>
                <input
                  type="text"
                  value={formData.bank_account_number || ''}
                  onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bank_ifsc || ''}
                  onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono uppercase"
                />
              </div>
            </div>

            {/* Salary Components & Structure */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <span>Salary Components &amp; Deductions</span>
                    {hasExistingSalary ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 normal-case">
                        Active Persisted Record {formData.salary?.effective_date ? `(Effective: ${formData.salary.effective_date})` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 normal-case">
                        No Prior Salary Record (Initialize Below)
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure standard CTC, statutory PF, PT, gratuity, and tax deductions
                  </p>
                </div>

                {/* Calculation Tools */}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                {/* 1. Annual CTC */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Annual CTC (INR)</label>
                  <input
                    type="number"
                    value={formData.salary?.annual_ctc ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, annual_ctc: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.annual_ctc || 0)} / year</span>
                </div>

                {/* 2. Variable Pay */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Variable Pay (Annual)</label>
                  <input
                    type="number"
                    value={formData.salary?.variable_pay ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, variable_pay: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.variable_pay || 0)}</span>
                </div>

                {/* 3. Monthly Gross */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Monthly Gross (INR)</label>
                  <input
                    type="number"
                    value={formData.salary?.monthly_gross ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, monthly_gross: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.monthly_gross || 0)} / month</span>
                </div>

                {/* 4. Basic Salary */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Basic Salary (Monthly)</label>
                  <input
                    type="number"
                    value={formData.salary?.basic ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, basic: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.basic || 0)}</span>
                </div>

                {/* 5. HRA */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">HRA (Monthly)</label>
                  <input
                    type="number"
                    value={formData.salary?.hra ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, hra: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.hra || 0)}</span>
                </div>

                {/* 6. Special Allowance */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Special Allowance</label>
                  <input
                    type="number"
                    value={formData.salary?.special_allowance ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, special_allowance: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.special_allowance || 0)}</span>
                </div>

                {/* 7. Conveyance */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Conveyance Allowance</label>
                  <input
                    type="number"
                    value={formData.salary?.conveyance ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, conveyance: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.conveyance || 0)}</span>
                </div>

                {/* 8. Other Allowances */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Other Allowances</label>
                  <input
                    type="number"
                    value={formData.salary?.other_allowances ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, other_allowances: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{formatCurrency(formData.salary?.other_allowances || 0)}</span>
                </div>

                {/* 9. Employee PF */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Employee PF (12%)</label>
                  <input
                    type="number"
                    value={formData.salary?.employee_pf ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, employee_pf: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.employee_pf || 0)}</span>
                </div>

                {/* 10. Employer PF */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Employer PF (12%)</label>
                  <input
                    type="number"
                    value={formData.salary?.employer_pf ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, employer_pf: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.employer_pf || 0)}</span>
                </div>

                {/* 11. Professional Tax */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Professional Tax (PT)</label>
                  <input
                    type="number"
                    value={formData.salary?.professional_tax ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, professional_tax: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.professional_tax || 0)}</span>
                </div>

                {/* 12. Gratuity */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Gratuity Provision</label>
                  <input
                    type="number"
                    value={formData.salary?.gratuity ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, gratuity: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.gratuity || 0)}</span>
                </div>

                {/* 13. TDS */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">TDS / Income Tax</label>
                  <input
                    type="number"
                    value={formData.salary?.tds ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, tds: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.tds || 0)}</span>
                </div>

                {/* 14. ESIC */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ESIC Deduction</label>
                  <input
                    type="number"
                    value={formData.salary?.esic ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, esic: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.esic || 0)}</span>
                </div>

                {/* 15. Other Deductions */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Other Deductions</label>
                  <input
                    type="number"
                    value={formData.salary?.other_deductions ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, other_deductions: Number(e.target.value) }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-red-700 bg-white"
                  />
                  <span className="text-[10px] text-red-600 mt-0.5 block">-{formatCurrency(formData.salary?.other_deductions || 0)}</span>
                </div>

                {/* 16. Effective Date */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Salary Effective Date</label>
                  <input
                    type="date"
                    value={formData.salary?.effective_date || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, effective_date: e.target.value }
                    })}
                    className="w-full p-2 border border-slate-300 rounded font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Revision date</span>
                </div>
              </div>

              {/* Monthly Net In-Hand Highlight Card */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-emerald-900">Monthly Net (In-Hand) Take-Home</div>
                  <div className="text-[11px] text-emerald-700">Calculated as Monthly Gross minus statutory &amp; tax deductions</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xl font-black font-mono text-emerald-700">
                    {formatCurrency(formData.salary?.net_salary || 0)}
                  </div>
                  <input
                    type="number"
                    value={formData.salary?.net_salary ?? 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: { ...formData.salary, net_salary: Number(e.target.value) }
                    })}
                    className="w-32 p-1.5 border border-emerald-300 rounded font-mono font-bold text-xs text-emerald-900 bg-white outline-none"
                    title="Direct override if custom in-hand negotiated"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION E — Document References */}
        {activeSection === 'E' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-amber-600" />
              SECTION E — KYC &amp; Verification Document References
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">PAN Document Key</label>
                <input
                  type="text"
                  value={formData.kyc_documents?.pan || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    kyc_documents: { ...formData.kyc_documents, pan: e.target.value }
                  })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Aadhaar Document Key</label>
                <input
                  type="text"
                  value={formData.kyc_documents?.aadhaar || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    kyc_documents: { ...formData.kyc_documents, aadhaar: e.target.value }
                  })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Bank Proof Document Key</label>
                <input
                  type="text"
                  value={formData.kyc_documents?.bank_proof || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    kyc_documents: { ...formData.kyc_documents, bank_proof: e.target.value }
                  })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Resume / CV Document Key</label>
                <input
                  type="text"
                  value={formData.kyc_documents?.resume || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    kyc_documents: { ...formData.kyc_documents, resume: e.target.value }
                  })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Section <strong>{activeSection}</strong> of 5</span>
            <span className="text-slate-300">|</span>
            <span>Employee ID: <strong className="font-mono text-blue-800">{formData.employee_id}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/employees/${id}`}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-2 select-none ${
                submitting
                  ? 'bg-blue-400 cursor-not-allowed opacity-80'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 cursor-pointer'
              }`}
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" variant="white" label="Saving Changes..." />
                  <span>Saving Profile Changes...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* Confirmation Modal when modifying existing Employee ID */}
      {showIdConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Employee ID Change</h3>
                <p className="text-xs text-slate-500">
                  Modifying an established employee identifier is a sensitive administrative action.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Previous ID:</span>
                <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border">
                  {originalEmpId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">New Proposed ID:</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {formData.employee_id}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                This modification will be permanently recorded in the security audit log (<code>EMPLOYEE_ID_CHANGED</code>). All document links and salary records will continue to be safely linked via internal UUID.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowIdConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                aria-busy={submitting}
                onClick={executeSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                {submitting && <LoadingSpinner size="xs" variant="white" label="Updating..." />}
                <span>{submitting ? 'Updating...' : 'Confirm & Update ID'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
