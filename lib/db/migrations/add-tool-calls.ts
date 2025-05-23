import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({
  path: '.env.local',
});

// This is a migration script to add the tool_calls column to the Message_v2 table
// Run this script using:
// npx tsx lib/db/migrations/add-tool-calls.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  console.log('Starting migration: Adding tool_calls column to Message_v2 table');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Add column to Message_v2 table
    await sql`ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "tool_calls" json DEFAULT NULL`;
    console.log('Added tool_calls column to Message_v2 table');

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

main().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 