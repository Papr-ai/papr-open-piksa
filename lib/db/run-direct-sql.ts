import { config } from 'dotenv';
import postgres from 'postgres';

// Load environment variables from .env.local
config({
  path: '.env.local',
});

async function main() {
  console.log('Connecting to database...');

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not defined in .env.local');
  }

  const client = postgres(process.env.POSTGRES_URL, { max: 1 });

  try {
    console.log('Creating Collection table...');
    await client`
      CREATE TABLE IF NOT EXISTS "Collection" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" TEXT NOT NULL,
        "description" TEXT,
        "userId" UUID NOT NULL REFERENCES "User"("id"),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
        "systemType" VARCHAR(32)
      );
    `;

    console.log('Creating ChatCollection table...');
    await client`
      CREATE TABLE IF NOT EXISTS "ChatCollection" (
        "chatId" UUID NOT NULL REFERENCES "Chat"("id"),
        "collectionId" UUID NOT NULL REFERENCES "Collection"("id"),
        "addedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("chatId", "collectionId")
      );
    `;

    console.log('Creating indexes...');
    await client`CREATE INDEX IF NOT EXISTS "idx_collection_userId" ON "Collection"("userId");`;
    await client`CREATE INDEX IF NOT EXISTS "idx_chatcollection_collectionId" ON "ChatCollection"("collectionId");`;
    await client`CREATE INDEX IF NOT EXISTS "idx_chatcollection_chatId" ON "ChatCollection"("chatId");`;

    console.log('Tables and indexes created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    console.log('Closing database connection...');
    await client.end();
  }
}

main().catch(console.error);
