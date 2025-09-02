export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: {
    premium: boolean;
    basicInteractions: number;
    premiumInteractions: number; // -1 for unlimited, 0 for none
    memoriesAdded: number;
    memoriesSearched: number;
    voiceChats: number; // Monthly limit for voice chat sessions, -1 for unlimited
    videosGenerated: number; // Monthly limit for video generation, -1 for unlimited
  };
  stripePriceId: string;
  isPopular?: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'free' | 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  subscriptionPlan: string;
  subscriptionId?: string;
  subscriptionCurrentPeriodEnd?: Date;
  subscriptionCreatedAt?: Date;
  subscriptionUpdatedAt?: Date;
}

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
