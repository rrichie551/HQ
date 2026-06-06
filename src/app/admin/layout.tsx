import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin is owner-only. Anyone else gets redirected to the regular dashboard.
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?callbackUrl=/admin');
  if (!isOwner(session)) redirect('/dashboard');
  return <>{children}</>;
}
