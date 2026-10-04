import React from 'react';
import { Skeleton, TableSkeleton } from '@/components/ui/Loading';

export default function TasksLoading() {
  return (
    <div className="space-y-6">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Task Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`metric-${i}`} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
