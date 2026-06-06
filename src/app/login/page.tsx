import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isOwner } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  // If already authenticated, bounce to the appropriate landing page so the
  // login form never shows over an active session. Owners can /admin straight
  // away; clients always see /dashboard.
  const session = await getServerSession(authOptions);
  if (session) {
    const dest = searchParams.callbackUrl?.startsWith('/')
      ? searchParams.callbackUrl
      : isOwner(session)
        ? '/admin'
        : '/dashboard';
    redirect(dest);
  }
  return <LoginForm />;
}
