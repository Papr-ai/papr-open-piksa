/**
 * Chat History Context
 * 
 * Provides recent chat summaries as context for new conversations
 * and handles async processing of unsummarized chats.
 */

import { processConversationCompletion } from './conversation-insights';

interface ChatSummary {
  id: string;
  title: string;
  oneSentenceSummary: string | null;
  createdAt: Date;
}

/**
 * Get recent chat summaries for context in new chats
 */
export async function getRecentChatSummaries(
  userId: string,
  limit: number = 10
): Promise<ChatSummary[]> {
  try {
    const { db, chat, eq, desc } = await import('@/lib/db/queries-minimal');
    
    const recentChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        oneSentenceSummary: chat.oneSentenceSummary,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return recentChats;

  } catch (error) {
    console.error('[Chat History Context] Error fetching recent chats:', error);
    return [];
  }
}

/**
 * Process the most recent unsummarized chat in the background
 */
export async function processUnsummarizedChats(
  userId: string,
  apiKey: string,
  limit: number = 1
): Promise<void> {
  try {
    const { db, chat, message, eq, desc, isNull, and } = await import('@/lib/db/queries-minimal');
    
    // First, find chats without summaries
    const unsummarizedChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(
        and(
          eq(chat.userId, userId),
          isNull(chat.oneSentenceSummary)
        )
      )
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    console.log('[Chat History Context] Unsummarized chats details:', 
      unsummarizedChats.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt
      }))
    );

    console.log('[Chat History Context] Found unsummarized chats:', {
      count: unsummarizedChats.length,
      userId: userId.substring(0, 8) + '...',
      note: 'Processing only the most recent chat (limit=1) with 5+ messages',
      chatTitles: unsummarizedChats.map(c => c.title)
    });

    if (unsummarizedChats.length === 0) {
      console.log('[Chat History Context] No unsummarized chats found - all recent chats already have summaries');
      return;
    }

    // Process each chat in the background
    for (const chatInfo of unsummarizedChats) {
      try {
        // Get ALL messages for this chat
        console.log('[Chat History Context] Fetching messages for chat:', chatInfo.id);
        const messages = await db
          .select({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: message.createdAt,
          })
          .from(message)
          .where(eq(message.chatId, chatInfo.id))
          .orderBy(message.createdAt);
        
        console.log('[Chat History Context] Found messages for chat:', {
          chatId: chatInfo.id,
          messageCount: messages.length,
          title: chatInfo.title,
          messageIds: messages.map(m => m.id.substring(0, 8) + '...'),
          roles: messages.map(m => m.role)
        });

        // Double-check with raw SQL to verify message count
        try {
          const { sql } = await import('drizzle-orm');
          const rawCount = await db.execute(sql`
            SELECT COUNT(*) as count 
            FROM "Message_v2" 
            WHERE "chatId" = ${chatInfo.id}
          `);
          console.log('[Chat History Context] Raw SQL message count verification:', {
            chatId: chatInfo.id,
            rawCount: rawCount[0]?.count || 0,
            drizzleCount: messages.length
          });
        } catch (sqlError) {
          console.log('[Chat History Context] Could not verify with raw SQL:', sqlError);
        }

        // Only process chats with at least 5 messages (shorter chats use title only)
        if (messages.length < 5) {
          console.log('[Chat History Context] Skipping chat with too few messages (title sufficient):', {
            chatId: chatInfo.id,
            messageCount: messages.length,
            title: chatInfo.title
          });
          continue;
        }

        // Convert to UIMessage format with proper typing
        const uiMessages = messages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          parts: msg.parts as any, // Database parts are stored as JSON, cast to match UIMessage parts array
        }));

        console.log('[Chat History Context] Processing most recent unsummarized chat:', {
          chatId: chatInfo.id,
          title: chatInfo.title,
          messageCount: uiMessages.length,
          note: 'Processing 1 chat at a time to avoid token issues'
        });

        // Process in background (don't await)
        processConversationCompletion({
          chatId: chatInfo.id,
          chatTitle: chatInfo.title,
          messages: uiMessages,
          userId,
        }, apiKey).catch(error => {
          console.error('[Chat History Context] Error processing chat:', {
            chatId: chatInfo.id,
            error: error.message,
          });
        });

      } catch (error) {
        console.error('[Chat History Context] Error processing individual chat:', {
          chatId: chatInfo.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

  } catch (error) {
    console.error('[Chat History Context] Error processing unsummarized chats:', error);
  }
}

/**
 * Generate chat history context for system prompt
 */
export function generateChatHistoryContext(chatSummaries: ChatSummary[]): string {
  if (chatSummaries.length === 0) {
    return '';
  }

  const summarizedChats = chatSummaries.filter(chat => chat.oneSentenceSummary);
  const unsummarizedChats = chatSummaries.filter(chat => !chat.oneSentenceSummary);

  // Build context from summarized chats
  const contextLines: string[] = [];
  
  if (summarizedChats.length > 0) {
    contextLines.push(...summarizedChats.map(chat => 
      `- ${chat.title}: ${chat.oneSentenceSummary}`
    ));
  }

  // Add unsummarized chats (use title only for short conversations)
  if (unsummarizedChats.length > 0) {
    contextLines.push(...unsummarizedChats.map(chat => 
      `- ${chat.title}`
    ));
  }

  if (contextLines.length === 0) {
    return '';
  }

  const context = `\n\nRECENT CONVERSATION HISTORY:
The user has had these recent conversations with you:
${contextLines.join('\n')}

Use this context to provide more personalized and relevant assistance. Reference previous work or interests when appropriate.`;

  return context;
}

/**
 * Handle new chat creation - get context and process background tasks
 * Only called when a brand new chat is actually being created (not on first message of existing chat)
 */
export async function handleNewChatCreation(
  userId: string,
  apiKey?: string
): Promise<string> {
  try {
    console.log('[Chat History Context] 🆕 Processing new chat creation for user:', userId.substring(0, 8) + '...');
    
    // Get recent chat summaries for context
    const recentChats = await getRecentChatSummaries(userId);
    
    // Start background processing of the most recent unsummarized chat if API key is available
    if (apiKey && recentChats.some(chat => !chat.oneSentenceSummary)) {
      // Don't await - run in background, process only 1 chat at a time
      processUnsummarizedChats(userId, apiKey, 1).catch(error => {
        console.error('[Chat History Context] Background processing failed:', error);
      });
    }

    // Return chat history context (user context will be handled by getOrCreateChatContext)
    const chatHistoryContext = generateChatHistoryContext(recentChats);
    
    console.log('[Chat History Context] ✅ Generated chat history context for new chat:', {
      recentChatsCount: recentChats.length,
      contextLength: chatHistoryContext.length,
      hasUnsummarized: recentChats.some(chat => !chat.oneSentenceSummary)
    });
    
    return chatHistoryContext;

  } catch (error) {
    console.error('[Chat History Context] Error handling new chat creation:', error);
    return '';
  }
}
