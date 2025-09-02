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
  SearchResponse,
  MemoryMetadata,
  MemoryUpdateResponse
} from '@papr/memory/resources/memory';
import type { UIMessage } from 'ai';
import { Papr } from '@papr/memory';

interface FormattedMemory {
  id: string;
  content?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
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
    appUserId?: string, // Add app user ID for tracking
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

      // Check if userId format matches Papr user ID format (not a UUID)
      if (userId.includes('-')) {
        console.warn(
          `[Memory WARNING] storeMessage is using what appears to be an app UUID (${userId}) instead of a Papr user ID.`,
        );
      }

      // Prepare memory parameters using SDK type
      const metadata: MemoryMetadata = {
        sourceType: 'PaprChat',
        user_id: userId,
        createdAt: new Date().toISOString(),
        topics: ['chat', 'conversation'],
        hierarchical_structures: `chat/${chatId}`,
        sourceUrl: `/chat/${chatId}`,
        conversationId: chatId,
        customMetadata: {
          chat_id: chatId,
          message_id: message.id,
          role: message.role
        }
      };

      const memoryParams: MemoryAddParams = {
        content,
        type: 'text',
        metadata,
        skip_background_processing: false
      };

      console.log('[Memory] Adding message with params:', {
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        type: 'text',
        metadata: {
          sourceType: metadata.sourceType,
          conversationId: metadata.conversationId,
          createdAt: metadata.createdAt,
          customMetadata: metadata.customMetadata || {}
        },
      });

      // Add memory using SDK
      const response: AddMemoryResponse = await paprClient.memory.add(memoryParams);

      // Check if response indicates success
      if (!response || !response.data?.[0]?.memoryId) {
        console.error('[Memory] Invalid response:', response);
        return false;
      }

