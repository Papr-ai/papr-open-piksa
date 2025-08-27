import { getUserContext, type UserContextData } from './user-context';
import { getChatById, saveChat } from '@/lib/db/queries';
import { generateTitleFromUserMessage } from '@/app/(chat)/actions';
import type { ExtendedUIMessage } from '@/lib/types';

/**
 * Get or create user context for a chat session
 * This function ensures user context is fetched only once per chat and cached in the database
 */
export async function getOrCreateChatContext(
  chatId: string,
  userId: string,
  messages?: ExtendedUIMessage[]
): Promise<{
  chatExists: boolean;
  userContext: UserContextData;
  contextString: string;
}> {
  const memoryApiKey = process.env.PAPR_MEMORY_API_KEY;
  
  // Default empty context
  const emptyContext: UserContextData = {
    preferences: [],
    insights: [],
    goals: [],
    patterns: [],
    context: ''
  };

  try {
    console.log('[Chat Context] Getting or creating context for chat:', chatId);
    
    // Check if chat exists and has cached context
    const existingChat = await getChatById({ id: chatId });
    
    if (existingChat) {
      console.log('[Chat Context] Chat exists, checking for cached context...');
      
      if (existingChat.userContext) {
        console.log('[Chat Context] Found cached user context, parsing...');
        try {
          const cachedContext = JSON.parse(existingChat.userContext) as UserContextData;
          console.log('[Chat Context] ✅ Using cached context from database:');
          console.log('='.repeat(60));
          console.log(cachedContext.context);
          console.log('='.repeat(60));
          return {
            chatExists: true,
            userContext: cachedContext,
            contextString: cachedContext.context
          };
        } catch (parseError) {
          console.error('[Chat Context] Error parsing cached context, will re-fetch:', parseError);
        }
      } else {
        console.log('[Chat Context] No cached context found, will fetch fresh');
      }
      
      // Chat exists but no context cached - fetch and update
      if (memoryApiKey) {
        console.log('[Chat Context] Fetching fresh user context...');
        const userContext = await getUserContext(userId, memoryApiKey);
        
        if (userContext.context) {
          // Update the chat with the new context
          try {
            await saveChat({
              id: chatId,
              userId,
              title: existingChat.title,
              userContext: JSON.stringify(userContext)
            });
            console.log('[Chat Context] ✅ Updated existing chat with fresh context:');
            console.log('='.repeat(60));
            console.log(userContext.context);
            console.log('='.repeat(60));
          } catch (updateError) {
            console.error('[Chat Context] Failed to update chat with context:', updateError);
          }
        }
        
        return {
          chatExists: true,
          userContext,
          contextString: userContext.context
        };
      } else {
        console.log('[Chat Context] No memory API key - using empty context');
        return {
          chatExists: true,
          userContext: emptyContext,
          contextString: ''
        };
      }
    }
    
    // Chat doesn't exist - create it with context
    console.log('[Chat Context] Chat does not exist, creating new chat with context...');
    
    let userContext = emptyContext;
    if (memoryApiKey) {
      console.log('[Chat Context] Fetching user context for new chat...');
      userContext = await getUserContext(userId, memoryApiKey);
    }
    
    // Generate title for new chat
    const userMessage = messages?.find(m => m.role === 'user');
    const title = userMessage 
      ? await generateTitleFromUserMessage({ message: userMessage })
      : 'New Chat';
    
    // Create chat with context
    await saveChat({
      id: chatId,
      userId,
      title,
      userContext: JSON.stringify(userContext)
    });
    
    console.log('[Chat Context] ✅ Created new chat with context:', {
      chatId,
      title,
      hasContext: userContext.context.length > 0
    });
    
    if (userContext.context) {
      console.log('[Chat Context] New chat context:');
      console.log('='.repeat(60));
      console.log(userContext.context);
      console.log('='.repeat(60));
    }
    
    return {
      chatExists: false,
      userContext,
      contextString: userContext.context
    };
    
  } catch (error) {
    console.error('[Chat Context] Error getting or creating chat context:', error);
    return {
      chatExists: false,
      userContext: emptyContext,
      contextString: ''
    };
  }
}

/**
 * Get user context for an existing chat (used by voice API)
 */
export async function getChatUserContext(chatId: string): Promise<string> {
  try {
    console.log('[Chat Context] getChatUserContext called for chat:', chatId);
    const chat = await getChatById({ id: chatId });
    
    console.log('[Chat Context] Chat lookup result:', {
      chatFound: !!chat,
      hasUserContext: !!(chat?.userContext),
      chatTitle: chat?.title,
      userContextLength: chat?.userContext?.length || 0
    });
    
    if (chat?.userContext) {
      try {
        const userContext = JSON.parse(chat.userContext) as UserContextData;
        console.log('[Chat Context] ✅ Successfully parsed cached context:', {
          contextLength: userContext.context.length,
          hasPreferences: userContext.preferences.length > 0,
          hasGoals: userContext.goals.length > 0
        });
        return userContext.context;
      } catch (parseError) {
        console.error('[Chat Context] Error parsing chat context:', parseError);
      }
    } else {
      console.log('[Chat Context] ❌ No userContext found in chat record');
    }
    
    return '';
  } catch (error) {
    console.error('[Chat Context] Error getting chat user context:', error);
    return '';
  }
}
