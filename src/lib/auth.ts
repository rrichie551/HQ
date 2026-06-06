import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { JWT } from 'next-auth/jwt';

export type Role = 'owner' | 'client';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Dashboard',
      credentials: {
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const owner = process.env.OWNER_PASSWORD;
        const client = process.env.DASHBOARD_PASSWORD;
        const supplied = credentials?.password ?? '';

        // Owner password takes precedence if it's set — owners get full access.
        if (owner && supplied === owner) {
          return { id: 'owner', name: 'Owner', email: 'owner@local', role: 'owner' as Role } as any;
        }
        if (client && supplied === client) {
          return {
            id: 'client',
            name: process.env.CLIENT_OWNER ?? 'Client',
            email: 'client@local',
            role: 'client' as Role,
          } as any;
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).role) (token as any).role = (user as any).role;
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) (session.user as any).role = (token as any).role ?? 'client';
      return session;
    },
  },
};

export function sessionRole(session: Session | null): Role | null {
  if (!session?.user) return null;
  return ((session.user as any).role as Role) ?? 'client';
}

export function isOwner(session: Session | null): boolean {
  return sessionRole(session) === 'owner';
}
