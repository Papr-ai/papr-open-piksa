-- Migration: Unify BookTask table to support both workflow and general tasks
-- This migration extends the existing BookTask table to handle general task tracking

-- Add new columns for unified task system
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "taskType" VARCHAR(50) DEFAULT 'workflow';
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "sessionId" VARCHAR(255);
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "parentTaskId" UUID;
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "dependencies" JSONB DEFAULT '[]';
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "estimatedDuration" VARCHAR(50);
ALTER TABLE "BookTask" ADD COLUMN IF NOT EXISTS "actualDuration" VARCHAR(50);

-- Make workflow-specific columns nullable for general tasks
ALTER TABLE "BookTask" ALTER COLUMN "bookId" DROP NOT NULL;
ALTER TABLE "BookTask" ALTER COLUMN "bookTitle" DROP NOT NULL;
ALTER TABLE "BookTask" ALTER COLUMN "stepNumber" DROP NOT NULL;
ALTER TABLE "BookTask" ALTER COLUMN "stepName" DROP NOT NULL;

-- Update existing workflow tasks to have proper titles
UPDATE "BookTask" SET "title" = "stepName" WHERE "title" IS NULL AND "stepName" IS NOT NULL;
UPDATE "BookTask" SET "taskType" = 'workflow' WHERE "taskType" IS NULL;

-- Add foreign key constraint for parent task relationship
ALTER TABLE "BookTask" ADD CONSTRAINT "BookTask_parentTaskId_fkey" 
  FOREIGN KEY ("parentTaskId") REFERENCES "BookTask"("id") ON DELETE SET NULL;

-- Add unique constraint for general tasks (sessionId + title)
-- Note: This will be handled by the schema, but we can add it here for safety
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'BookTask_sessionId_title_unique'
    ) THEN
        ALTER TABLE "BookTask" ADD CONSTRAINT "BookTask_sessionId_title_unique" 
        UNIQUE ("sessionId", "title");
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "BookTask_sessionId_idx" ON "BookTask"("sessionId");
CREATE INDEX IF NOT EXISTS "BookTask_taskType_idx" ON "BookTask"("taskType");
CREATE INDEX IF NOT EXISTS "BookTask_userId_taskType_idx" ON "BookTask"("userId", "taskType");
CREATE INDEX IF NOT EXISTS "BookTask_parentTaskId_idx" ON "BookTask"("parentTaskId");
