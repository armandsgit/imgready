import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkAuthRateLimit, getRequestIp } from '@/lib/authRateLimit';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials, req) {
        const rawEmail = typeof credentials?.email === 'string' ? credentials.email : '';
        const rawPassword = typeof credentials?.password === 'string' ? credentials.password : '';
        const email = rawEmail.trim().toLowerCase();
        const password = rawPassword.trim();
        const rateLimitKey = `${email || 'unknown'}:${getRequestIp(req)}`;

        if (!email || !password) {
          return null;
        }

        const rateLimit = checkAuthRateLimit('login', rateLimitKey);
        if (!rateLimit.allowed) {
          throw new Error('TOO_MANY_ATTEMPTS');
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            emailVerified: true,
          },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
          return null;
        }

        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.trim().toLowerCase();
        return Boolean(email);
      }

      return true;
    },
    async jwt({ token, user, profile }) {
      const normalizedEmail =
        user?.email?.trim().toLowerCase() ??
        (typeof token.email === 'string' ? token.email.trim().toLowerCase() : '') ??
        (typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '');

      if (user) {
        token.sub = user.id;
        token.email = normalizedEmail;
      }

      if (normalizedEmail) {
        token.email = normalizedEmail;

        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });

        if (existingUser) {
          token.sub = existingUser.id;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.email = token.email ?? session.user.email ?? '';
      }

      return session;
    },
  },
};
