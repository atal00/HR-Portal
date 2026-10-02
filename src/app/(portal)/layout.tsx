import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Toaster } from 'react-hot-toast';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.must_change_password) {
    redirect('/change-password');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
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
