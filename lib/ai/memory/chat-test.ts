/**
 * Memory Service Test Script
 *
 * This script directly tests the memory service functionality with the user ID that works.
 * Run with: npx tsx lib/ai/memory/chat-test.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { generateUUID } from '@/lib/utils';
import { createMemoryService } from './service';
import { enhancePromptWithMemories } from './middleware';
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

// Get Memory API key
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';
if (!PAPR_MEMORY_API_KEY) {
  console.error('❌ Error: No memory API key found in environment');
  process.exit(1);
}

// Configuration for the test
const TEST_USER_ID = process.env.TEST_USER_ID || ''; // Specific user ID from successful memory test

// Test the memory service with a workflow similar to chat
async function testMemoryWorkflow() {
  console.log('=== Testing Memory Service Chat Workflow ===');
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log(`API Key present: ${PAPR_MEMORY_API_KEY ? 'Yes' : 'No'}`);

  // Create memory service
  console.log('\nCreating memory service...');
  const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);
  console.log('✅ Memory service created');

  try {
    // Step 1: Generate a unique test ID and simulate a chat message
    const testId = `memory-chat-test-${Date.now()}`;
    const chatId = `test-chat-${Date.now()}`;
    const messageContent = `Tell me what you know about silicon valley. Include test ID: ${testId}`;

    console.log(`\nTest ID: ${testId}`);
    console.log(`Chat ID: ${chatId}`);

    // Create a properly formatted UIMessage
    const userMessage: UIMessage = {
      id: generateUUID(),
      role: 'user',
      content: messageContent,
      parts: [{ type: 'text', text: messageContent }],
    };

    console.log(`\nSending test message: "${messageContent}"`);

    // Step 2: Search for relevant memories BEFORE storing the new message
    // This simulates how the chat flow searches for memories before responding
    console.log(
      '\n1. Searching for relevant memories BEFORE storing message...',
    );
    const queryText = 'silicon valley';
    console.log(`Search query: "${queryText}"`);

    const beforeMemories = await memoryService.searchMemories(
      TEST_USER_ID,
      queryText,
      5,
    );

    if (beforeMemories.length > 0) {
      console.log(`✅ Found ${beforeMemories.length} memories for query`);
      console.log('\nMemories found:');
      beforeMemories.forEach((memory, index) => {
        console.log(`\nMemory #${index + 1}:`);
        console.log(
          `Content: ${memory.content?.substring(0, 100) || '(no content)'}`,
        );
        console.log(`ID: ${memory.id || 'Not available'}`);
      });

      // Format memories for prompt
      const formattedMemories =
        memoryService.formatMemoriesForPrompt(beforeMemories);
      console.log('\nFormatted memories for prompt:');
      console.log(`${formattedMemories.substring(0, 300)}...`);
    } else {
      console.log('No memories found for query');
    }

    // SPECIAL TEST: Test enhancePromptWithMemories directly using the actual chat UI message format
    console.log(
      '\n1.5 Testing middleware query extraction with chat UI message format...',
    );

    // Create a message in the format used by the actual chat UI
    const chatUIMessage: UIMessage = {
      id: generateUUID(),
      role: 'user',
      content: 'check my latest memories',
      parts: [
        {
          type: 'text',
          text: 'check my latest memories',
        },
      ],
    };

    console.log(`Using message: "${chatUIMessage.content}"`);

    // Test enhancePromptWithMemories directly to see if it can extract the query
    const enhancedPrompt = await enhancePromptWithMemories({
      userId: TEST_USER_ID,
      messages: [chatUIMessage],
      apiKey: PAPR_MEMORY_API_KEY,
    });

    if (enhancedPrompt && enhancedPrompt.length > 0) {
      console.log(
        '✅ Successfully extracted query from chat UI message format',
      );
      console.log('Enhanced prompt excerpt:');
      console.log(`${enhancedPrompt.substring(0, 200)}...`);
    } else {
      console.log(
        '❌ Failed to extract query from chat UI message format or no memories found',
      );
    }

    // Step 3: Store the new message in memory
    // This simulates storing the message after AI has responded
    console.log('\n2. Storing new message in memory...');
    const storeResult = await memoryService.storeMessage(
      TEST_USER_ID,
      chatId,
      userMessage,
    );

    if (storeResult) {
      console.log('✅ Message stored successfully in memory');
    } else {
      console.log('❌ Failed to store message in memory');
    }

    // Step 4: Wait for indexing
    console.log('\nWaiting 5 seconds for memory indexing...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Step 5: Search again with the same query to see if the new message is found
    console.log('\n3. Searching for memories AFTER storing message...');
    console.log(`Search query: "${queryText}"`);

    const afterMemories = await memoryService.searchMemories(
      TEST_USER_ID,
      queryText,
      5,
    );

    if (afterMemories.length > 0) {
      console.log(`✅ Found ${afterMemories.length} memories for query`);
      console.log('\nMemories found:');
      afterMemories.forEach((memory, index) => {
        console.log(`\nMemory #${index + 1}:`);
        console.log(
          `Content: ${memory.content?.substring(0, 100) || '(no content)'}`,
        );
        console.log(`ID: ${memory.id || 'Not available'}`);
      });

      // Check if our new message is in the results
      const foundNewMessage = afterMemories.some(
        (memory) =>
          memory.content?.includes(testId) || memory.text?.includes(testId),
      );

      if (foundNewMessage) {
        console.log(
          '\n✅ Successfully found our newly added message in search results',
        );
      } else {
        console.log('\n⚠️ Our new message was not found in search results');
        console.log('This could be due to indexing delay or search ranking');
      }
    } else {
      console.log('No memories found for query');
    }

    console.log('\n=== Memory Service Chat Workflow Test Completed ===');
  } catch (error) {
    console.error('Error during memory test:', error);
  }
}

// Run the test
testMemoryWorkflow().catch((error) => {
  console.error('Unhandled error:', error);
});
