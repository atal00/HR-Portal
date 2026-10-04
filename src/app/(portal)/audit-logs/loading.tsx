import React from 'react';
import { Skeleton, TableSkeleton } from '@/components/ui/Loading';

export default function AuditLogsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
