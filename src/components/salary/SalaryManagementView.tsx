'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Employee, EmployeeSalary } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, X, ArrowRight, ShieldCheck, Banknote } from 'lucide-react';

interface SalaryRecordItem {
  emp: Employee;
  sal: EmployeeSalary | null;
}

interface Props {
  initialSalaries: SalaryRecordItem[];
}

export function SalaryManagementView({ initialSalaries }: Props) {
  const [search, setSearch] = useState('');

  // Reactive filtering by employee name, employee ID, or corporate email
  const filteredSalaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return initialSalaries;

    return initialSalaries.filter(({ emp }) => {
      const nameMatch = emp.full_name?.toLowerCase().includes(query) ?? false;
      const idMatch = emp.employee_id?.toLowerCase().includes(query) ?? false;
      const emailMatch = emp.email?.toLowerCase().includes(query) ?? false;
      const designationMatch = emp.designation?.toLowerCase().includes(query) ?? false;
      return nameMatch || idMatch || emailMatch || designationMatch;
    });
  }, [search, initialSalaries]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Banknote className="h-7 w-7 text-emerald-600" />
            Salary &amp; Compensation Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Restricted compensation ledger, statutory PF/Tax deductions, and monthly payroll calculations
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Clearance: Payroll Authorized</span>
        </div>
      </div>

      {/* Reactive Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID (e.g. VL 1083), email..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredSalaries.length}</strong> of <strong>{initialSalaries.length}</strong> authorized records
        </div>
      </div>

      {/* Salary Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredSalaries.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <div>No authorized salary records found matching <strong>"{search}"</strong>.</div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-emerald-700 font-semibold underline hover:text-emerald-900"
              >
                Clear search to restore full list
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Annual CTC</th>
                  <th className="px-4 py-3">Monthly Gross</th>
                  <th className="px-4 py-3">Basic Pay</th>
                  <th className="px-4 py-3">Monthly Net (In-hand)</th>
                  <th className="px-4 py-3">Effective Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSalaries.map(({ emp, sal }) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{emp.full_name}</div>
                      <div className="font-mono text-blue-600 font-semibold text-[11px]">{emp.employee_id}</div>
                      <div className="text-[10px] text-slate-400">{emp.designation}</div>
                      {emp.email && <div className="text-[10px] text-slate-500">{emp.email}</div>}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 text-sm">
                      {sal ? formatCurrency(sal.annual_ctc) : <span className="text-slate-400 font-normal text-xs">Not Set</span>}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-800">
                      {sal ? formatCurrency(sal.monthly_gross) : <span className="text-slate-400 font-normal text-xs">₹0.00</span>}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-800">
                      {sal ? formatCurrency(sal.basic) : <span className="text-slate-400 font-normal text-xs">₹0.00</span>}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 text-sm">
                      {sal ? formatCurrency(sal.net_salary) : <span className="text-slate-400 font-normal text-xs">₹0.00</span>}
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-600">
                      {sal?.effective_date ? formatDate(sal.effective_date) : 'N/A'}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link
                          href={`/employees/${emp.id}/edit`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 font-semibold text-xs cursor-pointer"
                          title="Edit Employee & Salary"
                        >
                          <span>Edit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
