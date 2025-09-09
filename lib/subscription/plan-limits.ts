/**
 * Fast plan limits lookup without heavy database operations
 * This replaces the need to import and execute complex plan logic
 */

export interface PlanLimits {
  basicInteractions: number;
  premiumInteractions: number;
  memoriesAdded: number;
  memoriesSearched: number;
  voiceChats: number;
  videosGenerated: number;
}

export interface PlanFeatures extends PlanLimits {
  name: string;
  description: string;
  canAccessPremiumModels: boolean;
  canUseWebSearch: boolean;
  canUseVoiceChat: boolean;
  canGenerateVideos: boolean;
}

// Cached plan limits for instant lookup (no DB queries needed)
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    basicInteractions: 50,
    premiumInteractions: 0,
    memoriesAdded: 100,
    memoriesSearched: 20,
    voiceChats: 5,
    videosGenerated: 2,
  },
  basic: {
    basicInteractions: 1000,
    premiumInteractions: 200,
    memoriesAdded: 5000,
    memoriesSearched: 1000,
    voiceChats: 100,
    videosGenerated: 50,
  },
  pro: {
    basicInteractions: -1, // unlimited
    premiumInteractions: 500,
    memoriesAdded: 10000,
    memoriesSearched: 2000,
    voiceChats: 500,
    videosGenerated: 50,
  },
  enterprise: {
    basicInteractions: -1,
    premiumInteractions: -1,
    memoriesAdded: -1,
    memoriesSearched: -1,
    voiceChats: -1,
    videosGenerated: -1,
  }
};

// Full plan features for UI display
export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  free: {
    name: 'Free',
    description: 'Perfect for getting started',
    canAccessPremiumModels: false,
    canUseWebSearch: true,
    canUseVoiceChat: true,
    canGenerateVideos: true,
    ...PLAN_LIMITS.free,
  },
  basic: {
    name: 'Starter',
    description: 'Great for regular users',
    canAccessPremiumModels: true,
    canUseWebSearch: true,
    canUseVoiceChat: true,
    canGenerateVideos: true,
    ...PLAN_LIMITS.basic,
  },
  pro: {
    name: 'Pro',
    description: 'Best for power users',
    canAccessPremiumModels: true,
    canUseWebSearch: true,
    canUseVoiceChat: true,
    canGenerateVideos: true,
    ...PLAN_LIMITS.pro,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Unlimited everything',
    canAccessPremiumModels: true,
    canUseWebSearch: true,
    canUseVoiceChat: true,
    canGenerateVideos: true,
    ...PLAN_LIMITS.enterprise,
  },
};

/**
 * Get plan limits instantly (no DB query)
 */
export function getPlanLimits(planName: string): PlanLimits {
  return PLAN_LIMITS[planName] || PLAN_LIMITS.free;
}

/**
 * Get full plan features instantly (no DB query)
 */
export function getPlanFeatures(planName: string): PlanFeatures {
  return PLAN_FEATURES[planName] || PLAN_FEATURES.free;
}

/**
 * Check if a plan can access premium models
 */
export function canUsePremiumModels(planName: string): boolean {
  const features = getPlanFeatures(planName);
  return features.canAccessPremiumModels;
}

/**
 * Check if usage is at or over limit
 */
export function isOverLimit(current: number, limit: number): boolean {
  if (limit === -1) return false; // unlimited
  return current >= limit;
}

/**
 * Check if usage is approaching limit (80% threshold)
 */
export function isApproachingLimit(current: number, limit: number): boolean {
  if (limit === -1) return false; // unlimited
  return (current / limit) >= 0.8;
}

/**
 * Calculate usage percentage
 */
export function calculateUsagePercentage(current: number, limit: number): number {
  if (limit === -1) return 0; // unlimited
  return Math.min((current / limit) * 100, 100);
}

/**
 * Get remaining usage
 */
export function getRemainingUsage(current: number, limit: number): number {
  if (limit === -1) return -1; // unlimited
  return Math.max(0, limit - current);
}

/**
 * Format usage for display
 */
export function formatUsageDisplay(current: number, limit: number): string {
  if (limit === -1) return `${current.toLocaleString()} / Unlimited`;
  return `${current.toLocaleString()} / ${limit.toLocaleString()}`;
}

/**
 * Get appropriate upgrade message for a specific usage type
 */
export function getUpgradeMessage(usageType: keyof PlanLimits, planName: string): string {
  const isFreePlan = planName === 'free';
  
  const messages = {
    basicInteractions: isFreePlan 
      ? 'Upgrade to get more basic interactions and access to premium models'
      : 'Upgrade to get unlimited basic interactions',
    premiumInteractions: isFreePlan
      ? 'Upgrade to access premium AI models with advanced reasoning'
      : 'Upgrade to get more premium interactions',
    memoriesAdded: isFreePlan
      ? 'Upgrade to store more memories and build a larger knowledge base'
      : 'Upgrade to store even more memories',
    memoriesSearched: isFreePlan
      ? 'Upgrade to search your memories more frequently'
      : 'Upgrade to get unlimited memory searches',
    voiceChats: isFreePlan
      ? 'Upgrade to have more voice conversations with AI'
      : 'Upgrade to get unlimited voice chats',
    videosGenerated: isFreePlan
      ? 'Upgrade to generate more videos with Gemini Veo'
      : 'Upgrade to generate unlimited videos',
  };
  
  return messages[usageType] || 'Upgrade for more features and higher limits';
}

/**
 * Check if user should see upgrade prompt based on usage
 */
export function shouldShowUpgradePrompt(
  usage: Record<keyof PlanLimits, number>,
  planName: string
): boolean {
  const limits = getPlanLimits(planName);
  
  // Only show upgrade prompts for non-enterprise plans
  if (planName === 'enterprise') return false;
  
  // Check if any usage type is at or approaching limit
  for (const [key, current] of Object.entries(usage)) {
    const limit = limits[key as keyof PlanLimits];
    if (isOverLimit(current, limit) || isApproachingLimit(current, limit)) {
      return true;
    }
  }
  
  return false;
}
