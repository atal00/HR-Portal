import React from 'react';
import { Skeleton } from '@/components/ui/Loading';

export default function EditEmployeeLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" role="status" aria-label="Loading employee editor...">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex gap-2 border-b border-slate-100 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 flex-1 rounded-xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
