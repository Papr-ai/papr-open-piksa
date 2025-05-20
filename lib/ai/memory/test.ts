/**
 * Papr Memory SDK Test Script
 *
 * Run this script to test the Papr Memory SDK integration.
 * Usage: npx tsx lib/ai/memory/test.ts
 *
 * Note: You must set the PAPR_MEMORY_API_KEY environment variable before running.
 *
 * Important API requirements:
 * 1. HTTPS is required for the Azure endpoint
 * 2. X-Client-Type header is required for all requests
 * 3. Only one auth method should be used (X-API-Key takes precedence over Bearer token)
 */

import { initPaprMemory } from './index';
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

// Force HTTPS for Azure endpoint, regardless of environment variable
// This ensures we use HTTPS for all API calls
process.env.PAPR_MEMORY_API_URL = 'https://memory.papr.ai';

// Base API URL for all calls
const API_BASE_URL =
  process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';

console.log('Using API base URL:', API_BASE_URL);

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
    // Initialize the SDK for user creation
    console.log('\n👤 Creating a test user...');

    // Initialize the SDK with just the custom baseURL
    const paprClient = initPaprMemory(apiKey, {
      baseURL: API_BASE_URL,
    });
    console.log('SDK baseURL configured as:', API_BASE_URL);
    console.log('SDK actual baseURL:', (paprClient as any).baseURL);

    let userId: string | undefined;

    try {
      // Use the SDK to create a user
      console.log(
        'Attempting to create user with SDK at:',
        `${(paprClient as any).baseURL}/v1/users`,
      );
      const userResponse = await paprClient.user.create({
        external_id: `test-user-${testId}`,
        email: `test-${testId}@example.com`,
        metadata: {
          source: 'v0-test',
          testId,
        },
      });

      console.log(
        'User creation response:',
        JSON.stringify(userResponse, null, 2),
      );

      // Extract user ID from response, handling null case
      userId = userResponse.user_id ?? undefined;

      if (userId) {
        console.log(`✅ User created with ID: ${userId}`);
      } else {
        console.log('⚠️ No user ID returned, using test ID instead');
        userId = testId;
      }
    } catch (userError) {
      console.error('❌ Error creating user:', userError);
      console.log('Using test ID as user ID instead');
      userId = testId;
    }

    // Now test just the SDK wrapper
    try {
      console.log('\n📝 Testing SDK wrapper...');
      console.log(
        'Attempting to add memory with SDK at:',
        `${(paprClient as any).baseURL}/v1/memory`,
      );

      // Add a unique memory using the SDK wrapper
      const sdkMemoryContent = `This is a test memory using the SDK wrapper. Test ID: ${testId}`;

      console.log('\n==== Adding memory using SDK wrapper ====');
      console.log('Memory content:', sdkMemoryContent);
      console.log(
        'Memory metadata:',
        JSON.stringify(
          {
            source: 'v0-test-sdk',
            testId,
            user_id: userId,
            tags: ['test', 'sdk-integration'],
          },
          null,
          2,
        ),
      );

      // Try to add a memory using the SDK
      const sdkResponse = await paprClient.memory.add({
        content: sdkMemoryContent,
        type: 'text',
        metadata: {
          source: 'v0-test-sdk',
          testId,
          user_id: userId, // Include user ID in metadata
          tags: ['test', 'sdk-integration'],
        },
      });

      console.log('SDK Response:', JSON.stringify(sdkResponse, null, 2));
      console.log('✅ SDK wrapper test passed!');

      // Extract memory ID from SDK response
      let sdkMemoryId: string | undefined;
      if (sdkResponse.data?.length) {
        sdkMemoryId = sdkResponse.data[0].memoryId;
      }

      if (sdkMemoryId) {
        console.log(`✅ SDK memory added with ID: ${sdkMemoryId}`);
      }

      // Add a delay to allow time for indexing
      console.log('\n⏳ Waiting 5 seconds for memory indexing...');
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay

      // Now test searching for memories by user ID
      console.log('\n🔍 Testing memory search by user ID...');

      try {
        // Use SDK to search for memories by user_id
        console.log(
          `\n==== SEARCH: Looking for memories with user_id: ${userId} ====`,
        );

        try {
          console.log('Attempt #1: Using user_id as a top-level parameter');
          const searchResponse = await paprClient.memory.search({
            query: 'Find my test memories',
            max_memories: 10, // Increase to find more potential matches
            user_id: userId, // Filter by user ID
          });

          // Process search results...
          console.log(
            'Search response structure:',
            Object.keys(searchResponse),
          );
          if (searchResponse.data) {
            console.log('Data structure:', Object.keys(searchResponse.data));
          }

          // Count the number of memories returned
          let memories: any[] = [];

          // Handle different response structures that might be returned
          if (searchResponse.data?.memories) {
            memories = searchResponse.data.memories as any[];
          } else if (
            searchResponse.data &&
            'data' in searchResponse.data &&
            (searchResponse.data as any).data?.memories
          ) {
            memories = (searchResponse.data as any).data.memories as any[];
          } else if (searchResponse.data?.nodes) {
            // In case memories are stored in nodes property
            memories = searchResponse.data.nodes as any[];
          }

          console.log(`\n==== FOUND ${memories.length} MEMORIES ====`);
          // Extract and print just the content and important metadata
          memories.slice(0, 3).forEach((memory, index) => {
            console.log(`\nMemory #${index + 1}:`);
            console.log('Content:', memory.content);
            console.log('ID:', memory.id);
            console.log(
              'User ID:',
              memory.user_id || memory.metadata?.user_id || 'Not found',
            );
            console.log(
              'Test ID in content:',
              memory.content?.includes(testId) ? 'Yes' : 'No',
            );
          });

          // Process results...
          processSearchResults(memories, sdkMemoryContent, testId, userId);
        } catch (error: any) {
          console.log(`Error with first search approach: ${error.message}`);

          // Try alternative approach using SDK with metadata
          console.log('\nAttempt #2: Using SDK with user_id in metadata');

          // Cast the search params to any to bypass the type checking
          // since the actual API accepts metadata but the type definition doesn't include it
          const searchWithMetadataResponse = await paprClient.memory.search({
            query: 'Find my test memories',
            max_memories: 10,
            metadata: {
              user_id: userId,
              testId, // Also include testId in search
            },
          } as any);

          // Access the results from the response
          let memories: any[] = [];
          if (searchWithMetadataResponse.data?.memories) {
            memories = searchWithMetadataResponse.data.memories as any[];
          } else if (searchWithMetadataResponse.data?.nodes) {
            memories = searchWithMetadataResponse.data.nodes as any[];
          }

          console.log(`\n==== FOUND ${memories.length} MEMORIES ====`);
          // Extract and print just the content and important metadata
          memories.slice(0, 3).forEach((memory, index) => {
            console.log(`\nMemory #${index + 1}:`);
            console.log('Content:', memory.content);
            console.log('ID:', memory.id);
            console.log(
              'User ID:',
              memory.user_id || memory.metadata?.user_id || 'Not found',
            );
            console.log(
              'Test ID in content:',
              memory.content?.includes(testId) ? 'Yes' : 'No',
            );
          });

          // Process results
          processSearchResults(memories, sdkMemoryContent, testId, userId);
        }
      } catch (searchError) {
        console.error('❌ Error searching memories:', searchError);
      }

      // Helper function to process search results
      function processSearchResults(
        memories: any[],
        sdkMemoryContent: string,
        testId: string,
        userId: string,
      ) {
        // Check if our recently added memory is in the results
        const foundMemory = memories.some(
          (memory) =>
            memory.content?.includes(sdkMemoryContent) ||
            memory.content?.includes(testId),
        );

        if (memories.length > 0) {
          console.log(
            `✅ Found ${memories.length} memories for user ${userId}`,
          );

          if (foundMemory) {
            console.log(
              '✅ Successfully found our newly added test memory in search results',
            );
          } else {
            console.log(
              '⚠️ Newly added memory was not found in search results. This could be due to indexing delay.',
            );
          }
        } else {
          console.log(
            '⚠️ No memories found. This could be due to indexing delay or a search configuration issue.',
          );
        }
      }
    } catch (sdkError) {
      console.error('❌ SDK wrapper test failed:', sdkError);
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
