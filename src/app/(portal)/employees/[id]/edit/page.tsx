'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Employee } from '@/types/database';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    full_name: '',
    phone: '',
    address: '',
    department_id: '',
    designation: '',
    work_location: '',
    reporting_manager: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    async function loadEmp() {
      try {
        const res = await fetch(`/api/employees/${id}`);
        if (res.ok) {
          const data: Employee = await res.json();
          setFormData({
            full_name: data.full_name,
            phone: data.phone,
            address: data.address,
            department_id: data.department_id,
            designation: data.designation,
            work_location: data.work_location,
            reporting_manager: data.reporting_manager || '',
            status: data.status,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update employee');
      }

      router.push(`/employees/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading employee details...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      <div className="flex items-center gap-3">
        <Link
          href={`/employees/${id}`}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Edit Employee Profile</h1>
          <p className="text-xs text-slate-500">Update contact coordinates and organizational role</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Full Legal Name</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Contact Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Official Designation</label>
          <input
            type="text"
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Department</label>
          <select
            value={formData.department_id}
            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="dept-eng">Engineering & Technology</option>
            <option value="dept-fin-ops">Finance & Operations</option>
            <option value="dept-hr">Human Resources</option>
            <option value="dept-product">Product & Design</option>
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Work Location</label>
          <input
            type="text"
            value={formData.work_location}
            onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Reporting Manager</label>
          <input
            type="text"
            value={formData.reporting_manager}
            onChange={(e) => setFormData({ ...formData, reporting_manager: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Employment Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INTERN">INTERN</option>
            <option value="ON_NOTICE">ON NOTICE</option>
            <option value="SEPARATED">SEPARATED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">Residential Address</label>
          <textarea
            rows={3}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href={`/employees/${id}`}
            className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold transition shadow-xs disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting ? 'Saving Changes...' : 'Update Record'}
          </button>
        </div>
      </form>

    </div>
  );
}
