-- Add unique constraint to prevent duplicate chapters for the same book/user
-- This will prevent the duplicate Chapter 0 records we've been seeing

-- First, let's see what duplicates exist
SELECT 
  "bookId", 
  "userId", 
  "chapterNumber",
  COUNT(*) as duplicate_count
FROM "Books" 
GROUP BY "bookId", "userId", "chapterNumber"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Clean up duplicates before adding constraint
-- Keep only the most recent record for each (bookId, userId, chapterNumber) combination
WITH ranked_chapters AS (
  SELECT 
    "id",
    "bookId",
    "userId", 
    "chapterNumber",
    "updatedAt",
    ROW_NUMBER() OVER (
      PARTITION BY "bookId", "userId", "chapterNumber" 
      ORDER BY "updatedAt" DESC, "createdAt" DESC
    ) as rn
  FROM "Books"
),
duplicates_to_delete AS (
  SELECT "id" 
  FROM ranked_chapters 
  WHERE rn > 1
)
DELETE FROM "Books" 
WHERE "id" IN (SELECT "id" FROM duplicates_to_delete);

-- Now add the unique constraint
ALTER TABLE "Books" 
ADD CONSTRAINT "Books_bookId_userId_chapterNumber_unique" 
UNIQUE ("bookId", "userId", "chapterNumber");

-- Verify no duplicates remain
SELECT 
  "bookId", 
  "userId", 
  "chapterNumber",
  COUNT(*) as count
FROM "Books" 
GROUP BY "bookId", "userId", "chapterNumber"
HAVING COUNT(*) > 1;
