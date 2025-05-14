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
    if (!apiKey) {
      return ''; // If no API key, return empty string
    }

    const memoryService = createMemoryService(apiKey);

    // Get the most recent user message to search for relevant memories
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!latestUserMessage) {
      return '';
    }

    // Extract query from message parts
    const query = latestUserMessage.parts
      .map((part) => (typeof part === 'string' ? part : ''))
      .join(' ')
      .trim();

    if (!query) {
      return '';
    }

    // Search for relevant memories
    const memories = await memoryService.searchMemories(userId, query);

    // Format memories as a prompt addition
    return memoryService.formatMemoriesForPrompt(memories);
  } catch (error) {
    console.error('Error enhancing prompt with memories:', error);
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
}): Promise<void> {
  if (!apiKey) {
    return; // If no API key, do nothing
  }

  try {
    const memoryService = createMemoryService(apiKey);
    await memoryService.storeMessage(userId, chatId, message);
  } catch (error) {
    console.error('Error storing message in memory:', error);
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
      return basePrompt;
    }

    // Enhance with memories
    const memoryPrompt = await enhancePromptWithMemories({
      userId,
      messages,
      apiKey,
    });

    // Combine the prompts
    if (memoryPrompt) {
      return `${basePrompt}\n\n${memoryPrompt}`;
    }

    return basePrompt;
  };
}
