/**
 * Papr Memory SDK wrapper for PaprChat
 *
 * This module provides a simplified interface to the @papr/memory SDK
 * for storing, retrieving, and managing memory in AI applications.
 *
 * IMPLEMENTATION NOTES:
 * - Always use HTTPS for the API URL (a key requirement for Azure endpoints)
 * - The SDK handles authentication with the provided API key
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
  options?: Omit<ClientOptions, 'apiKey' | 'bearerToken'> & { clientType?: string },
) => {
  // Extract clientType from options
  const { clientType = 'papr_plugin', ...standardOptions } = options || {};
  
  // Make sure baseURL has https:// prefix - force to https
  const baseURL = standardOptions?.baseURL || process.env.PAPR_MEMORY_API_URL;
  const secureBaseURL = baseURL
    ? baseURL.startsWith('https://')
      ? baseURL
      : `https://${baseURL.replace('http://', '')}`
    : 'https://memory.papr.ai';

  // Normalize baseURL to ensure it doesn't end with a slash
  const normalizedBaseURL = secureBaseURL.endsWith('/')
    ? secureBaseURL.slice(0, -1)
    : secureBaseURL;

  // Create the SDK client according to the documentation
  return new Papr({
    xAPIKey: apiKey,
    baseURL: normalizedBaseURL,
    ...standardOptions,
    defaultHeaders: {
      'X-Client-Type': clientType
    },
    logLevel: 'debug', // Set to debug to get detailed logs
  });
};

// Export the Papr class
export { Papr };

// Default export for easier imports
export default Papr;

// Export examples for easier access
export * from './example';
