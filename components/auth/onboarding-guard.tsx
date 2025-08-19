'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Skip check for certain paths
      if (
        pathname === '/onboarding' ||
        pathname === '/login' ||
        pathname === '/register' ||
        pathname === '/landing' ||
        pathname.startsWith('/api/')
      ) {
        setIsChecking(false);
        return;
      }

      if (status === 'loading') {
        return; // Still loading session
      }

      if (!session?.user) {
        setIsChecking(false);
        return; // Not authenticated
      }

      try {
        // Check if user has completed onboarding
        const response = await fetch('/api/user/onboarding-status');
        if (response.ok) {
          const { onboardingCompleted } = await response.json();
          
          if (!onboardingCompleted) {
            router.push('/onboarding');
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
