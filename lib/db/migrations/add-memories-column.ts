import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables
config({
  path: '.env.local',
});

async function main() {
  console.log('Starting migration to add memories column...');
  const sql = postgres(process.env.DATABASE_URL || '', { max: 1 });
  const db = drizzle(sql);

  try {
    // Add the memories column to the Message_v2 table
    console.log('Adding memories column to Message_v2 table...');
    await sql`ALTER TABLE "Message_v2" ADD COLUMN IF NOT EXISTS "memories" JSONB DEFAULT NULL`;
    console.log('Successfully added memories column');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await sql.end();
    console.log('Migration completed');
  }
}

// Run the migration
main().catch(console.error); 