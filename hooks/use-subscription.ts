'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { SubscriptionPlan } from '@/lib/subscription/types';

interface SubscriptionStatus {
  subscriptionStatus: string;
  subscriptionPlan: string;
  hasActiveSubscription: boolean;
  plan?: SubscriptionPlan;
  subscriptionCurrentPeriodEnd?: string;
  loading: boolean;
  error?: string;
}

export function useSubscription(): SubscriptionStatus {
  const { data: session } = useSession();
  const [subscriptionData, setSubscriptionData] = useState<Omit<SubscriptionStatus, 'loading' | 'error'>>({
    subscriptionStatus: 'free',
    subscriptionPlan: 'free',
    hasActiveSubscription: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    fetch('/api/subscription/status')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch subscription status');
        }
        const data = await res.json();
        setSubscriptionData(data);
        setError(undefined);
      })
      .catch((err) => {
        console.error('Error fetching subscription status:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  return {
    ...subscriptionData,
    loading,
    error,
  };
}

export function useCanUsePremiumModels(): boolean {
  const { hasActiveSubscription, subscriptionPlan } = useSubscription();
  return hasActiveSubscription && ['basic', 'pro'].includes(subscriptionPlan);
}
