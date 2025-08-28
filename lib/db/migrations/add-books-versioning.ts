import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({
  path: '.env.local',
});

// This is a migration script to add versioning to the existing books table
// Run this script using:
// npx tsx lib/db/migrations/add-books-versioning.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  console.log('Starting migration: Adding versioning to books table');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // First, drop the existing unique constraint
    await sql`
      ALTER TABLE books DROP CONSTRAINT IF EXISTS books_bookTitle_chapterNumber_userId_key
    `;
    console.log('Dropped old unique constraint');

    // Add versioning columns
    await sql`
      ALTER TABLE books 
      ADD COLUMN IF NOT EXISTS "is_latest" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "version" varchar NOT NULL DEFAULT '1'
    `;
    console.log('Added versioning columns');

    // Drop the old primary key constraint
    await sql`
      ALTER TABLE books DROP CONSTRAINT IF EXISTS books_pkey
    `;
    console.log('Dropped old primary key');

    // Add new composite primary key
    await sql`
      ALTER TABLE books ADD PRIMARY KEY ("id", "createdAt")
    `;
    console.log('Added new composite primary key');

    // Add new unique constraint with is_latest
    await sql`
      ALTER TABLE books 
      ADD CONSTRAINT books_unique_latest 
      UNIQUE ("bookTitle", "chapterNumber", "userId", "is_latest")
    `;
    console.log('Added new unique constraint with versioning');

    // Create index for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_books_latest" 
      ON books ("bookTitle", "userId", "is_latest") 
      WHERE "is_latest" = true
    `;
    console.log('Created index for latest versions');

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
