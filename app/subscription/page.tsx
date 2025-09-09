'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { PricingCard } from '@/components/subscription/pricing-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import { useSubscription } from '@/components/subscription/subscription-context';

export default function SubscriptionPage() {
  const { data: session, status: sessionStatus } = useSession();
  // Use the new real-time subscription context
  const subscriptionContext = useSubscription();
  const [subscribing, setSubscribing] = useState(false);

  // Debug logging to help identify the issue
  console.log('Subscription page render:', { 
    sessionStatus, 
    hasUser: !!session?.user, 
    subscriptionLoading: subscriptionContext.subscriptionLoading,
    isConnected: subscriptionContext.isConnected 
  });

  const handleSubscribe = async (planId: string) => {
    if (!session?.user || planId === 'free') return;

    setSubscribing(true);
    try {
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: planId,
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start subscription process. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/subscription/customer-portal', {
        method: 'POST',
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create customer portal session');
      }
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      alert('Failed to open customer portal. Please try again.');
    }
  };

  // Show loading state while session is loading or subscription data is loading
  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && subscriptionContext.subscriptionLoading)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  // Show login message if not authenticated
  // Only show unauthenticated state if we're certain the session is not loading
  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Subscription</h1>
          <p>Please log in to manage your subscription.</p>
        </div>
      </div>
    );
  }

  // If we have a session but no user data, wait for it to load
  if (!session?.user && sessionStatus === 'authenticated') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Loading user data...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upgrade to unlock premium AI models and enhanced features for your conversations.
        </p>
        <div className="mt-4">
          <Link href="/usage">
            <Button variant="outline">
              View Current Usage
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isPopular={plan.isPopular}
            onSubscribe={handleSubscribe}
            onManageSubscription={handleManageSubscription}
            isCurrentPlan={subscriptionContext.subscription.subscriptionPlan === plan.id}
            hasActiveSubscription={subscriptionContext.subscription.hasActiveSubscription}
            renewalDate={subscriptionContext.subscription.subscriptionCurrentPeriodEnd?.toISOString()}
            loading={subscribing}
          />
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          All plans include access to basic AI models. Premium models require a paid subscription.
        </p>
      </div>
    </div>
  );
}
