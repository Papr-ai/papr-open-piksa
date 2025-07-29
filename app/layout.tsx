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

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://chat.vercel.ai'),
  title: 'Papr Memory Chatbot Template',
  description: 'Next.js chatbot template using the AI SDK with Papr Memory.',
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
              <SidebarProvider defaultOpen={!isCollapsed} className="h-full">
                <AppSidebar user={session?.user} />
                <SidebarInset className="h-full overflow-hidden flex flex-col bg-sidebar">
                  {session?.user ? (
                  <div className="flex items-center h-12 px-4 py-2 bg-transparent z-10 shrink-0 justify-between">
                    <div className="flex items-center">
                      <HeaderActions />
                    </div>
                    
                    <Breadcrumb />
                    
                    <div className="flex items-center">
                      <Link
                        href="https://platform.papr.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 hidden md:flex py-1.5 px-3 rounded-md h-[34px] items-center"
                      >
                        <img src="/images/papr-logo.svg" alt="Papr Logo" className="size-4 mr-2" />
                        Docs
                      </Link>
                    </div>
                  </div>
                  ) : (
                    <div className="flex items-center h-2 px-4 py-2 bg-transparent z-10 shrink-0 justify-between">
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden p-3 pt-0">
                    <main className="flex-1 overflow-hidden rounded-lg bg-background h-full shadow-sm">
                      {children}
                    </main>
                  </div>
                </SidebarInset>
              </SidebarProvider>
            </BreadcrumbProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
