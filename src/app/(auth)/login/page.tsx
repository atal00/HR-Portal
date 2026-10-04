import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LoginClient from './LoginClient';

export const metadata = {
  title: 'Sign In | Varsaka HR Portal',
  description: 'Enterprise Sign In with Multi-Factor Authentication',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string; expired?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const reason = params?.reason || (params?.expired === 'true' ? 'inactivity' : undefined);

  const user = await getCurrentUser();

  // If already authenticated:
  if (user) {
    // 1. Temporary password must be changed first
    if (user.must_change_password) {
      redirect('/change-password');
    }
    // 2. MFA enrollment required before dashboard access
    if (!user.mfa_enabled) {
      redirect('/mfa-setup');
    }
    // 3. Fully verified -> dashboard
    redirect('/dashboard');
  }

  // Not authenticated -> show login form with reason notice if present
  return <LoginClient initialReason={reason} />;
}
