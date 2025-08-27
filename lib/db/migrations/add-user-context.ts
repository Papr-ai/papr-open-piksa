import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables
config({
  path: '.env.local',
});

async function main() {
  console.log('Starting migration to add userContext column...');
  const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const db = drizzle(sql);

  try {
    // Add the userContext column to the Chat table
    console.log('Adding userContext column to Chat table...');
    await sql`ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "userContext" text`;
    console.log('Successfully added userContext column');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await sql.end();
    console.log('Migration completed');
  }
}

// Run the migration
main().catch(console.error);
