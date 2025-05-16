/**
 * Memory middleware for v0chat
 *
 * This middleware enhances chat interactions with memory capabilities.
 */

import { createMemoryService } from './service';
import { systemPrompt } from '@/lib/ai/prompts';
import type { UIMessage } from 'ai';

interface EnhancePromptOptions {
  userId: string;
  messages: UIMessage[];
  apiKey: string;
}

/**
 * Enhance the system prompt with relevant memories
 */
export async function enhancePromptWithMemories({
  userId,
  messages,
  apiKey,
}: EnhancePromptOptions): Promise<string> {
  try {
    console.log(
      `[Memory DEBUG] enhancePromptWithMemories called for user ${userId}`,
    );
    console.log(`[Memory DEBUG] API key present: ${apiKey ? 'Yes' : 'No'}`);
    console.log(`[Memory DEBUG] Number of messages: ${messages.length}`);

    if (!apiKey) {
      console.log('[Memory DEBUG] No API key, returning empty string');
      return ''; // If no API key, return empty string
    }

    // Get the Papr User ID from database instead of using app User ID directly
    let paprUserId = userId; // Default to app User ID if lookup fails

    try {
      // Import the db-related code inside the function to avoid circular dependencies
      const { db, user, eq } = await import('@/lib/db/queries-minimal');

      // Fetch the user to check if they have a Papr user ID
      const userResult = await db
        .select({ paprUserId: user.paprUserId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userResult.length > 0 && userResult[0].paprUserId) {
        paprUserId = userResult[0].paprUserId;
        console.log(
          `[Memory DEBUG] Found Papr user ID: ${paprUserId} for app user ${userId}`,
        );
      } else {
        console.log(
          `[Memory DEBUG] No Papr user ID found for app user ${userId}, using app user ID as fallback`,
        );
      }
    } catch (dbError) {
      console.error(
        '[Memory DEBUG] Error fetching Papr user ID from database:',
        dbError,
      );
      // Continue with the app user ID if there's an error
    }

    const memoryService = createMemoryService(apiKey);

    // Get the most recent user message to search for relevant memories
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage) {
      console.log(
        '[Memory DEBUG] No user message found, returning empty string',
      );
      return '';
    }

    console.log(
      `[Memory DEBUG] Found latest user message with ID: ${latestUserMessage.id}`,
    );

    // Extract query from message parts
    let query = '';

    // If message has content field, use it directly
    if ('content' in latestUserMessage && latestUserMessage.content) {
      query = String(latestUserMessage.content);
      console.log(
        `[Memory DEBUG] Using message content field: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`,
      );
    } else if (latestUserMessage.parts) {
      // Otherwise extract from parts with type-safe property checks
      query = latestUserMessage.parts
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          }

          // Handle complex message parts with type-safe property checks
          if (part && typeof part === 'object') {
            // Check for text property (TextUIPart)
            if ('text' in part && typeof part.text === 'string') {
              return part.text;
            }
            // Check for content property
            if ('content' in part && typeof part.content === 'string') {
              return part.content;
            }
            // Check for type-based structure
            if ('type' in part && part.type === 'text') {
              // TextUIPart should have a text property
              if ('text' in part && typeof part.text === 'string') {
                return part.text;
              }
            }

            // Try to serialize the object as fallback
            try {
              return JSON.stringify(part);
            } catch (e) {
              console.log('[Memory DEBUG] Could not stringify part:', e);
            }
          }

          return '';
        })
        .join(' ')
        .trim();

      console.log(
        `[Memory DEBUG] Extracted query from parts: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`,
      );
    }

    if (!query) {
      console.log('[Memory DEBUG] Empty query, returning empty string');
      return '';
    }

    // Search for memories using the SDK with the actual query content
    console.log(
      `[Memory DEBUG] Searching memories for user ID: ${paprUserId} with query: "${query}"`,
    );

    // Use the SDK to search for memories using the Papr User ID
    const memories = await memoryService.searchMemories(paprUserId, query, 25);

    console.log(`[Memory DEBUG] Found ${memories.length} relevant memories`);

    // Log detailed memory information for debugging
    if (memories.length > 0) {
      console.log('[Memory DEBUG] Memory search results:');
      memories.forEach((memory, i) => {
        console.log(`[Memory DEBUG] Memory #${i + 1}:`);
        console.log(
          `[Memory DEBUG] Content: ${memory.content?.substring(0, 100)}...`,
        );
        console.log(`[Memory DEBUG] ID: ${memory.id || 'Not available'}`);
        console.log(
          `[Memory DEBUG] User ID: ${memory.user_id || memory.metadata?.user_id || 'Not found'}`,
        );
      });
    } else {
      console.log('[Memory DEBUG] No memories found in search results');
    }

    // Format memories as a prompt addition
    const promptAddition = memoryService.formatMemoriesForPrompt(memories);
    console.log(
      `[Memory DEBUG] Returning prompt addition of length ${promptAddition.length} characters`,
    );
    return promptAddition;
  } catch (error) {
    console.error(
      '[Memory DEBUG] Error enhancing prompt with memories:',
      error,
    );
    return '';
  }
}

