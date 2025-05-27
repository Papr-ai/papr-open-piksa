#!/usr/bin/env ts-node
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

async function main() {
  console.log('Starting MessageMemory table update...');

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
    // Check if the table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'MessageMemory'
      );
    `);

    const tableExists = tableCheck[0]?.exists === true;

    if (!tableExists) {
      console.log('MessageMemory table does not exist. Nothing to update.');
      return;
    }

    // Drop and recreate the table without foreign key constraints
    console.log('Recreating MessageMemory table without foreign key constraints...');
    
    // First backup existing data
    console.log('Backing up existing data...');
    const existingData = await db.execute(sql`
      SELECT * FROM "MessageMemory";
    `);
    
    console.log(`Found ${existingData.length} records to backup.`);
    
    // Drop the table
    await db.execute(sql`
      DROP TABLE IF EXISTS "MessageMemory";
    `);
    
    // Create the table without foreign key constraints
    await db.execute(sql`
      CREATE TABLE "MessageMemory" (
        "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
        "messageId" uuid NOT NULL,
        "chatId" uuid NOT NULL,
        "memories" jsonb NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
    
    // Restore data if any exists
    if (existingData.length > 0) {
      console.log('Restoring backed up data...');
      for (const record of existingData) {
        await db.execute(sql`
          INSERT INTO "MessageMemory" ("id", "messageId", "chatId", "memories", "createdAt")
          VALUES (
            ${record.id},
            ${record.messageId},
            ${record.chatId},
            ${JSON.stringify(record.memories)},
            ${record.createdAt}
          );
        `);
      }
      console.log(`Successfully restored ${existingData.length} records.`);
    }

    console.log('MessageMemory table updated successfully without foreign key constraints!');
  } catch (error) {
    console.error('Error updating MessageMemory table:', error);
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