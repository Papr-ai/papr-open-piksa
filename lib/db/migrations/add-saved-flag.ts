import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { boolean } from 'drizzle-orm/pg-core';

// This is a migration script to add the isSaved column to the vote table
// Run this script using:
// npx tsx lib/db/migrations/add-saved-flag.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  console.log('Starting migration: Adding isSaved column to vote tables');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Add column to Vote_v2 table
    await sql`ALTER TABLE "Vote_v2" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false`;
    console.log('Added isSaved column to Vote_v2 table');

    // Add column to Vote (deprecated) table for compatibility
    await sql`ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false`;
    console.log('Added isSaved column to Vote (deprecated) table');

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

main()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 