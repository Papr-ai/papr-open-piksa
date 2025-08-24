import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { usage } from './schema';
import { getActualMemoryCount } from './memory-count';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Sync the usage table's memory count with the actual count from Papr Memory API
 * This is useful for fixing discrepancies between tracked and actual memory counts
 */
export async function syncMemoryUsageForUser(userId: string): Promise<void> {
  try {
    const actualMemoryCount = await getActualMemoryCount(userId);
    const month = getCurrentMonth();
    
    console.log(`[Sync] Syncing memory usage for user ${userId}: ${actualMemoryCount} memories`);
    
    // Check if user has a record for this month
    const existingRecord = await db
      .select()
      .from(usage)
      .where(and(
        eq(usage.userId, userId),
        eq(usage.month, month)
      ))
      .limit(1);
    
    if (existingRecord.length > 0) {
      // Update existing record
      await db
        .update(usage)
        .set({
          memoriesAdded: actualMemoryCount,
          updatedAt: new Date(),
        })
        .where(and(
          eq(usage.userId, userId),
          eq(usage.month, month)
        ));
      
      console.log(`[Sync] Updated existing record for user ${userId}`);
    } else {
      // Create new record
      await db
        .insert(usage)
        .values({
          userId,
          month,
          memoriesAdded: actualMemoryCount,
          basicInteractions: 0,
          premiumInteractions: 0,
          memoriesSearched: 0,
        });
      
      console.log(`[Sync] Created new record for user ${userId}`);
    }
  } catch (error) {
    console.error(`[Sync] Error syncing memory usage for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Sync memory usage for all users (admin function)
 */
export async function syncAllUsersMemoryUsage(): Promise<void> {
  try {
    // Get all unique user IDs from usage table
    const allUsers = await db
      .selectDistinct({ userId: usage.userId })
      .from(usage);
    
    console.log(`[Sync] Syncing memory usage for ${allUsers.length} users`);
    
    for (const { userId } of allUsers) {
      await syncMemoryUsageForUser(userId);
    }
    
    console.log('[Sync] Completed syncing memory usage for all users');
  } catch (error) {
    console.error('[Sync] Error syncing memory usage for all users:', error);
    throw error;
  } finally {
    await client.end();
  }
}

