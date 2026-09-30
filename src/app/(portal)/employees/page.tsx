'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Employee, EmployeeStatus } from '@/types/database';
import { formatDate } from '@/lib/utils';
import {
  Users,
  Search,
  PlusCircle,
  Filter,
  Eye,
  Edit2,
  Building2,
  Mail,
  Phone,
  Briefcase
} from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/employees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
  };

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'INTERN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ON_NOTICE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEPARATED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'INACTIVE':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="h-7 w-7 text-blue-600" />
            Employee Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain official personnel records, employment lifecycles, and associated documentation
          </p>
        </div>

        <Link
          href="/employees/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-xs self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          Onboard New Employee
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID (e.g. VL 1083), email..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INTERN">INTERN</option>
            <option value="ON_NOTICE">ON NOTICE</option>
            <option value="SEPARATED">SEPARATED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading employee directory...</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No employees found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Employee ID & Name</th>
                  <th className="px-4 py-3">Department & Designation</th>
                  <th className="px-4 py-3">Engagement & Location</th>
                  <th className="px-4 py-3">Joining Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{emp.full_name}</div>
                      <div className="font-mono text-blue-600 font-semibold text-[11px] mt-0.5">
                        {emp.employee_id}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {emp.email}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">{emp.designation}</div>
                      <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {emp.department_name}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800">{emp.employment_type}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{emp.work_location}</div>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-800">
                      {formatDate(emp.joining_date)}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusBadge(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-blue-600 transition"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/employees/${emp.id}/edit`}
                          className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
                          title="Edit Employee"
                        >
                          <Edit2 className="h-4 w-4" />
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
