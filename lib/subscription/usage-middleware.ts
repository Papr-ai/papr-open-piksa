import { incrementUsage, checkUsageThresholds } from '@/lib/db/usage-queries';
import { canUsePremiumModels, getRemainingUsage } from './plans';
import { getUserSubscription } from '@/lib/db/subscription-queries';

export interface UsageCheckResult {
  allowed: boolean;
  reason?: string;
  usage?: {
    current: number;
    limit: number;
    percentage: number;
  };
  shouldShowUpgrade?: boolean;
}

export async function checkBasicInteractionLimit(userId: string): Promise<UsageCheckResult> {
  const thresholds = await checkUsageThresholds(userId);
  const { current, limit, percentage } = thresholds.basicInteractions;
  
  // Allow if unlimited (-1) or under limit
  if (limit === -1 || current < limit) {
    return {
      allowed: true,
      usage: { current, limit, percentage },
      shouldShowUpgrade: percentage >= 80 && limit !== -1,
    };
  }
  
  return {
    allowed: false,
    reason: `You've reached your monthly limit of ${limit} basic interactions. Please upgrade your plan to continue.`,
    usage: { current, limit, percentage },
    shouldShowUpgrade: true,
  };
}

export async function checkMemoryAddLimit(userId: string): Promise<UsageCheckResult> {
  const thresholds = await checkUsageThresholds(userId);
  const { current, limit, percentage } = thresholds.memoriesAdded;
  
  if (limit === -1 || current < limit) {
    return {
      allowed: true,
      usage: { current, limit, percentage },
      shouldShowUpgrade: percentage >= 80 && limit !== -1,
    };
  }
  
  return {
    allowed: false,
    reason: `You've reached your storage limit of ${limit} memories. Please upgrade your plan to store more memories.`,
    usage: { current, limit, percentage },
    shouldShowUpgrade: true,
  };
}

export async function checkMemorySearchLimit(userId: string): Promise<UsageCheckResult> {
  const thresholds = await checkUsageThresholds(userId);
  const { current, limit, percentage } = thresholds.memoriesSearched;
  
  if (limit === -1 || current < limit) {
    return {
      allowed: true,
      usage: { current, limit, percentage },
      shouldShowUpgrade: percentage >= 80 && limit !== -1,
    };
  }
  
  return {
    allowed: false,
    reason: `You've reached your monthly limit of ${limit} memory searches. Please upgrade your plan to continue.`,
    usage: { current, limit, percentage },
    shouldShowUpgrade: true,
  };
}

export async function checkPremiumInteractionLimit(userId: string): Promise<UsageCheckResult> {
  const thresholds = await checkUsageThresholds(userId);
  const { current, limit, percentage } = thresholds.premiumInteractions;
  
  if (limit === -1 || current < limit) {
    return {
      allowed: true,
      usage: { current, limit, percentage },
      shouldShowUpgrade: percentage >= 80 && limit !== -1 && limit > 0,
    };
  }
  
  return {
    allowed: false,
    reason: limit === 0 
      ? 'Premium AI models require a subscription. Please upgrade your plan to access advanced reasoning models.'
      : `You've reached your monthly limit of ${limit} premium interactions. Please upgrade your plan to continue.`,
    usage: { current, limit, percentage },
    shouldShowUpgrade: true,
  };
}

export async function trackBasicInteraction(userId: string): Promise<void> {
  await incrementUsage(userId, 'basicInteractions', 1);
}

export async function trackPremiumInteraction(userId: string): Promise<void> {
  await incrementUsage(userId, 'premiumInteractions', 1);
}

export async function trackMemoryAdd(userId: string): Promise<void> {
  await incrementUsage(userId, 'memoriesAdded', 1);
}

export async function trackMemorySearch(userId: string): Promise<void> {
  await incrementUsage(userId, 'memoriesSearched', 1);
}

export async function getUsageWarnings(userId: string): Promise<{
  warnings: Array<{
    type: string;
    message: string;
    percentage: number;
    current: number;
    limit: number;
  }>;
  shouldShowUpgrade: boolean;
}> {
  const thresholds = await checkUsageThresholds(userId);
  const warnings = [];
  
  if (thresholds.basicInteractions.percentage >= 80 && thresholds.basicInteractions.limit !== -1) {
    warnings.push({
      type: 'basicInteractions',
      message: `You've used ${thresholds.basicInteractions.percentage.toFixed(0)}% of your monthly basic interactions`,
      percentage: thresholds.basicInteractions.percentage,
      current: thresholds.basicInteractions.current,
      limit: thresholds.basicInteractions.limit,
    });
  }
  
  if (thresholds.premiumInteractions.percentage >= 80 && thresholds.premiumInteractions.limit !== -1 && thresholds.premiumInteractions.limit > 0) {
    warnings.push({
      type: 'premiumInteractions',
      message: `You've used ${thresholds.premiumInteractions.percentage.toFixed(0)}% of your monthly premium interactions`,
      percentage: thresholds.premiumInteractions.percentage,
      current: thresholds.premiumInteractions.current,
      limit: thresholds.premiumInteractions.limit,
    });
  }
  
  if (thresholds.memoriesAdded.percentage >= 80 && thresholds.memoriesAdded.limit !== -1) {
    warnings.push({
      type: 'memoriesAdded',
      message: `You've used ${thresholds.memoriesAdded.percentage.toFixed(0)}% of your memory storage capacity`,
      percentage: thresholds.memoriesAdded.percentage,
      current: thresholds.memoriesAdded.current,
      limit: thresholds.memoriesAdded.limit,
    });
  }
  
  if (thresholds.memoriesSearched.percentage >= 80 && thresholds.memoriesSearched.limit !== -1) {
    warnings.push({
      type: 'memoriesSearched',
      message: `You've used ${thresholds.memoriesSearched.percentage.toFixed(0)}% of your monthly memory searches`,
      percentage: thresholds.memoriesSearched.percentage,
      current: thresholds.memoriesSearched.current,
      limit: thresholds.memoriesSearched.limit,
    });
  }
  
  return {
    warnings,
    shouldShowUpgrade: warnings.length > 0 && thresholds.plan === 'free',
  };
}
