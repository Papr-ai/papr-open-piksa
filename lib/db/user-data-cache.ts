import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user, subscription, usage } from './schema';
import { getPlanLimits } from '@/lib/subscription/plan-limits';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export interface CombinedUserData {
  user: {
    id: string;
    email: string;
    onboardingCompleted: boolean;
    stripeCustomerId?: string;
  };
  subscription: {
    id: string;
    status: string;
    plan: string;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
  } | null;
  usage: {
    basicInteractions: number;
    premiumInteractions: number;
    memoriesAdded: number;
    memoriesSearched: number;
    voiceChats: number;
    videosGenerated: number;
  };
  planLimits: {
    basicInteractions: number;
    premiumInteractions: number;
    memoriesAdded: number;
    memoriesSearched: number;
    voiceChats: number;
    videosGenerated: number;
  };
}

// Plan limits are imported from plan-limits.ts

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get all user data (user, subscription, usage) in a single optimized query
 * This replaces multiple separate database calls with one efficient JOIN query
 */
export async function getCombinedUserData(userId: string): Promise<CombinedUserData> {
  const currentMonth = getCurrentMonth();
  
  // Single query with JOINs to get all needed data
  const result = await db
    .select({
      // User fields
      userId: user.id,
      userEmail: user.email,
      userOnboardingCompleted: user.onboardingCompleted,
      userStripeCustomerId: user.stripeCustomerId,
      
      // Subscription fields
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: subscription.plan,
      subscriptionCurrentPeriodEnd: subscription.currentPeriodEnd,
      subscriptionCancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      
      // Usage fields
      usageBasicInteractions: usage.basicInteractions,
      usagePremiumInteractions: usage.premiumInteractions,
      usageMemoriesAdded: usage.memoriesAdded,
      usageMemoriesSearched: usage.memoriesSearched,
      usageVoiceChats: usage.voiceChats,
      usageVideosGenerated: usage.videosGenerated,
    })
    .from(user)
    .leftJoin(subscription, eq(user.id, subscription.userId))
    .leftJoin(usage, and(
      eq(user.id, usage.userId),
      eq(usage.month, currentMonth)
    ))
    .where(eq(user.id, userId))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }

  const data = result[0];
  const plan = data.subscriptionPlan || 'free';

  return {
    user: {
      id: data.userId,
      email: data.userEmail,
      onboardingCompleted: data.userOnboardingCompleted || false,
      stripeCustomerId: data.userStripeCustomerId || undefined,
    },
    subscription: data.subscriptionId ? {
      id: data.subscriptionId,
      status: data.subscriptionStatus || 'free',
      plan: data.subscriptionPlan || 'free',
      currentPeriodEnd: data.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: data.subscriptionCancelAtPeriodEnd,
    } : null,
    usage: {
      basicInteractions: data.usageBasicInteractions || 0,
      premiumInteractions: data.usagePremiumInteractions || 0,
      memoriesAdded: data.usageMemoriesAdded || 0,
      memoriesSearched: data.usageMemoriesSearched || 0,
      voiceChats: data.usageVoiceChats || 0,
      videosGenerated: data.usageVideosGenerated || 0,
    },
    planLimits: getPlanLimits(plan),
  };
}

/**
 * Get user data with subscription status only (lighter query for status checks)
 */
export async function getUserSubscriptionData(userId: string): Promise<{
  user: { id: string; email: string; onboardingCompleted: boolean };
  subscription: { status: string; plan: string } | null;
}> {
  const result = await db
    .select({
      userId: user.id,
      userEmail: user.email,
      userOnboardingCompleted: user.onboardingCompleted,
      subscriptionStatus: subscription.status,
      subscriptionPlan: subscription.plan,
    })
    .from(user)
    .leftJoin(subscription, eq(user.id, subscription.userId))
    .where(eq(user.id, userId))
    .limit(1);

  if (result.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }

  const data = result[0];

  return {
    user: {
      id: data.userId,
      email: data.userEmail,
      onboardingCompleted: data.userOnboardingCompleted || false,
    },
    subscription: data.subscriptionStatus ? {
      status: data.subscriptionStatus,
      plan: data.subscriptionPlan || 'free',
    } : null,
  };
}

/**
 * Get current usage data for a user (current month only)
 */
export async function getCurrentUsageData(userId: string): Promise<{
  basicInteractions: number;
  premiumInteractions: number;
  memoriesAdded: number;
  memoriesSearched: number;
  voiceChats: number;
  videosGenerated: number;
}> {
  const currentMonth = getCurrentMonth();
  
  const result = await db
    .select()
    .from(usage)
    .where(and(
      eq(usage.userId, userId),
      eq(usage.month, currentMonth)
    ))
    .limit(1);

  if (result.length === 0) {
    return {
      basicInteractions: 0,
      premiumInteractions: 0,
      memoriesAdded: 0,
      memoriesSearched: 0,
      voiceChats: 0,
      videosGenerated: 0,
    };
  }

  const data = result[0];
  return {
    basicInteractions: data.basicInteractions,
    premiumInteractions: data.premiumInteractions,
    memoriesAdded: data.memoriesAdded,
    memoriesSearched: data.memoriesSearched,
    voiceChats: data.voiceChats,
    videosGenerated: data.videosGenerated,
  };
}

/**
 * Calculate usage percentages for a user
 */
export function calculateUsagePercentages(
  usage: CombinedUserData['usage'], 
  limits: CombinedUserData['planLimits']
) {
  // Safety check - if limits is undefined, return 0 percentages
  if (!limits) {
    console.error('[User Data Cache] Plan limits undefined in calculateUsagePercentages');
    return {
      basicInteractions: 0,
      premiumInteractions: 0,
      memoriesAdded: 0,
      memoriesSearched: 0,
      voiceChats: 0,
      videosGenerated: 0,
    };
  }

  const calculatePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  return {
    basicInteractions: calculatePercentage(usage.basicInteractions, limits.basicInteractions),
    premiumInteractions: calculatePercentage(usage.premiumInteractions, limits.premiumInteractions),
    memoriesAdded: calculatePercentage(usage.memoriesAdded, limits.memoriesAdded),
    memoriesSearched: calculatePercentage(usage.memoriesSearched, limits.memoriesSearched),
    voiceChats: calculatePercentage(usage.voiceChats, limits.voiceChats),
    videosGenerated: calculatePercentage(usage.videosGenerated, limits.videosGenerated),
  };
}

/**
 * Check if user should see upgrade prompts based on usage
 */
export function shouldShowUpgrade(
  plan: string,
  percentages: ReturnType<typeof calculateUsagePercentages>
): boolean {
  if (plan !== 'free') return false;
  
  return Object.values(percentages).some(percentage => percentage >= 80);
}
