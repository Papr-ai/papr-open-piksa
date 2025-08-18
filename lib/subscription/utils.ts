import { getUserSubscription } from '@/lib/db/subscription-queries';
import { canUsePremiumModels, getPlanById } from './plans';
import { modelIsPremium } from '@/lib/ai/models';

export async function checkModelAccess(userId: string, modelId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Check if the model requires premium access
  const requiresPremium = modelIsPremium(modelId);
  
  if (!requiresPremium) {
    return { allowed: true };
  }

  // Get user's subscription
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { 
      allowed: false, 
      reason: 'Premium subscription required for reasoning models' 
    };
  }

  // Check if user's plan allows premium models
  const hasAccess = canUsePremiumModels(subscription.subscriptionPlan);
  
  if (!hasAccess) {
    return { 
      allowed: false, 
      reason: 'Premium subscription required for reasoning models' 
    };
  }

  // Check if subscription is active
  const isActive = ['active', 'trialing'].includes(subscription.subscriptionStatus);
  
  if (!isActive) {
    return { 
      allowed: false, 
      reason: 'Active subscription required for reasoning models' 
    };
  }

  return { allowed: true };
}

export async function getAvailableModels(userId: string): Promise<{ modelId: string; available: boolean; reason?: string }[]> {
  const subscription = await getUserSubscription(userId);
  const hasActivePremium = subscription && 
    canUsePremiumModels(subscription.subscriptionPlan) && 
    ['active', 'trialing'].includes(subscription.subscriptionStatus);

  // Import models here to avoid circular dependency
  const { chatModels } = await import('@/lib/ai/models');
  
  return chatModels.map(model => {
    if (!modelIsPremium(model.id)) {
      return { modelId: model.id, available: true };
    }
    
    return {
      modelId: model.id,
      available: Boolean(hasActivePremium),
      reason: hasActivePremium ? undefined : 'Premium subscription required'
    };
  });
}
