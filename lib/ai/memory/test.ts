/**
 * Papr Memory SDK Test Script
 *
 * Run this script to test the Papr Memory SDK integration.
 * Usage: npx tsx lib/ai/memory/test.ts
 *
 * Note: You must set the PAPR_MEMORY_API_KEY environment variable before running.
 */

import { createAuthenticatedFetch, initPaprMemory } from './index';
import dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load environment variables from multiple possible files
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

// Base API URL for all calls
const API_BASE_URL = 'https://4e4fc3b78291.ngrok.app';

// Test API connectivity
async function runTest() {
  console.log('Testing Papr Memory API connectivity...');

  // Step 1: Check for API key
  const apiKey = process.env.PAPR_MEMORY_API_KEY;

  if (!apiKey) {
    console.error(
      '❌ Error: PAPR_MEMORY_API_KEY environment variable must be set',
    );
    process.exit(1);
  }

  console.log('✅ API key found');

  // Generate a unique ID for this test run to help with cleanup
  const testId = `test-${Date.now()}`;
  console.log(`🔍 Test ID: ${testId}`);

  try {
    // Test using the authenticated fetch function
    console.log('\n📝 Testing with authenticated fetch...');
    const authenticatedFetch = createAuthenticatedFetch(apiKey);

    // Add a memory
    const response = await authenticatedFetch(`${API_BASE_URL}/v1/memory`, {
      method: 'POST',
      body: JSON.stringify({
        content: `This is a test memory using authenticated fetch. Test ID: ${testId}`,
        type: 'text',
        metadata: {
          source: 'v0-test',
          testId,
          tags: ['test', 'integration'],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const addResponse = await response.json();
    console.log('Raw API response:', JSON.stringify(addResponse, null, 2));

    // Extract memory ID from response
    let memoryId: string | undefined;
    if (addResponse.data?.length) {
      memoryId = addResponse.data[0].memoryId;
    } else if (addResponse.data?.memoryId) {
      memoryId = addResponse.data.memoryId;
    } else if (addResponse.memoryId) {
      memoryId = addResponse.memoryId;
    } else {
      console.log('Note: Could not find memory ID in response');
    }

    if (memoryId) {
      console.log(`✅ Memory added with ID: ${memoryId}`);
    }

    console.log('\n🎉 API connection test passed!');

    // Now test the SDK wrapper
    try {
      console.log('\n📝 Testing SDK wrapper (might not work yet)...');

      // Initialize the SDK with the API key
      const paprClient = initPaprMemory(apiKey);

      // Try to add a memory using the SDK
      const sdkResponse = await paprClient.memory.add({
        content: `This is a test memory using the SDK wrapper. Test ID: ${testId}`,
        type: 'text',
        metadata: {
          source: 'v0-test-sdk',
          testId,
          tags: ['test', 'sdk-integration'],
        },
      });

      console.log('SDK Response:', JSON.stringify(sdkResponse, null, 2));
      console.log('✅ SDK wrapper test passed!');
    } catch (sdkError) {
      console.error(
        '❓ SDK wrapper test failed (this is expected for now):',
        sdkError,
      );
      console.log(
        'ℹ️ The authenticated fetch function can be used as an alternative',
      );
    }
  } catch (error) {
    console.error('❌ Error during API test:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch((error) => {
  console.error('❌ Unhandled error during testing:', error);
  process.exit(1);
});
