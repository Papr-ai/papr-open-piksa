import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { usage, user, subscription } from '@/lib/db/schema';
import { auth } from '@/app/(auth)/auth';
import { modelIsPremium } from '@/lib/ai/models';
import { getPlanLimits } from '@/lib/subscription/plan-limits';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export interface FastUsageCheckResult {
  allowed: boolean;
  reason?: string;
  usage?: {
    current: number;
    limit: number;
    percentage: number;
  };
  shouldShowUpgrade?: boolean;
}

export interface FastPermissionCheckResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  usage?: any;
  shouldShowUpgrade?: boolean;
}

// Get current month string
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Plan limits are now imported from plan-limits.ts

// Fast combined user data query - gets all needed data in one DB call
async function getUserDataFast(userId: string): Promise<{
  user: any;
  subscription: any;
  usage: any;
  plan: string;
}> {
  const currentMonth = getCurrentMonth();
  
  // Single query with JOINs to get all needed data
  const result = await db
    .select({
      // User data
      userId: user.id,
      userEmail: user.email,
      userOnboardingCompleted: user.onboardingCompleted,
      
      // Subscription data
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: subscription.plan,
      subscriptionCurrentPeriodEnd: subscription.currentPeriodEnd,
      
      // Usage data
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
    throw new Error('User not found');
  }

  const data = result[0];
  const plan = data.subscriptionPlan || 'free';

  // Plan detection: use subscription plan from DB, fallback to free

  return {
    user: {
      id: data.userId,
      email: data.userEmail,
      onboardingCompleted: data.userOnboardingCompleted,
    },
    subscription: data.subscriptionId ? {
      id: data.subscriptionId,
      status: data.subscriptionStatus,
      plan: data.subscriptionPlan,
      currentPeriodEnd: data.subscriptionCurrentPeriodEnd,
    } : null,
    usage: {
      basicInteractions: data.usageBasicInteractions || 0,
      premiumInteractions: data.usagePremiumInteractions || 0,
      memoriesAdded: data.usageMemoriesAdded || 0,
      memoriesSearched: data.usageMemoriesSearched || 0,
      voiceChats: data.usageVoiceChats || 0,
      videosGenerated: data.usageVideosGenerated || 0,
    },
    plan,
  };
}

// Fast onboarding check
export async function fastCheckOnboarding(userId: string): Promise<boolean> {
  try {
    const userData = await getUserDataFast(userId);
    return userData.user.onboardingCompleted === true;
  } catch {
    return false;
  }
}

// Fast model access check
export async function fastCheckModelAccess(userId: string, modelName: string): Promise<FastPermissionCheckResult> {
  try {
    const userData = await getUserDataFast(userId);
    const isPremiumModel = modelIsPremium(modelName);
    
    // Free users can't access premium models
    if (isPremiumModel && userData.plan === 'free') {
      return {
        allowed: false,
        reason: 'Premium models require a subscription. Please upgrade your plan.',
        code: 'MODEL_ACCESS_DENIED',
        shouldShowUpgrade: true,
      };
    }
    
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: 'Unable to verify model access',
      code: 'MODEL_ACCESS_ERROR',
    };
  }
}

// Fast usage check helper
function checkUsageLimit(
  current: number, 
  limit: number, 
  type: string,
  planName: string
): FastUsageCheckResult {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);
  
  if (limit === -1 || current < limit) {
    return {
      allowed: true,
      usage: { current, limit, percentage },
      shouldShowUpgrade: percentage >= 80 && limit !== -1 && planName === 'free',
    };
  }
  
  const upgradeMessage = limit === 0 
    ? `${type} requires a subscription. Please upgrade your plan.`
    : `You've reached your monthly limit of ${limit} ${type.toLowerCase()}. Please upgrade to continue.`;
    
  return {
    allowed: false,
    reason: upgradeMessage,
    usage: { current, limit, percentage },
    shouldShowUpgrade: true,
  };
}

// Fast basic interaction limit check
export async function fastCheckBasicInteractionLimit(userId: string): Promise<FastPermissionCheckResult> {
  try {
    const userData = await getUserDataFast(userId);
    const limits = getPlanLimits(userData.plan);
    const result = checkUsageLimit(
      userData.usage.basicInteractions,
      limits.basicInteractions,
      'Basic interactions',
      userData.plan
    );
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      code: result.allowed ? undefined : 'USAGE_LIMIT_EXCEEDED',
      usage: result.usage,
      shouldShowUpgrade: result.shouldShowUpgrade,
    };
  } catch (error) {
    console.error('[Fast Middleware] Basic interaction check failed:', error);
    return {
      allowed: false,
      reason: 'Unable to verify usage limits',
      code: 'USAGE_CHECK_ERROR',
    };
  }
}

// Fast premium interaction limit check
export async function fastCheckPremiumInteractionLimit(userId: string): Promise<FastPermissionCheckResult> {
  try {
    const userData = await getUserDataFast(userId);
    const limits = getPlanLimits(userData.plan);
    const result = checkUsageLimit(
      userData.usage.premiumInteractions,
      limits.premiumInteractions,
      'Premium interactions',
      userData.plan
    );
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      code: result.allowed ? undefined : 'USAGE_LIMIT_EXCEEDED',
      usage: result.usage,
      shouldShowUpgrade: result.shouldShowUpgrade,
    };
  } catch (error) {
    console.error('[Fast Middleware] Premium interaction check failed:', error);
    return {
      allowed: false,
      reason: 'Unable to verify usage limits',
      code: 'USAGE_CHECK_ERROR',
    };
  }
}

