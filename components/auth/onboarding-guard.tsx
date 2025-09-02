'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Skip check for certain paths - always allow these paths (except onboarding)
      if (
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/landing' ||
        pathname.startsWith('/api/')
      ) {
        setIsChecking(false);
        hasCheckedRef.current = false; // Reset for allowed paths
        return;
      }

      // Still loading session
      if (status === 'loading') {
        return;
      }

      // For onboarding page specifically - always allow (middleware handles auth)
      if (pathname === '/onboarding') {
        setIsChecking(false);
        return;
      }

      // Not authenticated - no need to check onboarding for other pages
      if (status === 'unauthenticated' || !session?.user) {
        setIsChecking(false);
        hasCheckedRef.current = false;
        return;
      }

      // Prevent duplicate checks
      if (hasCheckedRef.current) {
        setIsChecking(false);
        return;
      }

      hasCheckedRef.current = true;

      try {
        // Check if user has completed onboarding
        const response = await fetch('/api/user/onboarding-status');
        if (response.ok) {
          const { onboardingCompleted } = await response.json();
          
          if (!onboardingCompleted) {
            router.replace('/onboarding');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      }

      setIsChecking(false);
    };

    checkOnboardingStatus();
  }, [session, status, pathname, router]);

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // For onboarding page, render children directly without sidebar layout
  if (pathname === '/onboarding') {
    return <>{children}</>;
  }

  return <>{children}</>;
}
