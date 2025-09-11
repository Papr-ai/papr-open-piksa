/**
 * Conversation Insights and Summarization
 * 
 * This module handles end-of-conversation analysis, extracting insights,
 * summaries, and key information from completed conversations.
 */

import { generateObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { z } from 'zod';
import type { UIMessage } from 'ai';
import { storeContentInMemory } from '@/lib/ai/memory/middleware';

// Schema for conversation insights - flexible limits
const ConversationInsightsSchema = z.object({
  oneLineSummary: z.string().min(10).max(400).describe('Concise summary of the conversation'),
  longerSummary: z.string().min(20).max(1000).describe('Detailed summary with key points'),
  keyInsights: z.array(z.string()).min(1).max(8).describe('Key insights from the conversation'),
  userGoals: z.array(z.string()).min(0).max(8).describe('User goals mentioned or implied'),
  userPreferences: z.array(z.string()).min(0).max(8).describe('User preferences discovered'),
  topicsDiscussed: z.array(z.string()).min(1).max(10).describe('Main topics covered'),
  actionItems: z.array(z.string()).min(0).max(8).describe('Action items or next steps'),
  userExpertise: z.array(z.string()).min(0).max(8).describe('User expertise areas shown'),
  toolsUsed: z.array(z.string()).min(0).max(15).describe('Tools used in the conversation'),
  conversationType: z.enum(['creative', 'technical', 'planning', 'learning', 'problem-solving', 'casual', 'mixed']).describe('Primary conversation type'),
});

type ConversationInsights = z.infer<typeof ConversationInsightsSchema>;

// Type for the insights stored in the database
interface StoredInsights {
  chunkedSummaries?: Record<string, ConversationInsights>;
  latestSummary?: {
    messageCount: number;
    oneLineSummary: string;
    longerSummary: string;
    conversationType: string;
  };
  [key: string]: any; // Allow other properties
}

interface ConversationData {
  chatId: string;
  chatTitle?: string | undefined;
  messages: UIMessage[];
  userId: string;
}

/**
 * Analyze a completed conversation and extract insights
 */
/**
 * Analyze the most recent 15 messages of a conversation
 */
export async function analyzeConversation(
  conversationData: ConversationData,
  apiKey: string
): Promise<ConversationInsights | null> {
  try {
    const { messages, chatTitle } = conversationData;
    
    // Always analyze the most recent 15 messages
    const recentMessages = messages.slice(-15);
    const messageCount = messages.length;
    
    console.log(`[Conversation Insights] Analyzing most recent 15 messages (total: ${messageCount})`);
    
    // Extract text content from recent messages
    const conversationText = recentMessages
      .map((msg, index) => {
        const content = extractMessageContent(msg);
        const messageNumber = messageCount - 15 + index + 1;
        return `[${messageNumber}] ${msg.role}: ${content}`;
      })
      .join('\n\n');

    // Limit conversation length for analysis (max ~2500 characters)
    const truncatedConversation = conversationText.length > 2500 
      ? conversationText.substring(0, 2500) + '\n\n[...truncated...]'
      : conversationText;

    console.log('[Conversation Insights] Analyzing conversation:', {
      chatId: conversationData.chatId,
      messageCount: messages.length,
      textLength: conversationText.length,
      title: chatTitle,
      model: 'gpt-5-mini'
    });

    const systemPrompt = `Extract insights from the most recent 15 messages of this ${messageCount}-message conversation. Be thorough but concise:

- oneLineSummary: Brief overview of recent activity (10-400 chars)
- longerSummary: Detailed summary of recent interactions (20-1000 chars)
- keyInsights: Important discoveries from recent messages (1-8 items)
- userGoals: What the user wants to achieve (0-8 items)
- userPreferences: User's stated or implied preferences (0-8 items)
- topicsDiscussed: Main subjects covered recently (1-10 items)
- actionItems: Next steps or tasks mentioned (0-8 items)
- userExpertise: Skills or knowledge areas shown (0-8 items)
- toolsUsed: Tools utilized in recent messages (0-15 items)

Focus on quality over quantity. Include what's relevant and meaningful from this recent conversation segment. These are flexible limits - prioritize completeness and accuracy over strict length constraints.`;

    const userPrompt = `Title: ${chatTitle || 'Untitled'}

Conversation:
${truncatedConversation}

Extract key insights, goals, preferences, expertise, and outcomes. Be concise and stay within limits.`;

    const result = await generateObject({
      model: myProvider.languageModel('gpt-5-mini'),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ConversationInsightsSchema,
      maxOutputTokens: 2500, // Increased from 300 to prevent length truncation
    });

    console.log('[Conversation Insights] Analysis complete:', {
      chatId: conversationData.chatId,
      conversationType: result.object.conversationType,
      insightsCount: result.object.keyInsights.length,
      goalsCount: result.object.userGoals.length,
    });

    return result.object;

  } catch (error) {
    console.error('[Conversation Insights] Error analyzing conversation:', error);
    return null;
  }
}

/**
 * Store conversation insights in memory and update chat table
 */
export async function storeConversationInsights(
  insights: ConversationInsights,
  conversationData: ConversationData,
  apiKey: string
): Promise<boolean> {
  try {
    const { chatId, chatTitle, userId } = conversationData;

    // Create comprehensive memory content
    const memoryContent = `CONVERSATION SUMMARY: ${chatTitle || 'Untitled Chat'}

ONE-LINE SUMMARY: ${insights.oneLineSummary}

DETAILED SUMMARY:
${insights.longerSummary}

KEY INSIGHTS:
${insights.keyInsights.map(insight => `• ${insight}`).join('\n')}

USER GOALS REVEALED:
${insights.userGoals.map(goal => `• ${goal}`).join('\n')}

USER PREFERENCES:
${insights.userPreferences.map(pref => `• ${pref}`).join('\n')}

USER EXPERTISE DEMONSTRATED:
${insights.userExpertise.map(exp => `• ${exp}`).join('\n')}

ACTION ITEMS:
${insights.actionItems.map(action => `• ${action}`).join('\n')}

TOOLS USED: ${insights.toolsUsed.join(', ')}
CONVERSATION TYPE: ${insights.conversationType}`;

    // Store in memory with rich metadata
    const success = await storeContentInMemory({
      userId,
      content: memoryContent,
      type: 'text',
      metadata: {
        sourceType: 'PaprChat_ConversationSummary',
        chatId,
        chatTitle: chatTitle || 'Untitled',
        conversationType: insights.conversationType,
        messageCount: conversationData.messages.length,
        topics: insights.topicsDiscussed,
        createdAt: new Date().toISOString(),
        hierarchical_structures: `conversations/${insights.conversationType}`,
        customMetadata: {
          oneLineSummary: insights.oneLineSummary,
          toolsUsed: insights.toolsUsed,
          keyInsightsCount: insights.keyInsights.length,
          userGoalsCount: insights.userGoals.length,
        }
      },
      apiKey,
    });

    if (success) {
      console.log('[Conversation Insights] Successfully stored conversation summary in memory:', {
        chatId,
        conversationType: insights.conversationType,
        contentLength: memoryContent.length,
      });
    }

    // Also store in chat table with chunked summaries
    try {
      const { db, chat, eq } = await import('@/lib/db/queries-minimal');
      const messageCount = conversationData.messages.length;
      const chunkKey = messageCount.toString();
      
      // Get existing insights to preserve previous chunks
      const existingChat = await db.select({ insights: chat.insights }).from(chat).where(eq(chat.id, chatId)).limit(1);
      const existingInsights = (existingChat[0]?.insights as StoredInsights) || {};
      const existingChunkedSummaries = existingInsights.chunkedSummaries || {};
      
      // Add new chunk summary
      const updatedChunkedSummaries = {
        ...existingChunkedSummaries,
        [chunkKey]: {
          oneLineSummary: insights.oneLineSummary,
          longerSummary: insights.longerSummary,
          keyInsights: insights.keyInsights,
          userGoals: insights.userGoals,
          userPreferences: insights.userPreferences,
          topicsDiscussed: insights.topicsDiscussed,
          actionItems: insights.actionItems,
          userExpertise: insights.userExpertise,
          toolsUsed: insights.toolsUsed,
          conversationType: insights.conversationType,
          analyzedAt: new Date().toISOString(),
        }
      };
      
      await db
        .update(chat)
        .set({
          oneSentenceSummary: insights.oneLineSummary, // Keep latest for backward compatibility
          fullSummary: insights.longerSummary, // Keep latest for backward compatibility
          insights: {
            ...existingInsights,
            chunkedSummaries: updatedChunkedSummaries,
            // Keep latest summary at top level for quick access
            latestSummary: {
              messageCount,
              oneLineSummary: insights.oneLineSummary,
              longerSummary: insights.longerSummary,
              conversationType: insights.conversationType,
            }
          },
        })
        .where(eq(chat.id, chatId));

      console.log('[Conversation Insights] Successfully updated chat table with chunked insights:', {
        chatId,
        chunkKey,
        totalChunks: Object.keys(updatedChunkedSummaries).length,
        oneLineSummary: insights.oneLineSummary.substring(0, 100) + '...',
      });
    } catch (dbError) {
      console.error('[Conversation Insights] Error updating chat table:', dbError);
      // Don't fail the whole operation if DB update fails
    }

    return success;

  } catch (error) {
    console.error('[Conversation Insights] Error storing conversation insights:', error);
    return false;
  }
}

/**
 * Helper function to extract text content from a message
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
  
  // Limit individual message content length
  return content.length > 1000 ? content.substring(0, 1000) + '...' : content;
}

/**
 * Check if a conversation should be analyzed at specific message counts (15, 30, 45, etc.)
 */
export function shouldAnalyzeConversation(
  messages: UIMessage[],
  existingChunkedSummaries?: Record<string, any>
): boolean {
  const messageCount = messages.length;
  
  // Check if we've reached a multiple of 15 messages
  if (messageCount < 15 || messageCount % 15 !== 0) {
    return false;
  }
  
  // Check if we already have a summary for this chunk
  const chunkKey = messageCount.toString();
  if (existingChunkedSummaries && existingChunkedSummaries[chunkKey]) {
    console.log(`[Conversation Insights] Already have summary for ${messageCount} messages, skipping`);
    return false;
  }
  
  console.log(`[Conversation Insights] Should analyze: ${messageCount} messages reached, no existing summary`);
  return true;
}

/**
 * Process conversation completion - analyze and store insights at 15, 30, 45 message intervals
 */
export async function processConversationCompletion(
  conversationData: ConversationData,
  apiKey: string
): Promise<boolean> {
  try {
    const { messages, chatId } = conversationData;
    
    // First, get existing chunked summaries from the chat table
    let existingChunkedSummaries = {};
    try {
      const { db, chat, eq } = await import('@/lib/db/queries-minimal');
      const existingChat = await db.select({ insights: chat.insights }).from(chat).where(eq(chat.id, chatId)).limit(1);
      existingChunkedSummaries = (existingChat[0]?.insights as StoredInsights)?.chunkedSummaries || {};
    } catch (dbError) {
      console.warn('[Conversation Insights] Could not fetch existing summaries:', dbError);
    }
    
    console.log('[Conversation Insights] Processing conversation completion:', {
      chatId,
      messageCount: messages.length,
      existingChunks: Object.keys(existingChunkedSummaries),
      strategy: 'simple chunked analysis (15, 30, 45, etc.)'
    });

    // Check if we should analyze (at 15, 30, 45, etc. and not already done)
    if (!shouldAnalyzeConversation(messages, existingChunkedSummaries)) {
      console.log('[Conversation Insights] No analysis needed at this time');
      return true; // Not an error, just nothing to do
    }

    // Analyze the most recent 15 messages
    const insights = await analyzeConversation(conversationData, apiKey);
    if (!insights) {
      console.warn('[Conversation Insights] Failed to analyze conversation');
      return false;
    }

    // Store insights with chunked format
    const success = await storeConversationInsights(insights, conversationData, apiKey);
    
    return success;

  } catch (error) {
    console.error('[Conversation Insights] Error processing conversation completion:', error);
    return false;
  }
}