// Fast memory search limit check
export async function fastCheckMemorySearchLimit(userId: string): Promise<FastPermissionCheckResult> {
  try {
    const userData = await getUserDataFast(userId);
    const limits = getPlanLimits(userData.plan);
    const result = checkUsageLimit(
      userData.usage.memoriesSearched,
      limits.memoriesSearched,
      'Memory searches',
      userData.plan
    );
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      code: result.allowed ? undefined : 'USAGE_LIMIT_EXCEEDED',
      usage: result.usage,
      shouldShowUpgrade: result.shouldShowUpgrade,
    };
  } catch (error) {
    console.warn('[Fast Middleware] Memory search check failed, allowing search to proceed:', error);
    // Don't block memory searches if usage check fails
    return { allowed: true };
  }
}

// Combined permission check for chat (replaces multiple sequential checks)
export async function fastCheckChatPermissions(userId: string, modelName: string): Promise<{
  allowed: boolean;
  reason?: string;
  code?: string;
  usage?: any;
  shouldShowUpgrade?: boolean;
  onboardingCompleted?: boolean;
}> {
  try {
    // Single database query gets all needed data
    const userData = await getUserDataFast(userId);
    
    // Check onboarding
    if (!userData.user.onboardingCompleted) {
      return {
        allowed: false,
        reason: 'Onboarding not completed',
        code: 'ONBOARDING_REQUIRED',
        onboardingCompleted: false,
      };
    }
    
    const isPremiumModel = modelIsPremium(modelName);
    const limits = getPlanLimits(userData.plan);
    
    // Plan detection complete - using limits for plan: ${userData.plan}
    
    // Safety check - if limits is undefined, something went wrong with plan detection
    if (!limits) {
      console.error('[Fast Middleware] Failed to get plan limits for plan:', userData.plan);
      return {
        allowed: false,
        reason: 'Unable to determine subscription limits. Please try refreshing the page.',
        code: 'PLAN_DETECTION_ERROR',
      };
    }
    
    // Check model access
    if (isPremiumModel && userData.plan === 'free') {
      return {
        allowed: false,
        reason: 'Premium models require a subscription. Please upgrade your plan.',
        code: 'MODEL_ACCESS_DENIED',
        shouldShowUpgrade: true,
      };
    }
    
    // Check usage limits
    const usageType = isPremiumModel ? 'premiumInteractions' : 'basicInteractions';
    const usageLimit = isPremiumModel ? limits.premiumInteractions : limits.basicInteractions;
    const currentUsage = isPremiumModel ? userData.usage.premiumInteractions : userData.usage.basicInteractions;
    
    const usageResult = checkUsageLimit(
      currentUsage,
      usageLimit,
      isPremiumModel ? 'Premium interactions' : 'Basic interactions',
      userData.plan
    );
    
    return {
      allowed: usageResult.allowed,
      reason: usageResult.reason,
      code: usageResult.allowed ? undefined : 'USAGE_LIMIT_EXCEEDED',
      usage: usageResult.usage,
      shouldShowUpgrade: usageResult.shouldShowUpgrade,
      onboardingCompleted: true,
    };
    
  } catch (error) {
    console.error('[Fast Middleware] Combined permission check failed:', error);
    return {
      allowed: false,
      reason: 'Unable to verify permissions',
      code: 'PERMISSION_CHECK_ERROR',
    };
  }
}

// Non-blocking usage tracking
export async function trackInteractionAsync(userId: string, type: 'basic' | 'premium'): Promise<void> {
  // Don't await - let this run in background
  setImmediate(async () => {
    try {
      const currentMonth = getCurrentMonth();
      const field = type === 'premium' ? 'premiumInteractions' : 'basicInteractions';
      
      // Get current usage first
      const currentUsage = await db
        .select()
        .from(usage)
        .where(and(
          eq(usage.userId, userId),
          eq(usage.month, currentMonth)
        ))
        .limit(1);

      if (currentUsage.length > 0) {
        // Update existing record
        const currentValue = currentUsage[0][field as keyof typeof currentUsage[0]] as number || 0;
        await db
          .update(usage)
          .set({
            [field]: currentValue + 1,
            updatedAt: new Date(),
          })
          .where(and(
            eq(usage.userId, userId),
            eq(usage.month, currentMonth)
          ));
      } else {
        // Create new record
        await db
          .insert(usage)
          .values({
            userId,
            month: currentMonth,
            [field]: 1,
          });
      }
      
      console.log(`[Fast Middleware] Tracked ${type} interaction for user:`, userId);
    } catch (error) {
      console.error(`[Fast Middleware] Error tracking ${type} interaction:`, error);
    }
  });
}

// Non-blocking memory usage tracking
export async function trackMemorySearchAsync(userId: string): Promise<void> {
  setImmediate(async () => {
    try {
      const currentMonth = getCurrentMonth();
      
      // Get current usage first
      const currentUsage = await db
        .select()
        .from(usage)
        .where(and(
          eq(usage.userId, userId),
          eq(usage.month, currentMonth)
        ))
        .limit(1);

      if (currentUsage.length > 0) {
        // Update existing record
        const currentValue = currentUsage[0].memoriesSearched || 0;
        await db
          .update(usage)
          .set({
            memoriesSearched: currentValue + 1,
            updatedAt: new Date(),
          })
          .where(and(
            eq(usage.userId, userId),
            eq(usage.month, currentMonth)
          ));
      } else {
        // Create new record
        await db
          .insert(usage)
          .values({
            userId,
            month: currentMonth,
            memoriesSearched: 1,
          });
      }
      
      console.log('[Fast Middleware] Tracked memory search for user:', userId);
    } catch (error) {
      console.error('[Fast Middleware] Error tracking memory search:', error);
    }
  });
}
