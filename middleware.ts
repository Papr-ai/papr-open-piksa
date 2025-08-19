import NextAuth from 'next-auth';

import { authConfig } from '@/app/(auth)/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/',
    '/:id',
    '/subscription',
    '/usage',
    '/memories/:path*',
    '/onboarding',
    '/api/((?!auth|_next/static|_next/image|favicon.ico).*)',
    '/login',
    '/register',
    '/landing'
  ],
};
