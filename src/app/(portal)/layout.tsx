import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser, LAST_ACTIVITY_COOKIE_NAME, INACTIVITY_TIMEOUT_MS, AUTH_COOKIE } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { InactivityTracker } from '@/components/auth/InactivityTracker';
import { Toaster } from 'react-hot-toast';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const lastActivity = cookieStore.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
  const hasSession = Boolean(cookieStore.get(AUTH_COOKIE.name)?.value);

  // Server-side check: If session exists but inactivity timeout exceeded, fail closed and redirect
  if (hasSession && lastActivity) {
    const lastActivityTime = parseInt(lastActivity, 10);
    if (!isNaN(lastActivityTime) && Date.now() - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
      redirect('/login?reason=inactivity');
    }
  }

  const user = await getCurrentUser();

  if (!user) {
    if (hasSession || lastActivity) {
      redirect('/login?reason=inactivity');
    }
    redirect('/login');
  }

  if (user.must_change_password) {
    redirect('/change-password');
  }

  if (!user.mfa_enabled) {
    redirect('/mfa-setup');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <InactivityTracker />
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <div className="no-print">
        <Navbar user={user} />
      </div>
      <div className="flex flex-1 relative">
        <div className="no-print">
          <Sidebar user={user} />
        </div>
        <main className="portal-main flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-5 pb-3 border-b border-slate-200/80 no-print">
            <Breadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
