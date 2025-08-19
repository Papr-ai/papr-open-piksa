import type { SubscriptionPlan } from './types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
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
    stripePriceId: '', // Price ID resolved on server side
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
    stripePriceId: '', // Price ID resolved on server side
  },
];

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
}

export function canUsePremiumModels(planId: string): boolean {
  const plan = getPlanById(planId);
  return plan?.features.premium ?? false;
}

export function getRemainingUsage(planId: string, currentUsage: number, usageType: keyof SubscriptionPlan['features']): number {
  const plan = getPlanById(planId);
  if (!plan) return 0;
  
  const limit = plan.features[usageType];
  if (typeof limit !== 'number') return 0;
  if (limit === -1) return Number.MAX_SAFE_INTEGER; // Unlimited
  
  return Math.max(0, limit - currentUsage);
}
