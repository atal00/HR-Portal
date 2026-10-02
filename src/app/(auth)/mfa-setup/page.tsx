import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import MfaSetupClient from './MfaSetupClient';

export const metadata = {
  title: 'MFA Setup | Varsaka HR Portal',
  description: 'Mandatory Multi-Factor Authentication Setup',
};

export default async function MfaSetupPage() {
  const user = await getCurrentUser();

  // 1. Not logged in -> redirect to login
  if (!user) {
    redirect('/login');
  }

  // 2. Temporary password pending -> redirect to change-password
  if (user.must_change_password) {
    redirect('/change-password');
  }

  // 3. MFA already active -> redirect to dashboard
  if (user.mfa_enabled) {
    redirect('/dashboard');
  }

  // 4. Authenticated, permanent password set, MFA not yet enabled -> allow MFA setup
  return <MfaSetupClient userEmail={user.email} />;
}