      // CENTRALIZED TRACKING: Track memory addition usage
      if (appUserId) {
        try {
          const { trackMemoryAdd } = await import('@/lib/subscription/usage-middleware');
          await trackMemoryAdd(appUserId);
          console.log(`[Memory] Tracked memory addition for user: ${appUserId}`);
        } catch (error) {
          console.error('[Memory] Failed to track memory usage:', error);
        }
      } else {
        console.warn('[Memory] No app user ID provided for tracking - memory usage not tracked');
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
    metadata: Partial<MemoryMetadata> = {},
    appUserId?: string, // Add app user ID for tracking
  ): Promise<boolean> => {
    try {
      // Check if userId format matches Papr user ID format (not a UUID)
      if (userId.includes('-')) {
        console.warn(
          `[Memory WARNING] storeContent is using what appears to be an app UUID (${userId}) instead of a Papr user ID.`,
        );
      }

      // Initialize proper metadata structure ensuring standard fields are at top level
      const fullMetadata: MemoryMetadata = {
        // Standard fields
        sourceType: metadata.sourceType || 'PaprChat',
        user_id: userId,
        createdAt: metadata.createdAt || new Date().toISOString(),
        
        // Optional standard fields - copy if provided
        sourceUrl: metadata.sourceUrl,
        external_user_id: metadata.external_user_id,
        topics: metadata.topics,
        'emoji tags': metadata['emoji tags'],
        'emotion tags': metadata['emotion tags'],
        hierarchical_structures: metadata.hierarchical_structures,
        conversationId: metadata.conversationId,
        workspace_id: metadata.workspace_id,
        
        // Custom metadata
        customMetadata: metadata.customMetadata || {}
      };

      // Copy over any custom metadata from createdAt if it was incorrectly placed there
      if (metadata.customMetadata?.createdAt && !metadata.createdAt) {
        fullMetadata.createdAt = String(metadata.customMetadata.createdAt);
      }
      if (metadata.customMetadata?.created_at && !metadata.createdAt) {
        fullMetadata.createdAt = String(metadata.customMetadata.created_at);
      }

      // Prepare memory parameters using SDK type
      const memoryParams: MemoryAddParams = {
        content,
        type,
        metadata: fullMetadata,
        skip_background_processing: false
      };

      console.log('[Memory] Adding memory with params:', {
        content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        type,
        metadata: {
          sourceType: fullMetadata.sourceType,
          createdAt: fullMetadata.createdAt,
          topics: fullMetadata.topics,
          hierarchical_structures: fullMetadata.hierarchical_structures,
          customMetadata: fullMetadata.customMetadata
        },
      });

      // Add memory using SDK
      const response: AddMemoryResponse = await paprClient.memory.add(memoryParams);

      // Check if response indicates success
      if (!response || !response.data?.[0]?.memoryId) {
        console.error('[Memory] Invalid response:', response);
        return false;
      }

      // CENTRALIZED TRACKING: Track memory addition usage
      if (appUserId) {
        try {
          const { trackMemoryAdd } = await import('@/lib/subscription/usage-middleware');
          await trackMemoryAdd(appUserId);
          console.log(`[Memory] Tracked memory addition for user: ${appUserId}`);
        } catch (error) {
          console.error('[Memory] Failed to track memory usage:', error);
        }
      } else {
        console.warn('[Memory] No app user ID provided for tracking - memory usage not tracked');
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
      const response: SearchResponse = await paprClient.memory.search(searchParams, {
        query: {
          max_memories: 25
        }
      });

      console.log('[Memory DEBUG] Search response received:', JSON.stringify(response, null, 2));

      // Use proper SearchResponse type structure  
      const memories: SearchResponse.Data.Memory[] = response.data?.memories || [];

      // Format memories for display
      const formattedMemories = memories
        .filter(memory => memory.id) // Only keep memories with IDs
        .map((memory: SearchResponse.Data.Memory): FormattedMemory => {
          // Debug: Log the raw memory object structure from SDK
          console.log('[Memory DEBUG] Raw SDK memory object:', JSON.stringify(memory, null, 2));
          
          // Handle metadata using proper SDK types - check both metadata fields
          let combinedMetadata: Record<string, unknown> = {};
          
          // Process the 'metadata' field (can be string or object)
          if (memory.metadata) {
            if (typeof memory.metadata === 'string') {
              try {
                const parsedMetadata = JSON.parse(memory.metadata);
                combinedMetadata = { ...combinedMetadata, ...parsedMetadata };
                console.log('[Memory DEBUG] Parsed metadata from string:', parsedMetadata);
              } catch (parseError) {
                console.error('[Memory DEBUG] Failed to parse metadata JSON:', parseError);
              }
            } else if (typeof memory.metadata === 'object') {
              combinedMetadata = { ...combinedMetadata, ...memory.metadata };
              console.log('[Memory DEBUG] Used metadata object:', memory.metadata);
            }
          }
          
          // Process the 'customMetadata' field (object or null)
          if (memory.customMetadata && typeof memory.customMetadata === 'object') {
            combinedMetadata = { ...combinedMetadata, ...memory.customMetadata };
            console.log('[Memory DEBUG] Used customMetadata:', memory.customMetadata);
          }
          
          // Debug: Show key SDK fields
          console.log('[Memory DEBUG] SDK fields for memory', memory.id, ':');
          console.log('  - metadata:', typeof memory.metadata, memory.metadata ? JSON.stringify(memory.metadata).substring(0, 200) : 'null');
          console.log('  - customMetadata:', typeof memory.customMetadata, memory.customMetadata ? JSON.stringify(memory.customMetadata).substring(0, 200) : 'null');
          console.log('  - source_type:', memory.source_type);
          console.log('  - source_url:', memory.source_url);
          console.log('  - topics:', memory.topics);
          console.log('  - tags:', memory.tags);
          
          // Debug: Log final combined metadata
          console.log('[Memory DEBUG] Final combined metadata for memory', memory.id, ':', JSON.stringify(combinedMetadata, null, 2));

          // Ensure createdAt is a string using proper SDK field
          const createdAt: string = memory.created_at || new Date().toISOString();
          
          return {
            id: memory.id,
            content: memory.content,
            createdAt,
            metadata: combinedMetadata
          };
        });

      console.log(`[Memory] Found ${formattedMemories.length} memories`);
      return formattedMemories;
    } catch (error: any) {
      // Handle 404 as a normal "no memories found" case
      if (error?.status === 404 || error?.message?.includes('404') || error?.message?.includes('No relevant items found')) {
        console.log('[Memory] No relevant memories found (404)');
        return [];
      }
      
      // Log other errors as actual problems
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

  /**
   * Update a memory by ID
   * @param memoryId - Memory ID to update
   * @param updates - Fields to update (content, metadata, type)
   * @returns Success status
   */
  const updateMemory = async (
    memoryId: string,
    updates: {
      content?: string;
      metadata?: MemoryMetadata;
      type?: MemoryType;
    }
  ): Promise<boolean> => {
    try {
      console.log('[Memory] Updating memory:', { memoryId, updates });
      
      const response = await paprClient.memory.update(memoryId, updates);
      
      if (!response || !response.memory_items || response.status !== 'success') {
        console.error('[Memory] Invalid update response:', response);
        return false;
      }
      
      console.log(`[Memory] Successfully updated memory ${memoryId}`);
      return true;
    } catch (error) {
      console.error('[Memory] Error updating memory:', error);
      return false;
    }
  };

  /**
   * Delete a memory by ID
   * @param memoryId - Memory ID to delete
   * @returns Success status
   */
  const deleteMemory = async (memoryId: string): Promise<boolean> => {
    try {
      console.log('[Memory] Deleting memory:', memoryId);
      
      const response = await paprClient.memory.delete(memoryId);
      
      console.log(`[Memory] Successfully deleted memory ${memoryId}`);
      return true;
    } catch (error) {
      console.error('[Memory] Error deleting memory:', error);
      return false;
    }
  };

  return {
    storeMessage,
    storeContent,
    searchMemories,
    formatMemoriesForPrompt,
    updateMemory,
    deleteMemory,
  };
}