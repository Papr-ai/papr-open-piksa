/**
 * Memory service for PaprChat
 *
 * This service handles storing and retrieving chat memories using the Papr Memory SDK.
 */

import { initPaprMemory } from './index';
import type { 
  MemoryType, 
  MemoryAddParams, 
  MemorySearchParams,
  AddMemoryResponse,
  SearchResponse
} from '@papr/memory/resources/memory';
import type { UIMessage } from 'ai';
import { Papr } from '@papr/memory';

interface FormattedMemory {
  id: string;
  content?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

/**
 * Initialize the memory service
 * @param apiKey - Papr Memory API key
 * @returns Memory service methods
 */
export function createMemoryService(apiKey: string) {
  // Initialize SDK client
  const paprClient = initPaprMemory(apiKey, {
    baseURL: process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai',
  });
  /**
   * Store a message in memory
   * @param userId - Papr user ID (not app user ID)
   * @param chatId - Chat ID
   * @param message - Message to store
   * @returns Success status
   */
  const storeMessage = async (
    userId: string,
    chatId: string,
    message: UIMessage,
  ): Promise<boolean> => {
    try {
      // Extract message content
      let content = '';
      if ('content' in message && message.content) {
        content = String(message.content);
      } else if (message.parts) {
        content = message.parts
          .map((part) => {
            if (typeof part === 'string') return part;
            if (typeof part === 'object') {
              if ('text' in part) return part.text;
              if ('content' in part) return part.content;
              return JSON.stringify(part);
            }
            return '';
          })
          .join(' ')
          .trim();
      }

      if (!content) {
        console.log('[Memory] No content to store');
        return false;
      }

      // Prepare memory parameters using SDK type
      const memoryParams: Papr.MemoryAddParams = {
        content,
        type: 'text',
        metadata: {
          sourceType: 'PaprChat',
          user_id: userId, // Include user_id in metadata
          customMetadata: {
            chat_id: chatId,
            message_id: message.id,
            role: message.role
          }
        },
        skip_background_processing: false
      };

      // Add memory using SDK
      const response = await paprClient.memory.add(memoryParams);

      // Check if response indicates success
      if (!response || !response.data?.[0]?.memoryId) {
        console.error('[Memory] Invalid response:', response);
        return false;
      }

      console.log(
        `[Memory] Stored message ${message.id} as memory ${response.data[0].memoryId}`,
      );
      return true;
    } catch (error) {
      console.error('[Memory] Error storing message:', error);
      return false;
    }
  };

  /**
   * Store any content in memory
   * @param userId - Papr user ID (not app user ID)
   * @param content - Content to store
   * @param type - Type of content
   * @param metadata - Additional metadata
   * @returns Success status
   */
  const storeContent = async (
    userId: string,
    content: string,
    type: MemoryType = 'text',
    metadata: Record<string, any> = {},
  ): Promise<boolean> => {
    try {
      // Prepare memory parameters using SDK type
      const memoryParams: Papr.MemoryAddParams = {
        content,
        type,
        metadata: {
          ...metadata,
          source: 'PaprChat',
          user_id: userId, // Include user_id in metadata
          createdAt: new Date().toISOString()
        },
        skip_background_processing: false
      };

      console.log('add memory params in service.ts', memoryParams)

      // Add memory using SDK
      const response = await paprClient.memory.add(memoryParams);

      // Check if response indicates success
      if (!response || !response.data?.[0]?.memoryId) {
        console.error('[Memory] Invalid response:', response);
        return false;
      }

      console.log(`[Memory] Stored content as memory ${response.data[0].memoryId}`);
      return true;
    } catch (error) {
      console.error('[Memory] Error storing content:', error);
      return false;
    }
  };

  /**
   * Search for memories
   * @param userId - Papr user ID (not app user ID)
   * @param query - Search query
   * @param maxResults - Maximum number of results
   * @returns Array of memories
   */
  const searchMemories = async (
    userId: string,
    query: string,
    maxResults: number = 25,
  ): Promise<FormattedMemory[]> => {
    try {
      // Check if userId format matches Papr user ID format (not a UUID)
      if (userId.includes('-')) {
        console.warn(
          `[Memory WARNING] Search is using what appears to be an app UUID (${userId}) instead of a Papr user ID.`,
        );
      }

      // Create search parameters according to SDK structure
      const searchParams: MemorySearchParams = {
        query,
        user_id: userId,
      };

      console.log(
        `[Memory DEBUG] Searching memories with params:`,
        JSON.stringify(searchParams, null, 2),
      );

      // Use SDK to search with proper parameter placement
      const response = await paprClient.memory.search(searchParams, {
        query: {
          max_memories: 25
        }
      });

      // Handle different response formats
      let memories: SearchResponse.Data.Memory[] = [];
      
      if (response && response.data) {
        if (Array.isArray(response.data.memories)) {
          memories = response.data.memories;
        }
      }

      // Format memories for display
      const formattedMemories = memories
        .filter(memory => memory.id) // Only keep memories with IDs
        .map((memory): FormattedMemory => {
          // Parse metadata if it's a string
          const metadata = typeof memory.metadata === 'string' 
            ? JSON.parse(memory.metadata)
            : memory.metadata || {};

          // Use created_at from memory or createdAt from metadata
          const createdAt = memory.created_at || 
            (metadata && typeof metadata === 'object' && 'createdAt' in metadata ? metadata.createdAt : null) || 
            new Date().toISOString();
          
          return {
            id: memory.id,
            content: memory.content,
            createdAt,
            metadata
          };
        });

      console.log(`[Memory] Found ${formattedMemories.length} memories`);
      return formattedMemories;
    } catch (error) {
      console.error('[Memory] Error searching memories:', error);
      return [];
    }
  };

  /**
   * Format memories for inclusion in prompts
   * @param memories - Array of memories to format
   * @returns Formatted string
   */
  const formatMemoriesForPrompt = (memories: FormattedMemory[]): string => {
    if (!memories || memories.length === 0) return '';

    const formattedMemories = memories
      .map((memory, index) => {
        const timestamp = memory.createdAt || 'unknown time';
        const content = memory.content || '';
        return `Memory ${index + 1} [${timestamp}]: ${content}`;
      })
      .join('\n\n');

    return `The user has the following relevant memories you should consider when responding:\n\n${formattedMemories}\n\nConsider these memories when responding to the user's current request.`;
  };

  return {
    storeMessage,
    storeContent,
    searchMemories,
    formatMemoriesForPrompt,
  };
}