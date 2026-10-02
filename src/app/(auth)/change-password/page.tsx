import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ChangePasswordClient from './ChangePasswordClient';

export const metadata = {
  title: 'Change Password | Varsaka HR Portal',
  description: 'Mandatory password change for Varsaka HR Portal',
};

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();

  // 1. Not logged in -> redirect to login
  if (!user) {
    redirect('/login');
  }

  // 2. If password does not need to be changed:
  if (!user.must_change_password) {
    // If MFA not enabled, route to MFA setup
    if (!user.mfa_enabled) {
      redirect('/mfa-setup');
    }
    // Fully authenticated -> route to dashboard
    redirect('/dashboard');
  }

  // 3. User must change temporary password
  return <ChangePasswordClient />;
}
