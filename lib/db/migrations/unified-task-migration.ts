import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({
  path: '.env.local',
});

// Unified Task System Migration
// Renames BookTask table to Tasks and adds new columns for general task support
// Run this script using: npx tsx lib/db/migrations/unified-task-migration.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined in .env.local');
  }

  console.log('🚀 Starting Unified Task System Migration');
  console.log('📋 This will:');
  console.log('   1. Create new "Tasks" table with unified structure');
  console.log('   2. Migrate existing BookTask data to Tasks table');
  console.log('   3. Add proper indexes and constraints');
  console.log('   4. Support both workflow and general tasks');
  console.log('');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Step 1: Create new Tasks table with unified structure
    console.log('📝 Step 1/8: Creating Tasks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "Tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "status" varchar(50) DEFAULT 'pending' NOT NULL,
        "taskType" varchar(50) DEFAULT 'workflow' NOT NULL,
        "sessionId" varchar(255),
        "bookId" uuid,
        "bookTitle" varchar(255),
        "stepNumber" integer,
        "stepName" varchar(100),
        "isPictureBook" boolean DEFAULT false,
        "parentTaskId" uuid,
        "dependencies" jsonb DEFAULT '[]',
        "toolUsed" varchar(100),
        "estimatedDuration" varchar(50),
        "actualDuration" varchar(50),
        "completedAt" timestamp,
        "approvedAt" timestamp,
        "metadata" jsonb DEFAULT '{}',
        "notes" text,
        "userId" uuid NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✅ Tasks table created successfully');

    // Step 2: Add foreign key constraint for parent task relationship
    console.log('📝 Step 2/8: Adding parent task foreign key...');
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Tasks_parentTaskId_fkey'
        ) THEN
          ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_parentTaskId_fkey" 
          FOREIGN KEY ("parentTaskId") REFERENCES "Tasks"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `;
    console.log('✅ Parent task foreign key added');

    // Step 3: Add indexes for performance
    console.log('📝 Step 3/8: Creating performance indexes...');
    await sql`CREATE INDEX IF NOT EXISTS "Tasks_sessionId_idx" ON "Tasks"("sessionId")`;
    await sql`CREATE INDEX IF NOT EXISTS "Tasks_taskType_idx" ON "Tasks"("taskType")`;
    await sql`CREATE INDEX IF NOT EXISTS "Tasks_userId_taskType_idx" ON "Tasks"("userId", "taskType")`;
    await sql`CREATE INDEX IF NOT EXISTS "Tasks_parentTaskId_idx" ON "Tasks"("parentTaskId")`;
    await sql`CREATE INDEX IF NOT EXISTS "Tasks_bookId_idx" ON "Tasks"("bookId")`;
    console.log('✅ Performance indexes created');

    // Step 4: Add unique constraints
    console.log('📝 Step 4/8: Adding unique constraints...');
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Tasks_bookId_stepNumber_unique'
        ) THEN
          ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_bookId_stepNumber_unique" 
          UNIQUE ("bookId", "stepNumber");
        END IF;
      END $$
    `;
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Tasks_sessionId_title_unique'
        ) THEN
          ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_sessionId_title_unique" 
          UNIQUE ("sessionId", "title");
        END IF;
      END $$
    `;
    console.log('✅ Unique constraints added');

    // Step 5: Check if BookTask table exists and migrate data
    console.log('📝 Step 5/8: Checking for existing BookTask data...');
    const bookTaskExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'BookTask'
      )
    `;
    
    if (bookTaskExists[0]?.exists) {
      console.log('📦 Found existing BookTask table, migrating data...');
      const migratedRows = await sql`
        INSERT INTO "Tasks" (
          "id", "title", "status", "taskType", "bookId", "bookTitle", "stepNumber", "stepName", 
          "isPictureBook", "toolUsed", "completedAt", "approvedAt", "metadata", "notes", 
          "userId", "createdAt", "updatedAt"
        )
        SELECT 
          "id", 
          COALESCE("stepName", 'Untitled Task') as "title",
          "status", 
          'workflow' as "taskType",
          "bookId", 
          "bookTitle", 
          "stepNumber", 
          "stepName",
          "isPictureBook", 
          "toolUsed", 
          "completedAt", 
          "approvedAt", 
          "metadata", 
          "notes",
          "userId", 
          "createdAt", 
          "updatedAt"
        FROM "BookTask"
        ON CONFLICT ("id") DO NOTHING
        RETURNING "id"
      `;
      console.log(`✅ Migrated ${migratedRows.length} workflow tasks from BookTask table`);
    } else {
      console.log('ℹ️  No existing BookTask table found, skipping data migration');
    }

    // Step 6: Add foreign key constraint to user table if it exists
    console.log('📝 Step 6/8: Adding user foreign key constraint...');
    await sql`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'User'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Tasks_userId_fkey'
        ) THEN
          ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_userId_fkey" 
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `;
    console.log('✅ User foreign key constraint added');

    // Step 7: Verify table structure
    console.log('📝 Step 7/8: Verifying table structure...');
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'Tasks' 
      ORDER BY ordinal_position
    `;
    console.log(`✅ Tasks table has ${tableInfo.length} columns`);

    // Step 8: Check constraints and indexes
    console.log('📝 Step 8/8: Verifying constraints and indexes...');
    const constraints = await sql`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'Tasks'
    `;
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Tasks'
    `;
    console.log(`✅ Found ${constraints.length} constraints and ${indexes.length} indexes`);

    console.log('');
    console.log('🎉 Unified Task System Migration completed successfully!');
    console.log('');
    console.log('📊 What was created:');
    console.log('   ✅ Tasks table with unified structure');
    console.log('   ✅ Indexes for performance optimization');
    console.log('   ✅ Unique constraints for data integrity');
    console.log('   ✅ Foreign key relationships');
    if (bookTaskExists[0]?.exists) {
      console.log('   ✅ Migrated existing BookTask data');
    }
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   1. Test the new unified task system');
    console.log('   2. Update any remaining code references');
    console.log('   3. Consider dropping old BookTask table after verification');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

main()
  .then(() => {
    console.log('✨ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