/**
 * Store a message in memory
 */
export async function storeMessageInMemory({
  userId,
  chatId,
  message,
  apiKey,
}: {
  userId: string;
  chatId: string;
  message: UIMessage;
  apiKey: string;
}): Promise<boolean> {
  if (!apiKey) {
    console.log('[Memory] No API key provided');
    return false; // If no API key, return false
  }

  try {
    // Import the db-related code inside the function to avoid circular dependencies
    // and to keep memory processing separate from db access
    const { db, user, eq } = await import('@/lib/db/queries-minimal');

    // Fetch the user to check if they have a Papr user ID
    let paprUserId: string | undefined;
    try {
      const userResult = await db
        .select({ paprUserId: user.paprUserId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userResult.length > 0 && userResult[0].paprUserId) {
        paprUserId = userResult[0].paprUserId;
        console.log(
          `[Memory] Using Papr user ID: ${paprUserId} for app user ${userId}`,
        );
      } else {
        console.log(
          `[Memory] No Papr user ID found for app user ${userId}, using app user ID`,
        );
      }
    } catch (dbError) {
      console.error(
        '[Memory] Error fetching Papr user ID from database:',
        dbError,
      );
      // Continue with the app user ID if there's an error
    }

    // Use the Papr user ID if available, otherwise fall back to the app user ID
    const memoryUserId = paprUserId || userId;

    const memoryService = createMemoryService(apiKey);
    return await memoryService.storeMessage(memoryUserId, chatId, message);
  } catch (error) {
    console.error('[Memory] Error storing message in memory:', error);
    return false;
  }
}

/**
 * Enhanced system prompt factory that includes memories
 */
export function createMemoryEnabledSystemPrompt({
  apiKey,
}: {
  apiKey: string;
}) {
  return async ({
    selectedChatModel,
    userId,
    messages,
  }: {
    selectedChatModel: string;
    userId: string;
    messages: UIMessage[];
  }) => {
    // Get the base system prompt
    const basePrompt = systemPrompt({ selectedChatModel });

    // If we don't have an API key or user ID, just return the base prompt
    if (!apiKey || !userId) {
      console.log(
        '[Memory DEBUG] Skipping memory retrieval - no API key or user ID',
      );
      return basePrompt;
    }

    console.log(
      `[Memory DEBUG] Retrieving memories for user ${userId} with ${messages.length} messages`,
    );

    // Enhance with memories
    const memoryPrompt = await enhancePromptWithMemories({
      userId,
      messages,
      apiKey,
    });

    // Combine the prompts
    if (memoryPrompt) {
      console.log('[Memory DEBUG] Enhanced system prompt with user memories');
      return `${basePrompt}\n\n${memoryPrompt}`;
    }

    console.log(
      '[Memory DEBUG] No relevant memories found for this conversation',
    );
    return basePrompt;
  };
}

/**
 * Search for user memories
 * @param userId App user ID
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @param apiKey Papr Memory API key
 * @returns Array of memory items
 */
export async function searchUserMemories({
  userId,
  query,
  maxResults = 5,
  apiKey,
}: {
  userId: string;
  query: string;
  maxResults?: number;
  apiKey: string;
}): Promise<any[]> {
  if (!apiKey) {
    console.log('[Memory] No API key provided for search');
    return [];
  }

  try {
    // Import the db-related code inside the function to avoid circular dependencies
    const { db, user, eq } = await import('@/lib/db/queries-minimal');

    // Fetch the user to check if they have a Papr user ID
    let paprUserId = userId; // Default to app user ID
    try {
      const userResult = await db
        .select({ paprUserId: user.paprUserId })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userResult.length > 0 && userResult[0].paprUserId) {
        paprUserId = userResult[0].paprUserId;
        console.log(
          `[Memory] Using Papr user ID: ${paprUserId} for app user ${userId}`,
        );
      } else {
        console.log(
          `[Memory] No Papr user ID found for app user ${userId}, using app user ID as fallback`,
        );
      }
    } catch (dbError) {
      console.error(
        '[Memory] Error fetching Papr user ID from database:',
        dbError,
      );
      // Continue with the app user ID if there's an error
    }

    const memoryService = createMemoryService(apiKey);

    // Use SDK to search for memories
    console.log(
      `[Memory DEBUG] Getting memories in searchUserMemories via SDK for user ${paprUserId} with query "${query}"`,
    );

    const memories = await memoryService.searchMemories(
      paprUserId,
      query,
      Math.max(maxResults, 25), // Use at least 25 results
    );

    console.log(
      `[Memory DEBUG] Found ${memories.length} memories for user ${paprUserId}`,
    );

    return memories;
  } catch (error) {
    console.error('[Memory DEBUG] Error searching user memories:', error);
    return [];
  }
}
