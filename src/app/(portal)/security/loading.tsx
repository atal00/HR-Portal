import React from 'react';
import { Skeleton, TableSkeleton } from '@/components/ui/Loading';

export default function SecurityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`stat-${i}`} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={7} columns={5} />
    </div>
  );
}
