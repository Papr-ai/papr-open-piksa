import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { BreadcrumbProvider } from '@/components/layout/breadcrumb-context';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { cookies } from 'next/headers';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '@/app/(auth)/auth';
import Script from 'next/script';
import { HeaderActions } from '@/components/layout/header-actions';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { UsageWarning } from '@/components/subscription/usage-warning';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { ConditionalLayout } from '@/components/layout/conditional-layout';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.vercel.ai'),
  title: 'Creators.ai - AI-Powered Creative Platform',
  description: 'Create amazing content with AI assistance. From storytelling to character development, illustrations, and creative projects - your complete creative companion.',
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  
  // Force sidebar to be collapsed if user is not authenticated
  // The auth pages will handle their own layout appropriately
  const shouldCollapseSidebar = !session?.user;
  
  const isCollapsed = shouldCollapseSidebar || cookieStore.get('sidebar:state')?.value !== 'true';

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <Script
          src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="antialiased h-screen">
        <SessionProvider session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <BreadcrumbProvider>
              <Toaster position="top-center" />
              <OnboardingGuard>
                <ConditionalLayout user={session?.user} isCollapsed={isCollapsed}>
                  {children}
                </ConditionalLayout>
              </OnboardingGuard>
            </BreadcrumbProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
