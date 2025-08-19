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
      premiumInteractions: 0, // No premium interactions on free plan
      memoriesAdded: 100, // Total memories stored (cumulative)
      memoriesSearched: 20,
    },
    stripePriceId: '', // No Stripe price for free plan
  },
  {
    id: 'basic',
    name: 'Starter',
    description: 'Enhanced AI capabilities for regular users',
    price: 20,
    interval: 'month',
    features: {
      premium: true,
      basicInteractions: 1000,
      premiumInteractions: 200, // Limited premium interactions
      memoriesAdded: 5000, // Total memories stored (cumulative)
      memoriesSearched: 1000,
    },
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || '',
    isPopular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'High-volume access for power users and teams',
    price: 200,
    interval: 'month',
    features: {
      premium: true,
      basicInteractions: -1, // Unlimited basic interactions
      premiumInteractions: 3000, // 3000 premium interactions per month
      memoriesAdded: 100000, // 100K total memories stored (cumulative)
      memoriesSearched: 50000, // 50K memory searches per month
    },
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
];

export function getServerPlanById(planId: string): SubscriptionPlan | undefined {
  return SERVER_SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
}
