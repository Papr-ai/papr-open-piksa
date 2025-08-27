import type { UIMessage } from 'ai';
import type { Chat } from '@/lib/db/schema';
import { generateContextualInstructions, type UserContextData } from './memory/user-context';
import { getChatUserContext } from './memory/chat-context';

/**
 * Helper function to extract message content from UIMessage
 */
function extractMessageContent(message: UIMessage): string {
  let content = '';
  
  // First try the legacy content property
  if ('content' in message && message.content) {
    content = String(message.content);
  } 
  // Then try the parts array (newer format)
  else if (message.parts && Array.isArray(message.parts)) {
    content = message.parts
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'object' && part !== null) {
          // Handle text parts specifically
          if (part.type === 'text' && part.text) {
            return part.text;
          }
          // Handle other content types
          if ('text' in part) return part.text;
          if ('content' in part) return part.content;
          // Skip non-text parts like tool calls, attachments
          if (part.type === 'tool-call' || part.type === 'tool-result') {
            return ''; // Don't include tool calls in context
          }
          return '';
        }
        return '';
      })
      .filter(text => text.trim().length > 0) // Remove empty strings
      .join(' ')
      .trim();
  }
  
  return content;
}

/**
 * Generate a concise chat history summary for voice session context
 */
export function generateVoiceChatContext(messages: UIMessage[], maxMessages: number = 10): string {
  if (!messages || messages.length === 0) {
    return "This is the start of a new conversation.";
  }

  // Take the most recent messages (excluding the current voice session)
  const recentMessages = messages.slice(-maxMessages);
  
  if (recentMessages.length === 0) {
    return "This is the start of a new conversation.";
  }

  // Create a concise conversation history
  const conversationHistory = recentMessages
    .map(msg => {
      const content = extractMessageContent(msg);
      console.log('[Voice Context] Extracted content for', msg.role + ':', content);
      const truncatedContent = content.length > 150 
        ? content.substring(0, 150) + '...' 
        : content;
      return `${msg.role}: ${truncatedContent}`;
    })
    .filter(line => line.split(': ')[1]?.trim().length > 0) // Only include messages with actual content
    .join('\n');

  // Generate context summary
  const contextSummary = `Previous conversation context (last ${recentMessages.length} messages):

${conversationHistory}

---
Continue this conversation naturally in voice format. Reference previous context when relevant, but focus on the current voice interaction. Be conversational and natural in your speech.`;

  return contextSummary;
}

/**
 * Generate recent chat history context from provided chat data
 */
function generateRecentChatHistory(recentChats: Chat[], currentChatId: string, limit: number = 8): string {
  console.log('[Voice Context] generateRecentChatHistory called with:', {
    totalChats: recentChats.length,
    currentChatId,
    limit
  });
  
  // Filter out current chat and include chats with titles (summaries preferred but not required)
  const filteredChats = recentChats
    .filter(chat => chat.id !== currentChatId && chat.title) // Only require title
    .slice(0, limit);

  console.log('[Voice Context] Filtered chats:', filteredChats.map(chat => ({
    id: chat.id,
    title: chat.title,
    oneSentenceSummary: chat.oneSentenceSummary,
    hasTitle: !!chat.title,
    hasSummary: !!chat.oneSentenceSummary
  })));

  if (filteredChats.length === 0) {
    console.log('[Voice Context] No filtered chats available for recent history');
    return '';
  }

  const chatSummaries = filteredChats
    .map(chat => {
      const summary = chat.oneSentenceSummary || 'Previous conversation';
      const date = new Date(chat.createdAt).toLocaleDateString();
      const line = `- "${chat.title}" (${date}): ${summary}`;
      console.log('[Voice Context] Generated chat summary line:', line);
      return line;
    })
    .join('\n');

  const result = `Recent conversation history:
${chatSummaries}

---`;
  
  console.log('[Voice Context] Final recent chat history context:', result);
  return result;
}

