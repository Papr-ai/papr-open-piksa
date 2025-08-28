import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function updateBooksSchema() {
  console.log('Updating books schema...');
  
  try {
    // Add bookId column to existing books table
    await db.execute(`
      ALTER TABLE "books" 
      ADD COLUMN IF NOT EXISTS "bookId" UUID;
    `);
    
    // Generate bookId for existing records (group by bookTitle and userId)
    await db.execute(`
      WITH book_ids AS (
        SELECT DISTINCT "bookTitle", "userId", gen_random_uuid() as new_book_id
        FROM "books"
        WHERE "bookId" IS NULL
      )
      UPDATE "books" 
      SET "bookId" = book_ids.new_book_id
      FROM book_ids
      WHERE "books"."bookTitle" = book_ids."bookTitle" 
      AND "books"."userId" = book_ids."userId"
      AND "books"."bookId" IS NULL;
    `);
    
    // Make bookId NOT NULL
    await db.execute(`
      ALTER TABLE "books" 
      ALTER COLUMN "bookId" SET NOT NULL;
    `);
    
    // Create index on bookId for better performance
    await db.execute(`
      CREATE INDEX IF NOT EXISTS "books_bookId_idx" ON "books"("bookId");
    `);
    
    console.log('Books schema updated successfully!');
  } catch (error) {
    console.error('Error updating books schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  updateBooksSchema()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { updateBooksSchema };
