/**
 * Memory service for v0chat
 *
 * This service handles storing and retrieving chat memories.
 */

import { createAuthenticatedFetch } from './index';
import type { UIMessage } from 'ai';

// The base URL for the Papr Memory API from environment
const API_BASE_URL =
  process.env.PAPR_MEMORY_API_URL ||
  'http://memoryserver-development.azurewebsites.net';

/**
 * Initialize the memory service
 * @param apiKey - Papr Memory API key
 * @returns Memory service methods
 */
export function createMemoryService(apiKey: string) {
  // Create authenticated fetch for API calls
  const authenticatedFetch = createAuthenticatedFetch(apiKey);

  /**
   * Store a chat message in memory
   * @param userId - User ID
   * @param chatId - Chat ID
   * @param message - The message to store
   */
  const storeMessage = async (
    userId: string,
    chatId: string,
    message: UIMessage,
  ) => {
    try {
      // Only store user messages
      if (message.role !== 'user') {
        return;
      }

      // Extract content from message parts
      const content = message.parts
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }
          // Handle other part types if needed
          return '';
        })
        .join(' ')
        .trim();

      if (!content) {
        return; // Skip empty messages
      }

      // Store in Papr Memory
      console.log(`Storing memory at ${API_BASE_URL}/v1/memory`);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/v1/memory`, {
          method: 'POST',
          body: JSON.stringify({
            content,
            type: 'text',
            metadata: {
              source: 'v0chat',
              user_id: userId,
              chatId,
              messageId: message.id,
              timestamp: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          console.error('Failed to store memory:', await response.text());
          console.error('Status:', response.status);
        } else {
          console.log('Memory stored successfully');
        }
      } catch (error) {
        console.error('Error calling memory API:', error);
      }
    } catch (error) {
      console.error('Error storing message in memory:', error);
    }
  };

  /**
   * Search for relevant memories
   * @param userId - User ID
   * @param query - Search query
   * @param maxResults - Maximum number of results to return
   * @returns Relevant memories
   */
  const searchMemories = async (
    userId: string,
    query: string,
    maxResults = 5,
  ) => {
    try {
      // Search Papr Memory
      const response = await authenticatedFetch(
        `${API_BASE_URL}/v1/memory/search`,
        {
          method: 'POST',
          body: JSON.stringify({
            query,
            max_memories: maxResults,
            metadata: {
              user_id: userId, // Filter by user ID
            },
          }),
        },
      );

      if (!response.ok) {
        console.error('Failed to search memories:', await response.text());
        return [];
      }

      const data = await response.json();

      // Extract memories from response
      if (data.data?.results?.length > 0) {
        return data.data.results;
      } else if (data.data?.memory_items?.length > 0) {
        return data.data.memory_items;
      } else if (data.results?.length > 0) {
        return data.results;
      }

      return [];
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  };

  /**
   * Format memories as a system prompt addition
   * @param memories - Array of memories
   * @returns Formatted memories as a string
   */
  const formatMemoriesForPrompt = (memories: any[]) => {
    if (!memories.length) return '';

    return `
The user has the following relevant memories you should consider when responding:

${memories
  .map((memory, index) => {
    const content = memory.content || memory.text || '';
    return `Memory ${index + 1}: ${content}`;
  })
  .join('\n\n')}

Consider these memories when responding to the user's current request.
`;
  };

  return {
    storeMessage,
    searchMemories,
    formatMemoriesForPrompt,
  };
}
