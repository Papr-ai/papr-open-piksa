import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function fixBooksSchema() {
  console.log('Starting books schema migration...');

  try {
    // 1. First, let's see what we have in the current books table
    console.log('Checking current books table structure...');
    
    // 2. Drop the existing incomplete Books table if it exists
    console.log('Dropping incomplete Books table if it exists...');
    await db.execute(sql`DROP TABLE IF EXISTS "Books"`);
    
    // 3. Create new Books table with complete structure
    console.log('Creating new Books table with all columns...');
    await db.execute(sql`
      CREATE TABLE "Books" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookId" UUID NOT NULL,
        "bookTitle" TEXT NOT NULL,
        "chapterNumber" INTEGER NOT NULL,
        "chapterTitle" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "userId" UUID NOT NULL REFERENCES "User"("id"),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "version" VARCHAR(255) DEFAULT '1',
        "is_latest" BOOLEAN DEFAULT true,
        UNIQUE("bookId", "chapterNumber", "userId")
      )
    `);

    // 3. Create index for better performance
    console.log('Creating indexes...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_books_book_id_user_id" ON "Books"("bookId", "userId")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_books_book_title_user_id" ON "Books"("bookTitle", "userId")
    `);

    // 4. Migrate data from old books table if it exists and has data
    console.log('Checking if old books table has data to migrate...');
    const oldData = await db.execute(sql`
      SELECT * FROM "books" 
      WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'books')
      LIMIT 1
    `);

    if (oldData.length > 0) {
      console.log('Migrating data from old books table...');
      
      // Group existing chapters by bookTitle and userId to create bookIds
      const bookGroups = await db.execute(sql`
        SELECT DISTINCT "bookTitle", "userId" FROM "books"
      `);

      for (const group of bookGroups) {
        const bookId = crypto.randomUUID();
        console.log(`Creating bookId ${bookId} for "${group.bookTitle}" by user ${group.userId}`);
        
        // Get all chapters for this book
        const chapters = await db.execute(sql`
          SELECT * FROM "books" 
          WHERE "bookTitle" = ${group.bookTitle} 
          AND "userId" = ${group.userId}
          ORDER BY "chapterNumber"
        `);

        // Insert chapters into new table
        for (const chapter of chapters) {
          await db.execute(sql`
            INSERT INTO "Books" ("bookId", "bookTitle", "chapterNumber", "chapterTitle", "content", "userId", "createdAt", "updatedAt", "version", "is_latest")
            VALUES (${bookId}, ${chapter.bookTitle}, ${chapter.chapterNumber}, ${chapter.chapterTitle}, ${chapter.content}, ${chapter.userId}, ${chapter.createdAt}, ${chapter.updatedAt}, '1', true)
          `);
        }
      }

      // Drop old table
      console.log('Dropping old books table...');
      await db.execute(sql`DROP TABLE IF EXISTS "books"`);
    }

    console.log('Books schema migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  fixBooksSchema()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { fixBooksSchema };
