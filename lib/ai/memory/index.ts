/**
 * Papr Memory SDK wrapper for v0chat
 *
 * This module provides a simplified interface to the @papr/memory SDK
 * for storing, retrieving, and managing memory in AI applications.
 */

import { Papr, type ClientOptions } from '@papr/memory';

// Import types from the memory resource
import type {
  Memory,
  AddMemory,
  AddMemoryResponse,
  ContextItem,
  MemoryMetadata,
  MemorySearchParams,
  MemoryType,
  MemoryAddParams,
  MemoryDeleteParams,
  MemoryDeleteResponse,
  MemoryUpdateParams,
  MemoryUpdateResponse,
  SearchResponse,
} from '@papr/memory/resources/memory';

// Import document types
import type {
  Document,
  DocumentUploadParams,
  DocumentUploadResponse,
} from '@papr/memory/resources/document';

// Re-export commonly used types for convenience
export type {
  Memory,
  AddMemory,
  AddMemoryResponse,
  ContextItem,
  MemoryMetadata,
  MemorySearchParams,
  MemoryType,
  MemoryAddParams,
  MemoryDeleteParams,
  MemoryDeleteResponse,
  MemoryUpdateParams,
  MemoryUpdateResponse,
  SearchResponse,
  Document,
  DocumentUploadParams,
  DocumentUploadResponse,
  ClientOptions,
};

/**
 * Initialize the Papr Memory SDK with the provided API key
 * @param apiKey - Papr Memory API key
 * @param options - Additional client options
 * @returns Initialized Papr Memory SDK client
 */
export const initPaprMemory = (
  apiKey: string,
  options?: Omit<ClientOptions, 'apiKey'>,
) => {
  // Create a properly typed options object without any type issues
  const clientOptions: ClientOptions = {
    apiKey,
    // Set empty bearer token to avoid environment var check
    bearerToken: '',
    // Set the correct base URL from environment
    baseURL:
      process.env.PAPR_MEMORY_API_URL ||
      'http://memoryserver-development.azurewebsites.net',
    ...options,
  };

  return new Papr(clientOptions);
};

/**
 * Create an authenticated fetch function for direct API access
 * @param apiKey - Papr Memory API key
 * @returns Authenticated fetch function
 */
export const createAuthenticatedFetch = (apiKey: string) => {
  // Return an authenticated fetch function
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'X-Client-Type': 'v0-sdk',
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };
};

// Export the Papr class
export { Papr };

// Default export for easier imports
export default Papr;

// Export examples for easier access
export * from './example';
