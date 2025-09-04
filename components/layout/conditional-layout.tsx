'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { HeaderActions } from '@/components/layout/header-actions';
import { Breadcrumb } from '@/components/layout/breadcrumb';

import Link from 'next/link';

interface ConditionalLayoutProps {
  children: React.ReactNode;
  user: any;
  isCollapsed: boolean;
}

export function ConditionalLayout({ children, user, isCollapsed }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const { data: clientSession, status } = useSession();
  
  // Use client-side session as the source of truth for user state
  const currentUser = clientSession?.user || user;
  
  // Detect chat pages that need full-height layout (specific book chat pages, not all /books/ pages)
  const isChatPage = pathname?.startsWith('/chat/') || (pathname?.startsWith('/books/') && pathname?.match(/^\/books\/[^\/]+$/));
  
  // Debug logging to see what's happening with both sessions
  // console.log('ConditionalLayout:', { 
  //   hasServerUser: !!user, 
  //   hasClientUser: !!clientSession?.user, 
  //   sessionStatus: status,
  //   pathname, 
  //   isCollapsed 
  // });
  
  // Special pages that don't use the sidebar layout
  const isSpecialPage = pathname === '/onboarding' || 
                       pathname === '/login' || 
                       pathname === '/register' || 
                       pathname === '/landing';

  if (isSpecialPage) {
    return <>{children}</>;
  }

  // Don't render sidebar if we're still loading the session
  if (status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={!isCollapsed} className="h-full">
      <AppSidebar user={currentUser} />
      <SidebarInset className="h-full overflow-hidden flex flex-col bg-sidebar">
        {currentUser ? (
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
        {isChatPage ? (
          // Chat pages need full-height layout without nested scrolling
          <div className="flex-1 min-h-0">
            {children}
          </div>
        ) : (
          // Regular pages use the standard scrollable layout
          <div className="flex-1 overflow-auto p-3 pt-0">
            <main className="flex-1 overflow-auto rounded-lg bg-background min-h-full shadow-sm">
              {children}
            </main>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
