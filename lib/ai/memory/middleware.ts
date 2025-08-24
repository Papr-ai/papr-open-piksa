/**
 * Memory middleware for PaprChat
 *
 * This middleware enhances chat interactions with memory capabilities.
 */

import { createMemoryService } from './service';
import { systemPrompt } from '@/lib/ai/prompts';
import type { UIMessage } from 'ai';
import type { UserCreateParams, UserResponse } from '@papr/memory/resources/user';
import type { MemoryType, MemoryMetadata } from '@papr/memory/resources/memory';
import { filterMessageForMemory, extractConversationContext, convertDecisionToMetadata } from './intelligent-filter';

interface EnhancePromptOptions {
  userId: string;
  prompt: string;
  apiKey: string;
  maxMemories?: number;
  searchQuery?: string;
}


/**
 * Enhance a prompt with relevant memories
 */
export async function enhancePromptWithMemories({
  userId,
  prompt,
  apiKey,
  maxMemories = 25,
  searchQuery,
}: EnhancePromptOptions): Promise<string> {
  if (!apiKey) {
    console.log('[Memory] No API key provided');
    return prompt; // If no API key, return original prompt
  }

  try {
    // Ensure the user has a Papr user ID
    const paprUserId = await ensurePaprUser(userId, apiKey);

    if (!paprUserId) {
      console.warn(
        `[Memory WARNING] Failed to get or create Papr user ID for app user ${userId}. Memory operations may not work correctly.`,
      );
      return prompt;
    }

    console.log(
      `[Memory] Using Papr user ID: ${paprUserId} for searching memories for app user ${userId}`,
    );

    // Create memory service
    const memoryService = createMemoryService(apiKey);

    // Search for relevant memories
    const memories = await memoryService.searchMemories(
      paprUserId,
      searchQuery || prompt,
      maxMemories,
    );

    // If no memories found, return original prompt
    if (!memories || memories.length === 0) {
      console.log('[Memory] No relevant memories found');
      return prompt;
    }

    // Format memories and combine with prompt
    const memoryContext = memoryService.formatMemoriesForPrompt(memories);
    const enhancedPrompt = `${memoryContext}\n\n${systemPrompt}\n\n${prompt}`;

    return enhancedPrompt;
  } catch (error) {
    console.error('[Memory] Error enhancing prompt with memories:', error);
    return prompt;
  }
}

/**
 * Store a message in memory (legacy - direct storage)
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
    // Ensure the user has a Papr user ID
    const paprUserId = await ensurePaprUser(userId, apiKey);

    if (!paprUserId) {
      console.warn(
        `[Memory WARNING] Failed to get or create Papr user ID for app user ${userId}. Memory operations may not work correctly.`,
      );
      return false;
    }

    console.log(
      `[Memory] Using Papr user ID: ${paprUserId} for storing message from app user ${userId}`,
    );

    const memoryService = createMemoryService(apiKey);
    return await memoryService.storeMessage(paprUserId, chatId, message, userId);
  } catch (error) {
    console.error('[Memory] Error storing message in memory:', error);
    return false;
  }
}

/**
 * Intelligently filter and store a message in memory using AI
 */
