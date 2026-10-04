import React from 'react';
import { Skeleton, TableSkeleton } from '@/components/ui/Loading';

export default function SalaryLoading() {
  return (
    <div className="space-y-6">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Salary Overview Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`stat-${i}`} className="p-6 bg-white border border-slate-200 rounded-xl space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
