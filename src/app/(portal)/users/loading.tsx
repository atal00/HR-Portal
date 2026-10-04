import React from 'react';
import { TableSkeleton, Skeleton } from '@/components/ui/Loading';

export default function UsersLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading users...">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between gap-4">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>

      <TableSkeleton rows={6} columns={6} />
    </div>
  );
}
