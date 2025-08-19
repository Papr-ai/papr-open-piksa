import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { usage, user } from './schema';
import type { Usage } from './schema';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getUserUsage(userId: string, month?: string): Promise<Usage | null> {
  const targetMonth = month || getCurrentMonth();
  
  const result = await db
    .select()
    .from(usage)
    .where(and(
      eq(usage.userId, userId),
      eq(usage.month, targetMonth)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function incrementUsage(
  userId: string,
  type: 'basicInteractions' | 'premiumInteractions' | 'memoriesAdded' | 'memoriesSearched',
  amount: number = 1
): Promise<Usage> {
  const month = getCurrentMonth();
  
  // For memoriesAdded, we need to check total across all time, not just this month
  if (type === 'memoriesAdded') {
    return await incrementTotalMemories(userId, amount);
  }
  
  // For other types, continue with monthly tracking
  const existing = await getUserUsage(userId, month);
  
  if (existing) {
    const updatedUsage = await db
      .update(usage)
      .set({
        [type]: existing[type] + amount,
        updatedAt: new Date(),
      })
      .where(and(
        eq(usage.userId, userId),
        eq(usage.month, month)
      ))
      .returning();
    
    return updatedUsage[0];
  } else {
    // Create new record
    const newUsage = await db
      .insert(usage)
      .values({
        userId,
        month,
        [type]: amount,
      })
      .returning();
    
    return newUsage[0];
  }
}

async function incrementTotalMemories(userId: string, amount: number): Promise<Usage> {
  const month = getCurrentMonth();
  
  // Get current month's record (for returning consistent format)
  let currentRecord = await getUserUsage(userId, month);
  
  if (!currentRecord) {
    // Create current month record if it doesn't exist
    const newRecord = await db
      .insert(usage)
      .values({
        userId,
        month,
        memoriesAdded: 0, // Will be updated below
      })
      .returning();
    currentRecord = newRecord[0];
  }
  
  // Get total memories across all time for this user
  const allRecords = await db
    .select()
    .from(usage)
    .where(eq(usage.userId, userId));
  
  const totalMemories = allRecords.reduce((sum, record) => sum + record.memoriesAdded, 0);
  
  // Update current month's record to reflect the new total
  const updatedUsage = await db
    .update(usage)
    .set({
      memoriesAdded: totalMemories + amount,
      updatedAt: new Date(),
    })
    .where(and(
      eq(usage.userId, userId),
      eq(usage.month, month)
    ))
    .returning();
  
  return updatedUsage[0];
}

export async function getTotalMemoriesForUser(userId: string): Promise<number> {
  const allRecords = await db
    .select()
    .from(usage)
    .where(eq(usage.userId, userId));
  
  return allRecords.reduce((sum, record) => sum + record.memoriesAdded, 0);
}

export async function checkUsageThresholds(userId: string): Promise<{
  basicInteractions: { current: number; limit: number; percentage: number };
  premiumInteractions: { current: number; limit: number; percentage: number };
  memoriesAdded: { current: number; limit: number; percentage: number };
  memoriesSearched: { current: number; limit: number; percentage: number };
  plan: string;
  shouldNotify: boolean;
}> {
  // Get user's current usage and subscription
  const [userUsage, userSubscription, totalMemories] = await Promise.all([
    getUserUsage(userId),
    // Import getUserSubscription here to avoid circular dependency
    (async () => {
      const { getUserSubscription } = await import('./subscription-queries');
      return getUserSubscription(userId);
    })(),
    // Get total memories across all time
    getTotalMemoriesForUser(userId)
  ]);
  
  // Get plan limits
  const { getPlanById } = await import('../subscription/plans');
  const plan = getPlanById(userSubscription?.subscriptionPlan || 'free');
  
  const currentUsage = {
    basicInteractions: userUsage?.basicInteractions || 0,
    premiumInteractions: userUsage?.premiumInteractions || 0,
    memoriesAdded: totalMemories, // Use total memories instead of monthly
    memoriesSearched: userUsage?.memoriesSearched || 0,
  };
  
  const limits = plan?.features || {
    basicInteractions: 50,
    premiumInteractions: 0, // Free plan has no premium interactions
    memoriesAdded: 100, // Total memories stored (cumulative)
    memoriesSearched: 20,
  };
  
  const calculatePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };
  
  const basicInteractionsPercentage = calculatePercentage(
    currentUsage.basicInteractions,
    limits.basicInteractions
  );
  const premiumInteractionsPercentage = calculatePercentage(
    currentUsage.premiumInteractions,
    limits.premiumInteractions ?? 0
  );
  const memoriesAddedPercentage = calculatePercentage(
    currentUsage.memoriesAdded,
    limits.memoriesAdded
  );
  const memoriesSearchedPercentage = calculatePercentage(
    currentUsage.memoriesSearched,
    limits.memoriesSearched
  );
  
  // Notify if any usage is above 80% or 100%
  const shouldNotify = [
    basicInteractionsPercentage,
    premiumInteractionsPercentage,
    memoriesAddedPercentage,
    memoriesSearchedPercentage
  ].some(percentage => percentage >= 80);
  
  return {
    basicInteractions: {
      current: currentUsage.basicInteractions,
      limit: limits.basicInteractions,
      percentage: basicInteractionsPercentage,
    },
    premiumInteractions: {
      current: currentUsage.premiumInteractions,
      limit: limits.premiumInteractions ?? 0,
      percentage: premiumInteractionsPercentage,
    },
    memoriesAdded: {
      current: currentUsage.memoriesAdded,
      limit: limits.memoriesAdded,
      percentage: memoriesAddedPercentage,
    },
    memoriesSearched: {
      current: currentUsage.memoriesSearched,
      limit: limits.memoriesSearched,
      percentage: memoriesSearchedPercentage,
    },
    plan: userSubscription?.subscriptionPlan || 'free',
    shouldNotify,
  };
}
