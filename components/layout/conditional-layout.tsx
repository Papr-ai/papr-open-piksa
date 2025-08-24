'use client';

import { usePathname } from 'next/navigation';
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
  
  // Special pages that don't use the sidebar layout
  const isSpecialPage = pathname === '/onboarding' || 
                       pathname === '/login' || 
                       pathname === '/register' || 
                       pathname === '/landing';

  if (isSpecialPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={!isCollapsed} className="h-full">
      <AppSidebar user={user} />
      <SidebarInset className="h-full overflow-hidden flex flex-col bg-sidebar">
        {user ? (
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
  );
}
