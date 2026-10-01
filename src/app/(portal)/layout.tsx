import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      <Navbar user={user} />
      <div className="flex flex-1 relative">
        <Sidebar user={user} />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-5 pb-3 border-b border-slate-200/80">
            <Breadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
