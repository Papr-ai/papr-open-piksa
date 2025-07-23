import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load environment variables
config({
  path: '.env.local',
});

async function main() {
  console.log('Starting migration to add createdAt column to User table...');
  
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined');
  }
  
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    // Add the createdAt column to the User table with a default of the current timestamp
    console.log('Adding createdAt column to User table...');
    await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL`;
    console.log('Successfully added createdAt column');
    
    // For existing users, the value will be the current time when the migration runs
    console.log('All existing users now have createdAt set to the current time');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('Migration completed');
  }
}

main().catch(console.error); 