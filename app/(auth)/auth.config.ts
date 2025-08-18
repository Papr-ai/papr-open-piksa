import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
    error: '/error',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnChat = nextUrl.pathname.startsWith('/') && !nextUrl.pathname.startsWith('/subscription') && !nextUrl.pathname.startsWith('/memories') && !nextUrl.pathname.startsWith('/login') && !nextUrl.pathname.startsWith('/register') && !nextUrl.pathname.startsWith('/landing');
      const isOnRegister = nextUrl.pathname.startsWith('/register');
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isOnLanding = nextUrl.pathname.startsWith('/landing');
      const isOnSubscription = nextUrl.pathname.startsWith('/subscription');
      const isOnMemories = nextUrl.pathname.startsWith('/memories');

      if (isLoggedIn && (isOnLogin || isOnRegister || isOnLanding)) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
      }

      if (isOnRegister || isOnLogin || isOnLanding) {
        return true; // Always allow access to register, login, and landing pages
      }

      // Protected routes that require authentication
      if (isOnSubscription || isOnMemories || isOnChat) {
        if (isLoggedIn) return true;
        return Response.redirect(new URL('/landing', nextUrl as unknown as URL));
      }

      if (isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