export async function intelligentlyStoreMessageInMemory({
  userId,
  chatId,
  message,
  apiKey,
  conversationHistory = [],
}: {
  userId: string;
  chatId: string;
  message: UIMessage;
  apiKey: string;
  conversationHistory?: UIMessage[];
}): Promise<{ stored: boolean; reason?: string; category?: string }> {
  if (!apiKey) {
    console.log('[Memory] No API key provided for intelligent filtering');
    return { stored: false, reason: 'No API key provided' };
  }

  try {
    // Get conversation context for better filtering
    const conversationContext = extractConversationContext(conversationHistory, 3);
    
    console.log('[Memory] Starting intelligent filtering for message:', {
      messageId: message.id,
      userId,
      chatId,
      hasContext: Boolean(conversationContext),
    });

    // Use AI to determine if message should be stored
    const decision = await filterMessageForMemory({
      apiKey,
      userId,
      chatId,
      message,
      conversationContext,
    });

    if (!decision) {
      console.log('[Memory] Filter returned null - skipping storage');
      return { stored: false, reason: 'Filter analysis failed' };
    }

    if (!decision.shouldStore) {
      console.log('[Memory] AI decided not to store message:', decision.reasoning);
      return { stored: false, reason: decision.reasoning };
    }

    console.log('[Memory] AI decided to store message:', {
      category: decision.category,
      reasoning: decision.reasoning,
      hasCustomContent: Boolean(decision.content),
    });

    // Ensure the user has a Papr user ID
    const paprUserId = await ensurePaprUser(userId, apiKey);

    if (!paprUserId) {
      console.warn(
        `[Memory WARNING] Failed to get or create Papr user ID for app user ${userId}.`,
      );
      return { stored: false, reason: 'Failed to resolve user ID' };
    }

    // Convert decision to metadata
    const metadata = convertDecisionToMetadata(decision, userId, chatId);
    if (!metadata) {
      console.warn('[Memory] Failed to convert decision to metadata');
      return { stored: false, reason: 'Invalid decision format' };
    }

    // Use custom content if provided, otherwise use original message content
    const contentToStore = decision.content || extractMessageContent(message);
    if (!contentToStore) {
      console.log('[Memory] No content to store after filtering');
      return { stored: false, reason: 'No content to store' };
    }

    // Store using memory service
    const memoryService = createMemoryService(apiKey);
    const success = await memoryService.storeContent(
      paprUserId,
      contentToStore,
      'text',
      metadata,
      userId // Pass app user ID for tracking
    );

    if (success) {
      console.log('[Memory] Successfully stored filtered message:', {
        category: decision.category,
        contentLength: contentToStore.length,
      });
    }

    return {
      stored: success,
      reason: success ? 'Stored successfully' : 'Storage failed',
      category: decision.category,
    };

  } catch (error) {
    console.error('[Memory] Error in intelligent message filtering:', error);
    return { stored: false, reason: 'Filter processing error' };
  }
}

/**
 * Helper function to extract message content
 */
