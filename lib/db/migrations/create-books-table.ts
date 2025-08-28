import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({
  path: '.env.local',
});

// This is a migration script to create a dedicated books table
// Run this script using:
// npx tsx lib/db/migrations/create-books-table.ts

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }

  console.log('Starting migration: Creating books table');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Create books table with versioning similar to Document table
    await sql`
      CREATE TABLE IF NOT EXISTS "books" (
        "id" uuid NOT NULL,
        "bookTitle" text NOT NULL,
        "chapterNumber" integer NOT NULL,
        "chapterTitle" text NOT NULL,
        "content" text,
        "userId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "is_latest" boolean NOT NULL DEFAULT true,
        "version" varchar NOT NULL DEFAULT '1',
        PRIMARY KEY ("id", "createdAt"),
        UNIQUE("bookTitle", "chapterNumber", "userId", "is_latest")
      )
    `;
    console.log('Created books table');

    // Create index on bookTitle and userId for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_books_book_title_user_id" 
      ON "books" ("bookTitle", "userId")
    `;
    console.log('Created index on books table');

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
