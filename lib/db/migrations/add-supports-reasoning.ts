import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables
config({
  path: '.env.local',
});

async function main() {
  console.log('Starting migration to add supportsReasoning column...');
  
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }
  
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Add the supportsReasoning column to the Message_v2 table
    console.log('Adding supportsReasoning column to Message_v2 table...');
    await sql`ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "supportsReasoning" BOOLEAN DEFAULT false`;
    console.log('Successfully added supportsReasoning column');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Migration completed');
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
} 