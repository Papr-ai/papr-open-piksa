/**
 * Intelligent Memory Filter
 * 
 * Uses Groq GPT OSS 120B to intelligently determine if user messages
 * should be stored in memory and automatically categorize them.
 */

import { generateObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';
import type { UIMessage } from 'ai';

// Schema for memory decision
const MemoryDecisionSchema = z.object({
  shouldStore: z.boolean().describe('Whether this message contains information worth storing in memory'),
  category: z.enum(['preferences', 'goals', 'tasks', 'knowledge']).optional().describe('The category of memory if shouldStore is true'),
  reasoning: z.string().describe('Brief explanation of why this should or should not be stored'),
  content: z.string().optional().describe('Cleaned/summarized version of the content to store (if different from original)'),
  emoji_tags: z.array(z.string()).optional().describe('2-4 relevant emoji tags that represent this memory'),
  topics: z.array(z.string()).optional().describe('List of topics related to this memory for better search'),
  hierarchical_structure: z.string().optional().describe('Hierarchical path like "preferences/ui/theme" or "knowledge/api/endpoints"'),
});

type MemoryDecision = z.infer<typeof MemoryDecisionSchema>;

interface MemoryFilterOptions {
  apiKey: string;
  userId: string;
  chatId: string;
  message: UIMessage;
  conversationContext?: string; // Optional context from recent messages
}

/**
 * Intelligently filters user messages to determine if they should be stored in memory
 */
export async function filterMessageForMemory({
  apiKey,
  userId,
  chatId,
  message,
  conversationContext = '',
}: MemoryFilterOptions): Promise<MemoryDecision | null> {
  try {
    // Extract message content
    let messageContent = '';
    if ('content' in message && message.content) {
      messageContent = String(message.content);
    } else if (message.parts) {
      messageContent = message.parts
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

    // Skip empty messages
    if (!messageContent || messageContent.trim().length === 0) {
      return null;
    }

    // Skip very short messages that are unlikely to be memorable
    if (messageContent.trim().length < 10) {
      return null;
    }

    // Create the prompt for memory decision
    const systemPrompt = `You are an intelligent memory filter for a chat application. Your job is to determine whether user messages contain information that would be valuable to remember for future conversations.

WHAT TO STORE:
- User preferences (UI settings, communication style, coding preferences, etc.)
- Goals and objectives (learning plans, project goals, career aspirations)
- Tasks and reminders (to-dos, deadlines, action items)
- Knowledge and facts (technical information, configurations, personal facts)
- Important context about projects, tools, or workflows

WHAT NOT TO STORE:
- Casual conversation or small talk
- Simple questions without context
- Temporary requests or one-off queries
- Purely reactive responses like "yes", "no", "thanks"
- Debugging steps unless they reveal preferences or important patterns

CATEGORIES:
- preferences: User preferences, settings, styles, personal choices
- goals: Long-term objectives, learning plans, project goals
- tasks: To-dos, reminders, action items, deadlines
- knowledge: Technical facts, configurations, important information

For content to store, clean it up and make it more searchable while preserving the key information.`;

    const userPrompt = `Analyze this user message and determine if it should be stored in memory:

MESSAGE: "${messageContent}"

${conversationContext ? `CONVERSATION CONTEXT: ${conversationContext}` : ''}

Decide if this message contains information worth remembering for future conversations.`;

    console.log('[Memory Filter] Analyzing message with GPT OSS 120B:', {
      messageLength: messageContent.length,
      messagePreview: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
      hasContext: Boolean(conversationContext),
    });

    // Use Groq GPT OSS 120B to make the decision
    const result = await generateObject({
      model: myProvider.languageModel('gpt-oss-120b-128k'),
      system: systemPrompt,
      prompt: userPrompt,
      schema: MemoryDecisionSchema,
      maxOutputTokens: 500, // Keep response concise
    });

    console.log('[Memory Filter] Decision result:', {
      shouldStore: result.object.shouldStore,
      category: result.object.category,
      reasoning: result.object.reasoning,
      hasCustomContent: Boolean(result.object.content),
    });

    return result.object;

  } catch (error) {
    console.error('[Memory Filter] Error filtering message:', error);
    // Return null on error - don't store if we can't properly analyze
    return null;
  }
}

/**
 * Helper function to get recent conversation context for better filtering decisions
 */
export function extractConversationContext(messages: UIMessage[], maxMessages: number = 3): string {
  if (!messages || messages.length === 0) {
    return '';
  }

  // Get the last few messages for context (excluding the current message)
  const recentMessages = messages
    .slice(-maxMessages - 1, -1) // Exclude the last message (current one)
    .map((msg) => {
      let content = '';
      if ('content' in msg && msg.content) {
        content = String(msg.content);
      } else if (msg.parts) {
        content = msg.parts
          .map((part) => {
            if (typeof part === 'string') return part;
            if (typeof part === 'object' && 'text' in part) return part.text;
            return '';
          })
          .join(' ')
          .trim();
      }
      
      return `${msg.role}: ${content}`;
    })
    .filter(msg => msg.length > 0);

  return recentMessages.join('\n');
}

/**
 * Convert memory decision to memory metadata format
 */
export function convertDecisionToMetadata(decision: MemoryDecision, userId: string, chatId: string) {
  if (!decision.shouldStore || !decision.category) {
    return null;
  }

  return {
    sourceType: 'PaprChat',
    external_user_id: userId,
    createdAt: new Date().toISOString(),
    topics: decision.topics || [],
    'emoji tags': decision.emoji_tags || [],
    hierarchical_structures: decision.hierarchical_structure || decision.category,
    sourceUrl: `/chat/${chatId}`,
    conversationId: chatId,
    customMetadata: {
      category: decision.category,
      app_user_id: userId,
      tool: 'intelligent_filter',
      reasoning: decision.reasoning,
      filtered_by: 'gpt-oss-120b-128k'
    }
  };
}
