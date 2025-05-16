/**
 * Memory Middleware Test Script
 *
 * This script directly tests the memory middleware functions to debug search issues.
 * Run with: npx tsx lib/ai/memory/middleware-test.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { generateUUID } from '@/lib/utils';
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

// Configuration for the test - use the specific user ID
const TEST_USER_ID = process.env.TEST_USER_ID || ''; // Specific user ID for testing

// Directly test the memory service functions instead of middleware
// This avoids issues with server-only components
async function testMemoryService() {
  console.log('=== Testing Memory Service Functions ===');
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log(`API Key present: ${PAPR_MEMORY_API_KEY ? 'Yes' : 'No'}`);

  // Generate a unique ID for this test
  const testId = `memory-test-${Date.now()}`;
  const chatId = `test-chat-${Date.now()}`;

  try {
    // Create memory service
    console.log('\nCreating memory service...');
    const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);
    console.log('✅ Memory service created');

    // Step 1: Create a test message
    console.log('\n1. Creating a test message...');
    const messageId = generateUUID();
    const testContent = `This is a test message for testing memory at ${new Date().toISOString()}. ID: ${testId}`;

    // Create a properly formatted UIMessage with all required properties
    const testMessage: UIMessage = {
      id: messageId,
      role: 'user',
      content: testContent, // Required by Message type
      parts: [{ type: 'text', text: testContent }],
    };

    console.log(`Test Message ID: ${messageId}`);
    console.log(`Test Message Content: ${testContent}`);

    // Step 2: Store the message in memory directly using the service
    console.log('\n2. Storing the message in memory...');
    const storeResult = await memoryService.storeMessage(
      TEST_USER_ID,
      chatId,
      testMessage,
    );

    if (storeResult) {
      console.log('✅ Message stored successfully in memory');
    } else {
      console.log('❌ Failed to store message in memory');
    }

    // Wait for the memory to be indexed
    console.log('\nWaiting 5 seconds for memory indexing...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 3: Test memory search with direct service call
    console.log('\n3. Testing memory search with searchMemories...');

    // First test with a specific search query
    const searchQuery = `test message ID: ${testId}`;
    console.log(`\n3.1. Searching with query: "${searchQuery}"...`);

    const memories = await memoryService.searchMemories(
      TEST_USER_ID,
      searchQuery,
      5,
    );

    if (memories.length > 0) {
      console.log(`✅ Found ${memories.length} memories with search query`);
      console.log('Memory content sample:');
      memories.slice(0, 2).forEach((memory, index) => {
        console.log(`\nMemory #${index + 1}:`);
        console.log(
          'Content:',
          memory.content?.substring(0, 100) || '(no content)',
        );
        console.log('ID:', memory.id || 'Not available');
      });

      // Format memories for prompt
      console.log('\n4. Formatting memories for prompt...');
      const formattedMemories = memoryService.formatMemoriesForPrompt(memories);
      console.log('✅ Memories formatted for prompt successfully');
      console.log('Formatted memories preview:');
      console.log(`${formattedMemories.substring(0, 200)}...`);
    } else {
      console.log('⚠️ No memories found with search query');
      console.log(
        'This could be due to indexing delay or search configuration issues.',
      );
    }

    console.log('\n=== Memory Service Test Completed ===');
  } catch (error) {
    console.error('Error during memory service test:', error);
  }
}

// Run the test
testMemoryService().catch((error) => {
  console.error('Unhandled error:', error);
});
