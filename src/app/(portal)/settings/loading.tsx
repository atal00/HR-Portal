import React from 'react';
import { Skeleton } from '@/components/ui/Loading';

export default function SettingsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" role="status" aria-label="Loading settings...">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <Skeleton className="h-5 w-72" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
