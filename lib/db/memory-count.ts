import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { usage } from './schema';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Get the actual count of memories from the database usage tracking
 * This is more efficient than calling the Papr Memory API
 */
export async function getActualMemoryCount(userId: string): Promise<number> {
  try {
    // Get the current month in YYYY-MM format
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Query the usage table for the current month's memory count
    const result = await db
      .select({
        memoriesAdded: usage.memoriesAdded,
      })
      .from(usage)
      .where(
        sql`${usage.userId} = ${userId} AND ${usage.month} = ${currentMonth}`
      )
      .limit(1);
    
    const memoryCount = result.length > 0 ? result[0].memoriesAdded : 0;
    
    console.log(`[Memory Count] Found ${memoryCount} memories for user ${userId} from database`);
    return memoryCount;
  } catch (error) {
    console.error('[Memory Count] Error getting memory count from database:', error);
    return 0;
  }
}

