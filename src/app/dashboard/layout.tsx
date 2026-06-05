import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Only enforce auth if a password is configured
  if (process.env.DASHBOARD_PASSWORD) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/login?callbackUrl=/dashboard');
  }
  return <>{children}</>;
}
