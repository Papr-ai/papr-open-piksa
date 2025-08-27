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

// Schema for conversation insights
const ConversationInsightsSchema = z.object({
  oneLineSummary: z.string().max(100).describe('One sentence summary'),
  longerSummary: z.string().max(300).describe('2 sentence detailed summary'),
  keyInsights: z.array(z.string()).max(2).describe('Top 2 insights'),
  userGoals: z.array(z.string()).max(2).describe('User goals'),
  userPreferences: z.array(z.string()).max(2).describe('User preferences'),
  topicsDiscussed: z.array(z.string()).max(3).describe('Main topics'),
  actionItems: z.array(z.string()).max(2).describe('Action items'),
  userExpertise: z.array(z.string()).max(2).describe('User expertise'),
  toolsUsed: z.array(z.string()).max(3).describe('Tools used'),
  conversationType: z.enum(['creative', 'technical', 'planning', 'learning', 'problem-solving', 'casual', 'mixed']).describe('Type'),
});

type ConversationInsights = z.infer<typeof ConversationInsightsSchema>;

interface ConversationData {
  chatId: string;
  chatTitle?: string | undefined;
  messages: UIMessage[];
  userId: string;
}

/**
 * Analyze a completed conversation and extract insights
 */
export async function analyzeConversation(
  conversationData: ConversationData,
  apiKey: string
): Promise<ConversationInsights | null> {
  try {
    const { messages, chatTitle } = conversationData;
    
    // Extract text content from messages
    const conversationText = messages
      .map((msg, index) => {
        const content = extractMessageContent(msg);
        return `[${index + 1}] ${msg.role}: ${content}`;
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

    const systemPrompt = `Extract insights from conversation. Be very concise.`;

    const userPrompt = `${chatTitle || 'Untitled'}

${truncatedConversation}

Extract: goals, preferences, expertise, outcomes.`;

    const result = await generateObject({
      model: myProvider.languageModel('gpt-5-mini'),
      system: systemPrompt,
      prompt: userPrompt,
      schema: ConversationInsightsSchema,
      maxOutputTokens: 300,
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
      type: 'conversation_summary',
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

    // Also store in chat table for quick access
    try {
      const { db, chat, eq } = await import('@/lib/db/queries-minimal');
      await db
        .update(chat)
        .set({
          oneSentenceSummary: insights.oneLineSummary,
          fullSummary: insights.longerSummary,
          insights: {
            keyInsights: insights.keyInsights,
            userGoals: insights.userGoals,
            userPreferences: insights.userPreferences,
            topicsDiscussed: insights.topicsDiscussed,
            actionItems: insights.actionItems,
            userExpertise: insights.userExpertise,
            toolsUsed: insights.toolsUsed,
            conversationType: insights.conversationType,
          },
        })
        .where(eq(chat.id, chatId));

      console.log('[Conversation Insights] Successfully updated chat table with insights:', {
        chatId,
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
          if (part.type === 'text' && 'text' in part) return (part as any).text;
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
 * Check if a conversation should be analyzed (15+ messages or new chat started)
 */
export function shouldAnalyzeConversation(
  messages: UIMessage[],
  isNewChat: boolean = false
): boolean {
  // Only analyze substantial conversations (5+ messages) or when reaching 15+ messages
  // For shorter conversations, the title is sufficient context
  const meaningfulMessages = messages.filter(msg => {
    const content = extractMessageContent(msg);
    return content.length > 10; // More than just greetings
  });
  
  return messages.length >= 15 || (isNewChat && meaningfulMessages.length >= 5);
}

/**
 * Process conversation completion - analyze and store insights
 */
export async function processConversationCompletion(
  conversationData: ConversationData,
  apiKey: string
): Promise<boolean> {
  try {
    console.log('[Conversation Insights] Processing conversation completion:', {
      chatId: conversationData.chatId,
      messageCount: conversationData.messages.length,
    });

    // Analyze the conversation
    const insights = await analyzeConversation(conversationData, apiKey);
    if (!insights) {
      console.warn('[Conversation Insights] Failed to analyze conversation');
      return false;
    }

    // Store insights in memory
    const success = await storeConversationInsights(insights, conversationData, apiKey);
    
    return success;

  } catch (error) {
    console.error('[Conversation Insights] Error processing conversation completion:', error);
    return false;
  }
}
