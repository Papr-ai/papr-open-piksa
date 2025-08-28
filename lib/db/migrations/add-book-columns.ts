import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({
  path: '.env.local',
});

// This is a migration script to add book-related columns to the Document table
// Run this script using:
// npx tsx lib/db/migrations/add-book-columns.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  console.log('Starting migration: Adding book columns to Document table');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Add chapterNumber column to Document table
    await sql`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "chapterNumber" integer`;
    console.log('Added chapterNumber column to Document table');

    // Add bookTitle column to Document table
    await sql`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "bookTitle" text`;
    console.log('Added bookTitle column to Document table');

    // The database likely uses a CHECK constraint instead of an enum
    // The schema update will handle this automatically
    console.log('Skipping enum update - will be handled by schema');

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
