#!/usr/bin/env tsx

/**
 * CRITICAL: Cleanup duplicate Chapter 0 records
 * 
 * This script removes duplicate Chapter 0 (workflow metadata) records,
 * keeping only the most recent one for each bookId/userId combination.
 */

import { db } from '../lib/db/db';
import { Book } from '../lib/db/schema';
import { sql, and, eq, desc } from 'drizzle-orm';

async function cleanupDuplicateChapters() {
  console.log('🧹 Starting cleanup of duplicate Chapter 0 records...');

  try {
    // First, let's see the extent of the problem
    const duplicateAnalysis = await db.execute(sql`
      SELECT 
        "bookId", 
        "userId", 
        "chapterNumber",
        COUNT(*) as duplicate_count,
        MAX("createdAt") as latest_created,
        MIN("createdAt") as first_created
      FROM "Books" 
      WHERE "chapterNumber" = 0
      GROUP BY "bookId", "userId", "chapterNumber"
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `);

    console.log(`📊 Found ${duplicateAnalysis.length} books with duplicate Chapter 0 records:`);
    duplicateAnalysis.forEach((row: any) => {
      console.log(`  - Book ${row.bookId}: ${row.duplicate_count} duplicates (${row.first_created} → ${row.latest_created})`);
    });

    if (duplicateAnalysis.length === 0) {
      console.log('✅ No duplicate Chapter 0 records found!');
      return;
    }

    // For each book with duplicates, keep only the most recent record
    for (const row of duplicateAnalysis) {
      const bookId = row.bookId as string;
      const userId = row.userId as string;
      const duplicateCount = row.duplicate_count as number;

      console.log(`\n🔧 Cleaning up ${duplicateCount} duplicates for book ${bookId}...`);

      // Get all records for this book/user/chapter combination, ordered by creation date
      const allRecords = await db
        .select({
          id: Book.id,
          createdAt: Book.createdAt,
          updatedAt: Book.updatedAt,
          content: Book.content
        })
        .from(Book)
        .where(
          and(
            eq(Book.bookId, bookId),
            eq(Book.userId, userId),
            eq(Book.chapterNumber, 0)
          )
        )
        .orderBy(desc(Book.updatedAt), desc(Book.createdAt));

      if (allRecords.length <= 1) {
        console.log(`  ✅ No duplicates found for book ${bookId} (${allRecords.length} records)`);
        continue;
      }

      // Keep the most recent record (first in the ordered list)
      const recordsToKeep = allRecords.slice(0, 1);
      const recordsToDelete = allRecords.slice(1);

      console.log(`  📝 Keeping record: ${recordsToKeep[0].id} (updated: ${recordsToKeep[0].updatedAt})`);
      console.log(`  🗑️  Deleting ${recordsToDelete.length} old records...`);

      // Delete the old duplicate records
      for (const record of recordsToDelete) {
        await db
          .delete(Book)
          .where(eq(Book.id, record.id));
        
        console.log(`    ❌ Deleted record: ${record.id} (updated: ${record.updatedAt})`);
      }

      console.log(`  ✅ Cleaned up book ${bookId}: kept 1, deleted ${recordsToDelete.length}`);
    }

    // Verify the cleanup
    const remainingDuplicates = await db.execute(sql`
      SELECT 
        "bookId", 
        "userId", 
        COUNT(*) as count
      FROM "Books" 
      WHERE "chapterNumber" = 0
      GROUP BY "bookId", "userId"
      HAVING COUNT(*) > 1
    `);

    if (remainingDuplicates.length === 0) {
      console.log('\n🎉 SUCCESS: All duplicate Chapter 0 records have been cleaned up!');
    } else {
      console.log(`\n⚠️  WARNING: ${remainingDuplicates.length} books still have duplicates. Manual review needed.`);
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupDuplicateChapters()
  .then(() => {
    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  });
