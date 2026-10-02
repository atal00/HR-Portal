import React from 'react';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { UserManagementView } from '@/components/users/UserManagementView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function UsersPage() {
  const user = await getCurrentUser();
  const users = await db.users.list();

  return (
    <UserManagementView
      initialUsers={users}
      currentUserRole={user?.role || 'VIEWER'}
      currentUserId={user?.id || ''}
    />
  );
}
