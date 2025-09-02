'use client';

import { useState, useEffect, useRef } from 'react';
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

export function useSubscription(syncWithStripe: boolean = false): SubscriptionStatus {
  const { data: session, status: sessionStatus } = useSession();
  const [subscriptionData, setSubscriptionData] = useState<Omit<SubscriptionStatus, 'loading' | 'error'>>({
    subscriptionStatus: 'free',
    subscriptionPlan: 'free',
    hasActiveSubscription: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const syncAttemptedRef = useRef(false);

  const fetchSubscriptionStatus = async (shouldSync: boolean = false) => {
    try {
      // If we should sync, first call the sync endpoint to ensure data is fresh
      if (shouldSync && !syncAttemptedRef.current) {
        syncAttemptedRef.current = true;
        try {
          await fetch('/api/subscription/sync', { method: 'POST' });
          console.log('Subscription synced with Stripe');
        } catch (syncError) {
          console.warn('Sync failed, continuing with cached data:', syncError);
        }
      }

      const res = await fetch('/api/subscription/status');
      if (!res.ok) {
        throw new Error('Failed to fetch subscription status');
      }
      const data = await res.json();
      setSubscriptionData(data);
      setError(undefined);
    } catch (err) {
      console.error('Error fetching subscription status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset sync attempt when session changes
    syncAttemptedRef.current = false;
    
    if (sessionStatus === 'loading') {
      // Keep loading while session is loading
      return;
    }
    
    if (!session?.user) {
      // If we have no session/user, set to free plan and stop loading
      setSubscriptionData({
        subscriptionStatus: 'free',
        subscriptionPlan: 'free',
        hasActiveSubscription: false,
      });
      setLoading(false);
      return;
    }

    // Only fetch subscription data when we have a confirmed authenticated session
    fetchSubscriptionStatus(syncWithStripe);
  }, [session, sessionStatus, syncWithStripe]);

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
