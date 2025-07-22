/**
 * Papr User ID Test Script
 *
 * Run with: npx tsx lib/ai/memory/paprUserId-test.ts
 *
 * This script tests memory search with known working Papr User ID.
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createMemoryService } from './service';
import type { UIMessage } from 'ai';

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

// Known working Papr user ID from previous tests
const KNOWN_WORKING_PAPR_USER_ID = process.env.TEST_USER_ID || '';
// The problematic UUID format ID that was being used before
const PROBLEMATIC_USER_ID = '56c10329-618b-43c4-ab54-dd296a24bb4f';

// Create test messages
const testMessage: UIMessage = {
  id: `test-${Date.now()}`,
  role: 'user',
  content: 'Test message for memory',
  parts: [{ type: 'text', text: 'Test message for memory' }],
};

async function testPaprMemorySearch() {
  console.log('=== Testing Memory Search with Direct Papr User ID ===');

  try {
    // Create memory service
    console.log('\nCreating memory service...');
    const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);

    // Test 1: Search with known working ID
    console.log(
      `\n1. Testing with known working ID: ${KNOWN_WORKING_PAPR_USER_ID}`,
    );
    console.log('Searching for "test" memories...');

    const workingIdMemories = await memoryService.searchMemories(
      KNOWN_WORKING_PAPR_USER_ID,
      'test',
      10,
    );

    console.log(`Result: Found ${workingIdMemories.length} memories`);

    if (workingIdMemories.length > 0) {
      console.log('\nMemory samples:');
      workingIdMemories.slice(0, 3).forEach((memory, i) => {
        console.log(`\nMemory #${i + 1}:`);
        console.log(
          `Content: ${memory.content?.substring(0, 100) || '(no content)'}`,
        );
        console.log(`ID: ${memory.id || 'Not available'}`);
        console.log(
          `User ID: ${memory.metadata?.user_id || 'Not found'}`,
        );
      });
    }

    // Test 2: Search with problematic UUID
    console.log(`\n2. Testing with problematic UUID: ${PROBLEMATIC_USER_ID}`);
    console.log('Searching for "test" memories...');

    const uuidMemories = await memoryService.searchMemories(
      PROBLEMATIC_USER_ID,
      'test',
      10,
    );

    console.log(`Result: Found ${uuidMemories.length} memories`);

    // Test 3: Search for a specific query with known working ID
    console.log('\n3. Testing with specific query "silicon valley"...');

    const specificMemories = await memoryService.searchMemories(
      KNOWN_WORKING_PAPR_USER_ID,
      'silicon valley',
      10,
    );

    console.log(`Result: Found ${specificMemories.length} memories`);

    if (specificMemories.length > 0) {
      console.log('\nMemory samples:');
      specificMemories.slice(0, 3).forEach((memory, i) => {
        console.log(`\nMemory #${i + 1}:`);
        console.log(
          `Content: ${memory.content?.substring(0, 100) || '(no content)'}`,
        );
        console.log(`ID: ${memory.id || 'Not available'}`);
        console.log(
          `User ID: ${memory.metadata?.user_id || 'Not found'}`,
        );
      });
    }

    console.log('\n=== Test Results Summary ===');
    console.log(
      `Working Papr ID (${KNOWN_WORKING_PAPR_USER_ID}): ${workingIdMemories.length} memories found`,
    );
    console.log(
      `Problematic UUID (${PROBLEMATIC_USER_ID}): ${uuidMemories.length} memories found`,
    );

    if (workingIdMemories.length > 0 && uuidMemories.length === 0) {
      console.log(
        '\n✅ CONFIRMED: The issue is that we need to use the Papr user ID format',
      );
      console.log('   instead of the UUID format for memory lookups.');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testPaprMemorySearch().catch((error) => {
  console.error('Unhandled error:', error);
});
