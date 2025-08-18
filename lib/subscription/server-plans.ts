import type { SubscriptionPlan } from './types';

// Server-side plans configuration with access to environment variables
export const SERVER_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic AI chat functionality',
    price: 0,
    interval: 'month',
    features: {
      premium: false,
      basicInteractions: 50,
      memoriesAdded: 10,
      memoriesSearched: 20,
    },
    stripePriceId: '', // No Stripe price for free plan
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Enhanced AI capabilities for regular users',
    price: 20,
    interval: 'month',
    features: {
      premium: true,
      basicInteractions: 1000,
      memoriesAdded: 500,
      memoriesSearched: 1000,
    },
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || '',
    isPopular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Unlimited access for power users and teams',
    price: 200,
    interval: 'month',
    features: {
      premium: true,
      basicInteractions: -1, // -1 means unlimited
      memoriesAdded: -1,
      memoriesSearched: -1,
    },
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
];

export function getServerPlanById(planId: string): SubscriptionPlan | undefined {
  return SERVER_SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
}
