'use client';

import { useEffect } from 'react';
import { useBreadcrumb } from '@/components/layout/breadcrumb-context';

interface BookBreadcrumbWrapperProps {
  bookTitle: string;
  children: React.ReactNode;
}

export function BookBreadcrumbWrapper({ bookTitle, children }: BookBreadcrumbWrapperProps) {
  const { setTitle } = useBreadcrumb();

  useEffect(() => {
    setTitle(bookTitle);
    
    // Cleanup on unmount
    return () => setTitle(null);
  }, [bookTitle, setTitle]);

  return <>{children}</>;
}
