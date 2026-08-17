import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SidebarClient from './SidebarClient';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="app-layout">
      <SidebarClient session={session} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
