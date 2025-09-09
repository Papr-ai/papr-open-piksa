// Manual migration script for unified task system
// Renames BookTask table to Tasks and adds new columns for general task support
const { exec } = require('child_process');
require('dotenv').config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL environment variable is not set');
  console.error('Make sure .env.local exists with POSTGRES_URL');
  process.exit(1);
}

const POSTGRES_URL = process.env.POSTGRES_URL;

// SQL commands to execute for unified task migration
const sqlCommands = [
  // Step 1: Create new Tasks table with unified structure
  `CREATE TABLE IF NOT EXISTS "Tasks" (
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
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "Tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Tasks"("id") ON DELETE SET NULL
  );`,
  
  // Step 2: Add indexes for performance
  `CREATE INDEX IF NOT EXISTS "Tasks_sessionId_idx" ON "Tasks"("sessionId");`,
  `CREATE INDEX IF NOT EXISTS "Tasks_taskType_idx" ON "Tasks"("taskType");`,
  `CREATE INDEX IF NOT EXISTS "Tasks_userId_taskType_idx" ON "Tasks"("userId", "taskType");`,
  `CREATE INDEX IF NOT EXISTS "Tasks_parentTaskId_idx" ON "Tasks"("parentTaskId");`,
  `CREATE INDEX IF NOT EXISTS "Tasks_bookId_idx" ON "Tasks"("bookId");`,
  
  // Step 3: Add unique constraints
  `ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_bookId_stepNumber_unique" UNIQUE ("bookId", "stepNumber");`,
  `ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_sessionId_title_unique" UNIQUE ("sessionId", "title");`,
  
  // Step 4: Migrate existing BookTask data if table exists
  `INSERT INTO "Tasks" (
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
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'BookTask')
  ON CONFLICT ("id") DO NOTHING;`,
  
  // Step 5: Add foreign key constraint to user table (assuming it exists)
  `DO $$ 
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
      ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    END IF;
  END $$;`,
  
  // Step 6: Drop old BookTask table (commented out for safety - uncomment after verification)
  // `DROP TABLE IF EXISTS "BookTask";`
];

// Prepare the commands to run with psql
const commands = sqlCommands.map(cmd => {
  // Escape the SQL command for the shell
  const escapedCmd = cmd.replace(/'/g, "'\\''");
  return `psql "${POSTGRES_URL}" -c '${escapedCmd}'`;
});

console.log('🚀 Starting Unified Task System Migration');
console.log('📋 This will:');
console.log('   1. Create new "Tasks" table with unified structure');
console.log('   2. Migrate existing BookTask data to Tasks table');
console.log('   3. Add proper indexes and constraints');
console.log('   4. Support both workflow and general tasks');
console.log('');

// Execute each command in sequence
async function runMigration() {
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const step = i + 1;
    
    console.log(`📝 Step ${step}/${commands.length}: Executing migration step...`);
    
    try {
      await new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Error in step ${step}: ${error.message}`);
            reject(error);
            return;
          }
          if (stderr && !stderr.includes('NOTICE')) {
            console.log(`⚠️  Warning in step ${step}: ${stderr}`);
          }
          if (stdout.trim()) {
            console.log(`✅ Step ${step} output: ${stdout.trim()}`);
          } else {
            console.log(`✅ Step ${step} completed successfully`);
          }
          resolve();
        });
      });
    } catch (error) {
      console.error(`💥 Migration failed at step ${step}:`, error);
      console.error('');
      console.error('🔧 To troubleshoot:');
      console.error('   1. Check that POSTGRES_URL is correct in .env.local');
      console.error('   2. Ensure database is running and accessible');
      console.error('   3. Verify you have CREATE TABLE permissions');
      process.exit(1);
    }
  }
  
  console.log('');
  console.log('🎉 Unified Task System Migration completed successfully!');
  console.log('');
  console.log('📊 What was created:');
  console.log('   ✅ Tasks table with unified structure');
  console.log('   ✅ Indexes for performance optimization');
  console.log('   ✅ Unique constraints for data integrity');
  console.log('   ✅ Foreign key relationships');
  console.log('');
  console.log('🔄 Next steps:');
  console.log('   1. Test the new unified task system');
  console.log('   2. Verify existing BookTask data was migrated');
  console.log('   3. Update any remaining code references');
  console.log('   4. Consider dropping old BookTask table after verification');
}

runMigration();
