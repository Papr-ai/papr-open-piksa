'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { PricingCard } from '@/components/subscription/pricing-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import { useSubscription } from '@/hooks/use-subscription';

export default function SubscriptionPage() {
  const { data: session, status: sessionStatus } = useSession();
  const subscriptionStatus = useSubscription();
  const [subscribing, setSubscribing] = useState(false);

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

  // Show loading state while session is loading
  if (sessionStatus === 'loading' || subscriptionStatus.loading) {
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
          <h1 className="text-3xl font-bold mb-4">Subscription</h1>
          <p>Please log in to manage your subscription.</p>
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
      </div>

      {subscriptionStatus.hasActiveSubscription && (
        <Card className="mb-8 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>
              You are currently on the {subscriptionStatus.plan?.name} plan
              {subscriptionStatus.subscriptionCurrentPeriodEnd && (
                <span> (renews on {new Date(subscriptionStatus.subscriptionCurrentPeriodEnd).toLocaleDateString()})</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleManageSubscription}>
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            isPopular={plan.isPopular}
            onSubscribe={handleSubscribe}
            isCurrentPlan={subscriptionStatus.subscriptionPlan === plan.id}
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
