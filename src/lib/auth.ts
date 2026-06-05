import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
        const expected = process.env.DASHBOARD_PASSWORD;
        if (!expected) return null;
        if (credentials?.password === expected) {
          return { id: 'client', name: process.env.CLIENT_OWNER ?? 'Client', email: 'client@local' };
        }
        return null;
      },
    }),
  ],
};