/**
 * Generate session instructions with chat context for OpenAI Realtime API
 */
export async function generateVoiceSessionInstructions(
  messages: UIMessage[], 
  chatId: string,
  recentChats?: Chat[],
  additionalInstructions?: string
): Promise<string> {
  console.log('[Voice Context] Generating instructions for chat:', chatId, 'with', messages?.length || 0, 'messages');
  console.log('[Voice Context] Recent chats received:', recentChats?.length || 0);
  
  const chatContext = generateVoiceChatContext(messages);
  
  // Generate recent chat history if provided
  let recentChatHistory = '';
  if (recentChats && recentChats.length > 0) {
    recentChatHistory = generateRecentChatHistory(recentChats, chatId);
    console.log('[Voice Context] Recent chat history generated:', recentChatHistory.length > 0 ? 'Success' : 'Empty');
  } else {
    console.log('[Voice Context] No recent chats provided');
  }
  
  // Get cached user context from chat
  let userContextString = '';
  console.log('[Voice Context] Fetching cached user context from chat...');
  userContextString = await getChatUserContext(chatId);
  
  if (userContextString) {
    console.log('[Voice Context] ✅ Found cached user context:', {
      contextLength: userContextString.length
    });
    console.log('[Voice Context] Cached context being used for voice:');
    console.log('='.repeat(60));
    console.log(userContextString);
    console.log('='.repeat(60));
  } else {
    console.log('[Voice Context] No cached user context found');
  }
  
  // Create UserContextData object for generateContextualInstructions
  const userContext: UserContextData = {
    preferences: [],
    insights: [],
    goals: [],
    patterns: [],
    context: userContextString
  };
  
  console.log('[Voice Context] Generated context:', chatContext.substring(0, 200) + '...');
  
  let finalInstructions = `You are a helpful AI assistant engaging in a voice conversation. 

Key guidelines for voice interaction:
- Speak naturally and conversationally
- Keep responses concise but helpful
- Use a friendly, professional tone
- Acknowledge when referencing previous conversation points
- Ask clarifying questions when needed

${recentChatHistory}

${chatContext}

${additionalInstructions || ''}

Remember: This is a live voice conversation, so be responsive and engaging while maintaining the context from our previous discussion and any relevant information from recent conversations.`;

  // Always add user context if available
  if (userContextString) {
    console.log('[Voice Context] Adding user context to voice instructions');
    finalInstructions += `\n\n${userContextString}`;
  }
  
  // Add memory-aware instructions if memory API is available
  const memoryApiKey = process.env.PAPR_MEMORY_API_KEY;
  if (memoryApiKey) {
    console.log('[Voice Context] Adding memory-aware instructions with FUNCTION CALLING');
    finalInstructions += `\n\n
MEMORY TOOLS AVAILABLE:
You have access to memory tools that you can use during this voice conversation:

1. **searchMemories(query)** - Search through the user's memories for relevant information
   - Use this when the user asks about past conversations, preferences, or information they've shared before
   - Example: User asks "What did I tell you about my coding preferences?" → Call searchMemories with a detailed query

2. **addMemory(content, category)** - Save important information to the user's memories
   - Use this when the user shares preferences, goals, or important information worth remembering
   - Categories: 'preferences', 'goals', 'tasks', 'knowledge'
   - Example: User says "Remember that I prefer TypeScript" → Call addMemory with content and category 'preferences'

IMPORTANT: You can and should use these tools during voice conversations. When the user asks about memories or shares important information, actively use these functions to search or save memories.

The user context above includes some relevant information from their memories, but you can search for more specific information using the searchMemories tool when needed.`;
  }

  console.log('[Voice Context] Final instructions length:', finalInstructions.length);
  console.log('[Voice Context] Final voice instructions being sent to OpenAI:');
  console.log('='.repeat(80));
  console.log(finalInstructions);
  console.log('='.repeat(80));
  
  return finalInstructions;
}
