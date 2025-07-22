'use client';

import { useEffect, useState } from 'react';
import { useBreadcrumb } from './breadcrumb-context';
import { useRouter } from 'next/navigation';

interface ChatBreadcrumbProps {
  title: string;
  chatId?: string; // Optional chat ID for dynamic title updates
}

export function ChatBreadcrumb({ title: initialTitle, chatId }: ChatBreadcrumbProps) {
  const { setTitle } = useBreadcrumb();
  const [currentTitle, setCurrentTitle] = useState(initialTitle);
  const router = useRouter();

  useEffect(() => {
    setTitle(currentTitle);
    
    // Clean up when unmounting
    return () => {
      setTitle(null);
    };
  }, [currentTitle, setTitle]);

  // This component doesn't render anything, it just sets the title
  return null;
} 