/**
 * Papr Memory SDK Usage Examples
 *
 * This file provides examples of how to use the Papr Memory SDK in the v0 application.
 */

import {
  createAuthenticatedFetch,
  initPaprMemory,
  type MemoryAddParams,
  type MemorySearchParams,
} from './index';

// Base API URL for all calls
const API_BASE_URL = 'https://your-papr-endpoint.com';

// Example 1: Using authenticated fetch (recommended)
const authenticatedFetchExample = async () => {
  // Get API key from environment variable
  const apiKey = process.env.PAPR_MEMORY_API_KEY;

  if (!apiKey) {
    throw new Error('PAPR_MEMORY_API_KEY environment variable is not set');
  }

  // Create an authenticated fetch function
  const authenticatedFetch = createAuthenticatedFetch(apiKey);

  // Example: Add a memory
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/v1/memory`, {
      method: 'POST',
      body: JSON.stringify({
        content: 'This is a test memory using authenticated fetch',
        type: 'text',
        metadata: {
          source: 'v0-app',
          userId: 'user-123',
          tags: ['test', 'v0', 'example'],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('Memory added successfully:', data);
    return data;
  } catch (error) {
    console.error('Error adding memory:', error);
    throw error;
  }
};

// Example 2: Initialize the SDK
const initializeSDK = () => {
  // Get API key from environment variable
  const apiKey = process.env.PAPR_MEMORY_API_KEY;

  if (!apiKey) {
    throw new Error('PAPR_MEMORY_API_KEY environment variable is not set');
  }

  // Initialize the SDK with the API key
  const paprClient = initPaprMemory(apiKey);

  return paprClient;
};

// Example: Add a memory using the SDK approach
const addMemoryExample = async () => {
  const paprClient = initializeSDK();

  const memoryParams: MemoryAddParams = {
    content: 'This is a test memory for the v0 application',
    type: 'text',
    metadata: {
      source: 'v0-app',
      userId: 'user-123',
      tags: ['test', 'v0', 'example'],
    },
  };

  try {
    const response = await paprClient.memory.add(memoryParams);
    console.log('Memory added successfully:', response);
    return response;
  } catch (error) {
    console.error('Error adding memory:', error);
    throw error;
  }
};

// Example: Search for memories
const searchMemoriesExample = async (query: string) => {
  const paprClient = initializeSDK();

  const searchParams: MemorySearchParams = {
    query,
    max_memories: 5,
  };

  try {
    const response = await paprClient.memory.search(searchParams);
    console.log('Search results:', response);
    return response;
  } catch (error) {
    console.error('Error searching memories:', error);
    throw error;
  }
};

// Example: Update a memory
const updateMemoryExample = async (memoryId: string, newContent: string) => {
  const paprClient = initializeSDK();

  try {
    const response = await paprClient.memory.update(memoryId, {
      content: newContent,
    });
    console.log('Memory updated successfully:', response);
    return response;
  } catch (error) {
    console.error('Error updating memory:', error);
    throw error;
  }
};

// Example: Delete a memory
const deleteMemoryExample = async (memoryId: string) => {
  const paprClient = initializeSDK();

  try {
    const response = await paprClient.memory.delete(memoryId);
    console.log('Memory deleted successfully:', response);
    return response;
  } catch (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
};

export {
  authenticatedFetchExample,
  initializeSDK,
  addMemoryExample,
  searchMemoriesExample,
  updateMemoryExample,
  deleteMemoryExample,
};
