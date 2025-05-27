#!/usr/bin/env ts-node
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

async function main() {
  console.log('Starting message memory table creation...');

  // Load environment variables from .env.local first
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    console.log(`Loading environment from ${envLocalPath}`);
    dotenv.config({ path: envLocalPath });
  } else {
    console.log('No .env.local file found, checking for .env');
    dotenv.config();
  }

  // Initialize database connection
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not defined in environment variables');
  }

  console.log('Database URL found, connecting...');
  const client = postgres(postgresUrl);
  const db = drizzle(client);

  try {
    // Check if the table already exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'MessageMemory'
      );
    `);

    const tableExists = tableCheck[0]?.exists === true;

    if (tableExists) {
      console.log('MessageMemory table already exists. Skipping creation.');
    } else {
      // Create the table
      console.log('Creating MessageMemory table...');
      await db.execute(sql`
        CREATE TABLE "MessageMemory" (
          "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
          "messageId" uuid NOT NULL REFERENCES "Message_v2"("id"),
          "chatId" uuid NOT NULL REFERENCES "Chat"("id"),
          "memories" jsonb NOT NULL,
          "createdAt" timestamp NOT NULL DEFAULT now()
        );
      `);

      console.log('MessageMemory table created successfully!');
    }
  } catch (error) {
    console.error('Error creating MessageMemory table:', error);
  } finally {
    // Close the connection
    await client.end();
    console.log('Database connection closed.');
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 