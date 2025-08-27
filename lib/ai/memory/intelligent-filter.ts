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
      console.log('[Memory Filter] ⏭️ Skipping empty message:', {
        messageId: message.id,
        reason: 'Empty content'
      });
      return null;
    }

    // Skip very short messages that are unlikely to be memorable
    if (messageContent.trim().length < 5) {
      console.log('[Memory Filter] ⏭️ Skipping short message:', {
        messageId: message.id,
        contentLength: messageContent.trim().length,
        content: messageContent,
        reason: 'Too short (< 5 characters)'
      });
      return null;
    }

    // Create the prompt for memory decision
    const systemPrompt = `You are an intelligent memory filter for a chat application. Your job is to determine whether user messages contain information that would be valuable to remember for future conversations.

BE GENEROUS WITH STORAGE - err on the side of storing too much rather than too little. When in doubt, STORE IT.

WHAT TO STORE (be generous):
- User's creative work and projects (stories, code, designs, etc.) - capture WHAT they're working on
- User preferences (UI settings, communication style, coding preferences, etc.)
- Goals and objectives (learning plans, project goals, career aspirations)
- Tasks and reminders (to-dos, deadlines, action items)
- Knowledge and facts (technical information, configurations, personal facts)
- Important context about projects, tools, or workflows
- Questions that reveal user interests or needs
- Domain expertise and professional work (what field they work in, their specialties)
- Creative interests and hobbies (writing, art, music, etc.)
- Technical stack and tools they use
- Learning topics and areas of study
- Any content that reveals the user's work, interests, or ongoing projects
- Follow-up requests that connect to previous work or content

WHAT NOT TO STORE (be restrictive here):
- Pure greetings like "hello" or "hi" with no other content
- Single word responses like "yes", "no", "thanks" with no context
- Obvious spam or nonsensical content

CATEGORIES (choose the PRIMARY category, but extract all relevant aspects):
- preferences: User preferences, settings, styles, personal choices, tool preferences, workflow preferences
- goals: Long-term objectives, learning plans, project goals, creative aspirations, career goals
- tasks: Immediate to-dos, reminders, action items, deadlines, specific requests
- knowledge: Technical facts, configurations, important information, domain expertise, creative work content

CATEGORY SELECTION PRIORITY:
1. If the message reveals long-term aspirations or projects → "goals" 
2. If the message shows consistent patterns or choices → "preferences"
3. If the message contains factual information or expertise → "knowledge" 
4. If the message is an immediate action request → "tasks"

IMPORTANT: Look for the DEEPER MEANING, not just the surface request. A request to "create a document" might actually reveal:
- GOAL: User is working on children's literature
- PREFERENCE: User likes using document tools for iterative editing
- KNOWLEDGE: User understands story structure and editing processes

IMPORTANT: If a message has ANY useful information, context, or could be relevant later, STORE IT. The threshold should be very low.

CONTENT EXTRACTION RULES:
- When users share substantial content (stories, code, documents), store information about their PROJECT and DOMAIN, not just their request
- For follow-up messages, analyze the conversation context to understand what the user is working on
- Extract and store the user's interests, expertise areas, and ongoing work
- Create rich, descriptive content that captures the user's professional/creative context

For content to store, clean it up and make it more searchable while preserving the key information.`;

    const userPrompt = `Analyze this user message and determine if it should be stored in memory:

MESSAGE: "${messageContent}"

${conversationContext ? `CONVERSATION CONTEXT: ${conversationContext}` : ''}

IMPORTANT INSTRUCTIONS:
1. Look at the FULL CONTEXT, not just the immediate message
2. If the user is sharing creative work, code, or substantial content - store information about WHAT they're working on, not just their request
3. Extract the deeper context: What is the user's project? What are they trying to accomplish? What domain are they working in?
4. For follow-up messages, connect them to the broader project context
5. Store rich, descriptive content that will help the AI understand the user's work and interests

Examples:
- If user shares a story and asks for feedback → Category: "goals" → Store: "User is writing children's stories, specifically about [theme]. Current project: [story title/description]"
- If user says "make it shorter" after sharing content → Category: "preferences" → Store: "User prefers concise writing and wants to edit their [type of content] for brevity"
- If user asks to "create a document" for their story → Category: "goals" → Store: "User is working on children's literature project 'Naya and the Brave Blue Bike' and uses document tools for iterative story editing"
- If user shares code and asks questions → Category: "knowledge" → Store: "User is working on [type of project] using [technologies]"

THINK ABOUT CONTEXT: What does this message tell us about the user's bigger picture? Their ongoing projects? Their working style? Their expertise areas?

Focus on capturing the USER'S WORK, INTERESTS, and PROJECTS, not just their immediate requests.

Decide if this message contains information worth remembering for future conversations.`;

    console.log('[Memory Filter] 🤖 Analyzing message with openai/gpt-oss-120b:', {
      messageId: message.id,
      messageLength: messageContent.length,
      messagePreview: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
      hasContext: Boolean(conversationContext),
      contextPreview: conversationContext ? conversationContext.substring(0, 200) + (conversationContext.length > 200 ? '...' : '') : null
    });

    console.log('[Memory Filter] 📝 Full message content:', {
      messageId: message.id,
      content: messageContent,
      conversationContext: conversationContext || 'No context'
    });

    // Use Groq GPT OSS 120B to make the decision
    const result = await generateObject({
      model: myProvider.languageModel('openai/gpt-oss-120b'),
      system: systemPrompt,
      prompt: userPrompt,
      schema: MemoryDecisionSchema,
      maxOutputTokens: 500, // Keep response concise
    });

    console.log('[Memory Filter] 🎯 AI Decision Result:', {
      messageId: message.id,
      shouldStore: result.object.shouldStore,
      category: result.object.category,
      reasoning: result.object.reasoning,
      hasCustomContent: Boolean(result.object.content),
      customContent: result.object.content || null,
      emojiTags: result.object.emoji_tags || [],
      topics: result.object.topics || [],
      hierarchicalStructure: result.object.hierarchical_structure || null
    });

    // Log the full decision object for debugging
    console.log('[Memory Filter] 📊 Complete AI Response:', {
      messageId: message.id,
      fullDecision: result.object
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
      filtered_by: 'openai/gpt-oss-120b'
    }
  };
}
