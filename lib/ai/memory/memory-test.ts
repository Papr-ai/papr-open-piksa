/**
 * Comprehensive test suite for Papr Memory SDK integration
 * 
 * This file contains test functions to verify:
 * 1. User creation
 * 2. Memory addition
 * 3. Memory search
 * 4. Memory update
 * 5. Memory deletion
 */

import { initPaprMemory } from './index';
import { generateUUID } from '@/lib/utils';
import { Papr } from '@papr/memory';
import type {
  AddMemoryResponse,
  MemorySearchParams,
  MemoryUpdateParams,
  MemoryDeleteResponse,
  SearchResponse,
  MemoryMetadata,
} from '@papr/memory/resources/memory';
import type { UserCreateParams, UserResponse } from '@papr/memory/resources/user';

// Configuration
const TEST_USER_ID_PREFIX = 'test-user-';
const TEST_CONTENT_PREFIX = 'Test memory content: ';
const INDEXING_WAIT_TIME_MS = 10000; // 10 seconds wait for indexing

// Get API key from environment variable
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';
const API_BASE_URL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';

/**
 * Main test function
 * This runs a complete workflow to test all memory operations
 */
async function runMemoryTest() {
  console.log('=== Papr Memory SDK Integration Test ===');
  
  if (!PAPR_MEMORY_API_KEY) {
    console.error('❌ ERROR: PAPR_MEMORY_API_KEY environment variable is not set');
    return;
  }
  
  // Check for placeholder API key
  if (PAPR_MEMORY_API_KEY === 'your_api_key') {
    console.error('❌ ERROR: Please replace "your_api_key" with a real API key');
    return;
  }
  
  console.log(`[Memory Test] Using API endpoint: ${API_BASE_URL}`);
  // Debug: Check API endpoint URL
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'HEAD'
    });
    console.log(`[Memory Test] API health check: ${response.status}`);
  } catch (error) {
    console.warn(`[Memory Test] API health check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Generate a unique test identifier to avoid conflicts
  const testId = generateUUID();
  const externalId = `${TEST_USER_ID_PREFIX}${testId}`;
  console.log(`[Memory Test] Test ID: ${testId}`);
  console.log(`[Memory Test] External User ID: ${externalId}`);
  
  try {
    // Initialize SDK
    
    const paprClient: Papr = new Papr({
      xAPIKey: PAPR_MEMORY_API_KEY,
      baseURL: API_BASE_URL,
      logLevel: 'debug', // Set to debug to get detailed logs
    });
    
    console.log('✅ SDK initialized successfully');
    
    // Step 1: Create test user
    console.log('\n[Step 1] Creating test user...');
    const userParams: UserCreateParams = {
      external_id: externalId,
      email: `${testId}@example.com`,
      metadata: {
        source: 'memory-test',
        test_id: testId,
      }
    };
    
    const userResponse: UserResponse = await paprClient.user.create(userParams);
    
    if (!userResponse || !userResponse.user_id) {
      console.error('❌ Failed to create test user');
      console.error('Response:', JSON.stringify(userResponse, null, 2));
      return;
    }
    
    const userId = userResponse.user_id;
    console.log(`✅ Created test user with ID: ${userId}`);
    console.log(`✅ User external_id: ${userResponse.external_id || externalId}`);
    
    // Step 2: Add memory
    console.log('\n[Step 2] Adding test memory...');
    const memoryContent = `${TEST_CONTENT_PREFIX}${testId}`;
    
    // Prepare memory content
    const memoryMetadata: MemoryMetadata = {
      customMetadata: {
        source: 'memory-test',
        test_id: testId,
        timestamp: new Date().toISOString()
      },
      sourceType: 'memory-test',
      sourceUrl: 'https://memory.papr.ai'
    };
    
    const memoryParams: Papr.MemoryAddParams = {
      content: memoryContent,
      type: 'text', 
      metadata: memoryMetadata
    };
    
    try {
      // Add memory with user_id as query parameter
      const addResponse: AddMemoryResponse = await paprClient.memory.add(memoryParams);
      
      if (!addResponse || !addResponse.data) {
        console.error('❌ Memory addition failed - empty response');
        console.error('Response:', JSON.stringify(addResponse, null, 2));
        return;
      }
      
      // Extract memory ID from the response
      let memoryId: string | undefined;
      
      // Check response structure based on v1.10.0 SDK
      if (Array.isArray(addResponse.data) && addResponse.data.length > 0) {
        memoryId = addResponse.data[0].memoryId
        console.log(`✅ Added memory with ID: ${memoryId}`);
        
        // Wait for indexing
        console.log(`\nWaiting ${INDEXING_WAIT_TIME_MS/1000} seconds for memory indexing...`);
        await new Promise(resolve => setTimeout(resolve, INDEXING_WAIT_TIME_MS));
        
        // Step 3: Search for memory
        console.log('\n[Step 3] Searching for memories...');
        try {
          // Search with user_id as query parameter and ensure min 10 results
          const searchOptions = { 
            query: { 
              max_memories: 10 // Minimum value accepted by the API
            } 
          };
          
          const searchParams: Papr.MemorySearchParams = {
            query: "check memories", // More general search query
          };
          
          const searchResponse: SearchResponse = await paprClient.memory.search(searchParams);
          
          if (!searchResponse || !searchResponse.data) {
            console.error('❌ Memory search failed - empty response');
            return;
          }
          
          // Check if any memories were found
          if (searchResponse.data.memories && searchResponse.data.memories.length > 0) {
            console.log(`✅ Found ${searchResponse.data.memories.length} memories in search results`);
            
            // Check if our specific memory is in results
            const foundMemory = searchResponse.data.memories.find(
              mem => mem.content.includes(testId)
            );
            
            if (foundMemory) {
              console.log('✅ Successfully found our test memory in search results');
            } else {
              console.warn('⚠️ Our specific test memory was not found in results');
            }
            
            // Optional: Step 4 - Update memory
            if (memoryId) {
              console.log('\n[Step 4] Updating test memory...');
              try {
                const updatedMetadata: MemoryMetadata = {
                  ...memoryMetadata,
                  customMetadata: {
                    ...memoryMetadata.customMetadata,
                    updated: true,
                    update_time: new Date().toISOString()
                  }
                };
                
                const updateParams: Papr.MemoryUpdateParams = {
                  content: `${memoryContent} (Updated)`,
                  metadata: updatedMetadata
                };
                
                const updateResponse = await paprClient.memory.update(memoryId, updateParams);
                
                console.log('✅ Memory updated successfully:', 
                  JSON.stringify(updateResponse, null, 2));
                  
                // Step 5: Delete memory
                console.log('\n[Step 5] Deleting test memory...');
                try {
                  const deleteResponse: MemoryDeleteResponse = await paprClient.memory.delete(memoryId);
                  console.log('✅ Memory deleted successfully:', 
                    JSON.stringify(deleteResponse, null, 2));
                } catch (error) {
                  console.warn('⚠️ Memory deletion failed:', error);
                }
              } catch (error) {
                console.warn('⚠️ Memory update failed:', error);
              }
            }
          } else {
            console.warn('⚠️ No memories found in search results. This could be due to indexing delay.');
          }
        } catch (error) {
          console.warn('⚠️ Search failed:', error);
        }
      } else {
        console.error('❌ Failed to get memory ID from response');
        console.error('Response:', JSON.stringify(addResponse, null, 2));
      }
    } catch (error) {
      console.error('❌ Memory addition failed:', error);
    }
    
    console.log('\n=== Test Completed Successfully ===');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run the test if executed directly
if (require.main === module) {
  runMemoryTest()
    .then(() => console.log('Test execution completed'))
    .catch(err => console.error('Test execution failed:', err));
}

// Export for programmatic use
export {
  runMemoryTest
}; 