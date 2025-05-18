// This script adds the isSaved column to the Vote_v2 table

// Import the postgres client
const postgres = require('postgres');

// Read the env file
require('dotenv').config({ path: '.env.local' });

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not defined');
    process.exit(1);
  }

  console.log('Starting migration: Adding isSaved column to vote tables');

  // Create a connection
  const sql = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    // Add column to Vote_v2 table
    console.log('Adding isSaved column to Vote_v2 table...');
    await sql`ALTER TABLE "Vote_v2" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false`;
    console.log('✅ Added isSaved column to Vote_v2 table');

    // Add column to Vote (deprecated) table for compatibility
    console.log('Adding isSaved column to Vote table...');
    await sql`ALTER TABLE "Vote" ADD COLUMN IF NOT EXISTS "isSaved" boolean NOT NULL DEFAULT false`;
    console.log('✅ Added isSaved column to Vote table');

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
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
