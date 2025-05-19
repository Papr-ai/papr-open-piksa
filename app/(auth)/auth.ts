import { compare } from 'bcrypt-ts';
import NextAuth, { type User, type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { getUser } from '@/lib/db/queries';

import { authConfig } from './auth.config';

interface ExtendedUser extends User {
  id: string;
  paprUserId?: string;
}

interface ExtendedSession extends Session {
  user: ExtendedUser;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);
        if (users.length === 0) return null;
        // biome-ignore lint: Forbidden non-null assertion.
        const passwordsMatch = await compare(password, users[0].password!);
        if (!passwordsMatch) return null;

        const dbUser = users[0];
        // Store the base user data that NextAuth expects
        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: null,
        };

        // Store additional data in a separate field that will be passed to jwt callback
        Object.defineProperty(user, '_paprUserId', {
          value: dbUser.paprUserId,
          enumerable: true,
        });

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Store paprUserId in a separate field in the token
        if ('_paprUserId' in user) {
          token._paprUserId = user._paprUserId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Add paprUserId to the session user if available
        if ('_paprUserId' in token) {
          (session.user as ExtendedUser).paprUserId =
            token._paprUserId as string;
        }
      }
      return session;
    },
  },
});