function extractMessageContent(message: UIMessage): string {
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
  return content;
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

    // Helper function to extract text content from UIMessage (AI SDK 5.0 format only)
    const extractTextFromMessage = (message: UIMessage) => {
      if ('parts' in message && Array.isArray(message.parts)) {
        // AI SDK 5.0 format with parts array
        return message.parts
          .filter(part => part.type === 'text')
          .map(part => (part as any).text)
          .join(' ');
      }
      return '';
    };

    // Enhance with memories
    const memoryPrompt = await enhancePromptWithMemories({
      userId,
      prompt: basePrompt,
      apiKey,
      maxMemories: 25,
      searchQuery: messages.map(extractTextFromMessage).join('\n'),
    });

    // Combine the prompts
    if (memoryPrompt) {
      console.log('[Memory DEBUG] Enhanced system prompt with user memories');
      return memoryPrompt;
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
    // Ensure the user has a Papr user ID
    const paprUserId = await ensurePaprUser(userId, apiKey);

    if (!paprUserId) {
      console.warn(
        `[Memory WARNING] Failed to get or create Papr user ID for app user ${userId}. Memory search may not work correctly.`,
      );
      return [];
    }

    // Validate the Papr user ID format
    if (paprUserId.includes('-')) {
      console.warn(
        `[Memory WARNING] The Papr user ID (${paprUserId}) appears to be an app UUID, not a valid Papr ID.`,
      );
    }

    console.log(
      `[Memory] Using Papr user ID: ${paprUserId} for memory search (app user: ${userId})`,
    );

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

/**
 * Store content in memory
 */
export async function storeContentInMemory({
  userId,
  content,
  type = 'text',
  metadata = {},
  apiKey,
}: {
  userId: string;
  content: string;
  type?: string;
  metadata?: Record<string, any>;
  apiKey: string;
}): Promise<boolean> {
  if (!apiKey) {
    console.log('[Memory] No API key provided');
    return false; // If no API key, return false
  }

  try {
    // Ensure the user has a Papr user ID
    const paprUserId = await ensurePaprUser(userId, apiKey);

    if (!paprUserId) {
      console.warn(
        `[Memory WARNING] Failed to get or create Papr user ID for app user ${userId}. Memory operations may not work correctly.`,
      );
      return false;
    }

    console.log(
      `[Memory] Using Papr user ID: ${paprUserId} for storing content from app user ${userId}`,
    );

    const memoryService = createMemoryService(apiKey);
    return await memoryService.storeContent(
      paprUserId, 
      content, 
      type as MemoryType, 
      { ...metadata, app_user_id: userId },
      userId // Pass app user ID for tracking
    );
  } catch (error) {
    console.error('[Memory] Error storing content in memory:', error);
    return false;
  }
}

/**
 * Ensure a user has a valid Papr Memory user ID
 * This function checks if a user has a Papr user ID and creates one if not
 * @param userId - The app user ID
 * @param apiKey - Papr Memory API key
 * @returns The Papr user ID
 */
export async function ensurePaprUser(
  userId: string,
  apiKey: string,
): Promise<string | null> {
  if (!userId || !apiKey) {
    console.error('[Memory] Missing userId or apiKey for ensurePaprUser');
    return null;
  }

  try {
    // Import the db-related code
    const { db, user, eq } = await import('@/lib/db/queries-minimal');
    
    console.log(`[Memory] Ensuring Papr user for app user: ${userId}`);

    // Check if the user already has a Papr user ID
    const userResult = await db
      .select({ paprUserId: user.paprUserId, email: user.email })
      .from(user)
      .where(eq(user.id, userId));

    if (userResult.length === 0) {
      console.error(`[Memory] No user found with ID ${userId}`);
      return null;
    }

    // If user already has a Papr user ID, return it
    if (userResult[0].paprUserId) {
      console.log(
        `[Memory] User ${userId} already has Papr user ID: ${userResult[0].paprUserId}`,
      );
      return userResult[0].paprUserId;
    }

    console.log(`[Memory] Creating Papr user for app user: ${userId}`);

    const userEmail = userResult.length > 0 ? userResult[0].email : null;

    // Import the createMemoryService function
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    
    // Create a memory service instance instead of direct client
    const memoryService = createMemoryService(apiKey);

    let paprUserId = null;

    try {
      // Create user body params with proper typing
      const createParams = {
        external_id: `PaprChat-user-${userId}`,
        email: userEmail || undefined,
        metadata: {
          source: 'PaprChat',
          app_user_id: userId,
        }
      };

      // We need to use direct API access for user operations since the memory service
      // doesn't expose user-related methods
      const { initPaprMemory } = await import('@/lib/ai/memory');
      const API_BASE_URL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
      const paprClient = initPaprMemory(apiKey, {
        baseURL: API_BASE_URL,
      });

      // Try to create a user in Papr Memory with properly structured parameters
      const userResponse = await paprClient.user.create(createParams);

      // Check if response indicates success and has an ID
      if (!userResponse || !userResponse.user_id) {
        console.error(
          '[Memory] Invalid user creation response:',
          userResponse,
        );
        return null;
      }

      paprUserId = userResponse.user_id;
      console.log(`[Memory] Created Papr Memory user with ID: ${paprUserId}`);

    } catch (createError: any) {
      console.log(`[Memory] User creation failed:`, createError);
      
      // Check if this is a 409 "User already exists" error
      if (createError.status === 409) {
        console.log(`[Memory] User already exists in Papr Memory with email: ${userEmail}`);
        console.log(`[Memory] Attempting to create with different external_id to work around existing user`);
        
        // Try with a timestamp-based external_id to avoid conflicts
        const timestamp = Date.now();
        const alternativeExternalId = `PaprChat-user-${userId}-${timestamp}`;
        
        // We need to use direct API access for user operations
        const { initPaprMemory } = await import('@/lib/ai/memory');
        const API_BASE_URL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
        const paprClient = initPaprMemory(apiKey, {
          baseURL: API_BASE_URL,
        });
        
        try {
          const alternativeUserResponse = await paprClient.user.create({
            external_id: alternativeExternalId,
            email: userEmail ? `${timestamp}-${userEmail}` : undefined, // Use a different email to avoid conflict
            metadata: {
              source: 'PaprChat-Alternative',
              app_user_id: userId,
              original_email: userEmail || null,
              note: 'Created with alternative ID due to existing user conflict'
            },
          });
          
          if (alternativeUserResponse?.user_id) {
            paprUserId = alternativeUserResponse.user_id;
            console.log(`[Memory] Created alternative Papr Memory user with ID: ${paprUserId}`);
          } else {
            console.error(`[Memory] Failed to create alternative Papr Memory user`);
            return null;
          }
        } catch (alternativeError) {
          console.error(`[Memory] Failed to create alternative user:`, alternativeError);
          return null;
        }
      } else {
        // Re-throw non-409 errors
        throw createError;
      }
    }

    if (paprUserId) {
      // Update the user record with the Papr user ID
      await db
        .update(user)
        .set({ paprUserId })
        .where(eq(user.id, userId));

      console.log(`[Memory] Updated local user record with Papr user ID`);
      return paprUserId;
    } else {
      console.error(`[Memory] Failed to obtain Papr user ID`);
      return null;
    }
  } catch (error) {
    console.error('[Memory] Error ensuring Papr user:', error);
    return null;
  }
}
