/**
 * User ID Diagnostic Script
 *
 * Run with: npx tsx lib/ai/memory/user-id-debug.ts
 *
 * This script checks user IDs in the database and tests memory queries
 * to determine which user ID format works with the memory service.
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createMemoryService } from './service';

// Load environment variables from .env files
const envFiles = [
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.development',
];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment from ${file}`);
    dotenv.config({ path: filePath });
    if (process.env.PAPR_MEMORY_API_KEY) break;
  }
}

// Get Papr Memory API key from environment
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';
if (!PAPR_MEMORY_API_KEY) {
  console.error(
    '❌ Error: PAPR_MEMORY_API_KEY environment variable is not set',
  );
  process.exit(1);
}

// Known working test user ID from previous tests
const KNOWN_WORKING_USER_ID = process.env.TEST_USER_ID || '';

async function diagnosePaprUserIds() {
  console.log('=== Papr User ID Diagnostic Tool ===');

  try {
    // Step 1: Import database code
    console.log('\n1. Fetching user data from database...');
    const { db, user } = await import('@/lib/db/queries-minimal');

    // Step 2: Query all users with their Papr user IDs
    const users = await db
      .select({
        id: user.id,
        email: user.email,
        paprUserId: user.paprUserId,
      })
      .from(user)
      .limit(10);

    console.log(`\nFound ${users.length} users in database:`);
    users.forEach((u, i) => {
      console.log(`\nUser #${i + 1}:`);
      console.log(`App ID: ${u.id}`);
      console.log(`Email: ${u.email}`);
      console.log(`Papr User ID: ${u.paprUserId || 'Not set'}`);
    });

    // Step 3: Create memory service for testing
    console.log('\n2. Creating memory service...');
    const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);

    // Step 4: Test known working user ID
    console.log(`\n3. Testing known working user ID: ${KNOWN_WORKING_USER_ID}`);
    console.log('Searching for "test" memories...');

    const knownIdMemories = await memoryService.searchMemories(
      KNOWN_WORKING_USER_ID,
      'test',
      5,
    );

    console.log(`Result: Found ${knownIdMemories.length} memories`);

    // Step 5: Test with app user IDs from database
    console.log('\n4. Testing user IDs from database:');

    for (const u of users) {
      if (!u.id) continue;

      console.log(`\nTrying app user ID: ${u.id}`);
      const appIdMemories = await memoryService.searchMemories(u.id, 'test', 5);
      console.log(`Result: Found ${appIdMemories.length} memories`);

      if (u.paprUserId) {
        console.log(`Trying Papr user ID: ${u.paprUserId}`);
        const paprIdMemories = await memoryService.searchMemories(
          u.paprUserId,
          'test',
          5,
        );
        console.log(`Result: Found ${paprIdMemories.length} memories`);
      }
    }

    // Step 6: Test with manually entered UUIDs
    const problematicId = '56c10329-618b-43c4-ab54-dd296a24bb4f';
    console.log(`\n5. Testing problematic UUID: ${problematicId}`);
    const problemIdMemories = await memoryService.searchMemories(
      problematicId,
      'test',
      5,
    );
    console.log(`Result: Found ${problemIdMemories.length} memories`);

    console.log('\n=== Diagnostic Complete ===');
    console.log(
      'Check the results above to identify which user ID format works.',
    );
    console.log(
      'You likely need to update the database to store the correct Papr user IDs.',
    );
  } catch (error) {
    console.error('Error during diagnosis:', error);
  }
}

// Run the diagnostic
diagnosePaprUserIds().catch((error) => {
  console.error('Unhandled error:', error);
});
