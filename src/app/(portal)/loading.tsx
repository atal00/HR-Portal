import React from 'react';
import { PageLoader } from '@/components/ui/Loading';

export default function PortalLoading() {
  return (
    <div className="flex-1 min-h-[500px] flex items-center justify-center p-6">
      <PageLoader
        title="Loading Portal..."
        subtitle="Retrieving your workspace data and permissions."
      />
    </div>
  );
}
