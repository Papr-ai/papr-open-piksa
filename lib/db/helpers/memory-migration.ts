/**
 * Memory Migration Script
 * 
 * This script migrates existing memory records from the MessageMemory table
 * directly into the message table's memories field.
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { message, messageMemory } from '../schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';

config({
  path: '.env.local',
});

async function main() {
  // Connect to the database
  const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const db = drizzle(sql);

  console.log('Starting memory migration...');
  
  try {
    // Get all memory records
    const memoryRecords = await db.select().from(messageMemory);
    console.log(`Found ${memoryRecords.length} memory records to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each memory record
    for (const memRecord of memoryRecords) {
      try {
        // Update the corresponding message with the memories
        const result = await db
          .update(message)
          .set({
            memories: memRecord.memories,
          })
          .where(eq(message.id, memRecord.messageId));
        
        // Log the result
        console.log(`Updated message ${memRecord.messageId} with ${Array.isArray(memRecord.memories) ? memRecord.memories.length : 0} memories`);
        successCount++;
      } catch (error) {
        console.error(`Error updating message ${memRecord.messageId}:`, error);
        errorCount++;
      }
    }
    
    console.log('Memory migration completed:');
    console.log(`- Successfully migrated: ${successCount}`);
    console.log(`- Failed migrations: ${errorCount}`);
    
    // Optionally, if you want to delete the old records after successful migration:
    // await db.delete(messageMemory);
    // console.log('Deleted old memory records');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close the database connection
    await sql.end();
  }
}

// Run the migration
main().catch(console.error); 