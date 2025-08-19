'use client';

import { useSession } from 'next-auth/react';
import { UsageOverviewCard } from '@/components/subscription/usage-warning';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function UsagePage() {
  const { data: session, status: sessionStatus } = useSession();

  // Show loading state while session is being fetched
  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  // Show login message if not authenticated
  if (sessionStatus === 'unauthenticated' || !session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Usage Overview</h1>
          <p>Please log in to view your usage statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Usage Overview</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Monitor your current usage across all features and see how much of your monthly limits you've consumed.
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <UsageOverviewCard />
        
        <div className="text-center">
          <Link href="/subscription">
            <Button variant="outline" className="mr-4">
              View Subscription Plans
            </Button>
          </Link>
          <Link href="/">
            <Button>
              Continue Chatting
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
