import { auth } from '@/app/(auth)/auth';
import { Papr } from '@papr/memory';
import { initPaprMemory } from '@/lib/ai/memory';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import { z } from 'zod';
import { tool } from 'ai';
import type { DataStreamWriter, Tool } from 'ai';
import type { Session } from 'next-auth';
import { createMemoryService } from '@/lib/ai/memory/service';
import type { MemoryMetadata } from '@papr/memory/resources/memory';

// Define the category enum
const MemoryCategory = z.enum(['preferences', 'goals', 'tasks', 'knowledge']);
type MemoryCategoryType = z.infer<typeof MemoryCategory>;

interface AddMemoryProps {
  session: Session;
  dataStream: DataStreamWriter;
}

/**
 * Create a memory addition tool that matches the Tool type
 */
export const addMemory = ({ session, dataStream }: AddMemoryProps): Tool => {
  return tool({
    description: 'Add important information to user memory for future reference',
    parameters: z.object({
      content: z.string().describe('The content of the memory to add, should be specific and detailed enough for future retrieval'),
      category: MemoryCategory.describe('The category of memory: preferences (user preferences, style, etc), goals (long-term objectives), tasks (to-dos, reminders), or knowledge (technical facts, configurations)'),
      type: z.enum(['text', 'code_snippet', 'document']).default('text').describe('The type of memory content'),
      emoji_tags: z.array(z.string()).optional().describe('List of emoji tags that represent this memory (e.g. ["👤", "⚙️", "🔧"] for preferences). Choose 2-4 relevant emojis that visually represent this memory.'),
      topics: z.array(z.string()).optional().describe('List of topics related to this memory (e.g. ["preferences", "ui settings", "personalization"] for preferences). These topics help with search and categorization.'),
      hierarchical_structure: z.string().optional().describe('A path-like string representing where this memory fits in a hierarchical structure (e.g. "preferences/ui/theme" or "knowledge/programming/javascript"). This helps organize memories.'),
    }),
    execute: async (args) => {
      const { 
        content, 
        category, 
        type = 'text', 
        emoji_tags: providedEmojiTags,
        topics: providedTopics,
        hierarchical_structure: providedHierarchy
      } = args;
      
      console.log('[Memory Tool] Adding memory with category:', category);
      
      if (!session?.user?.id) {
        console.error('[Memory Tool] No user ID available');
        return { 
          success: false,
          error: 'No user ID available' 
        };
      }

      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.error('[Memory Tool] No API key provided');
        return { 
          success: false,
          error: 'No API key provided' 
        };
      }

      try {
        // Check usage limits before proceeding
        const { checkMemoryAddLimit } = await import('@/lib/subscription/usage-middleware');
        const usageCheck = await checkMemoryAddLimit(session.user.id);
        if (!usageCheck.allowed) {
          console.log('[Memory Tool] Memory add limit exceeded for user:', session.user.id);
          return { 
            success: false,
            error: usageCheck.reason,
            shouldShowUpgrade: usageCheck.shouldShowUpgrade
          };
        }

        // Get Papr user ID first
        const paprUserId = await ensurePaprUser(session.user.id, apiKey);
        if (!paprUserId) {
          console.error('[Memory Tool] Failed to get Papr user ID');
          return { 
            success: false,
            error: 'Failed to get Papr user ID' 
          };
        }

        // Use provided values or defaults based on category
        const emoji_tags = providedEmojiTags || getDefaultEmojiTags(category);
        const topics = providedTopics || getDefaultTopics(category);
        const hierarchical_structure = providedHierarchy || category;

        // Create metadata with proper structure following SDK field names
        const metadata: MemoryMetadata = {
          // Standard fields from the SDK
          sourceType: 'PaprChat',
          sourceUrl: `/chat/${session.user.id}`, // Link to user's chat
          user_id: paprUserId,
          external_user_id: session.user.id,
          'emoji tags': emoji_tags,
          topics: topics,
          hierarchical_structures: hierarchical_structure,
          createdAt: new Date().toISOString(),
          
          // Custom fields in customMetadata
          customMetadata: {
            category: category,
            app_user_id: session.user.id,
            tool: 'addMemory'
          }
        };

        // Use the memory service to store the content
        const memoryService = createMemoryService(apiKey);
        const success = await memoryService.storeContent(
          paprUserId, 
          content,
          type,
          metadata
        );

        // Track memory addition usage
        if (success) {
          try {
            const { trackMemoryAdd } = await import('@/lib/subscription/usage-middleware');
            await trackMemoryAdd(session.user.id);
            console.log('[Memory Tool] Tracked memory addition for user:', session.user.id);
          } catch (error) {
            console.error('[Memory Tool] Failed to track memory usage:', error);
          }
        }

        // Notify the UI that a memory was added (optional)
        if (dataStream) {
          dataStream.writeData({
            type: 'memory-added',
            content: {
              category,
              content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              emoji_tags,
              topics,
              hierarchical_structure
            },
          });
        }

        return {
          success: success,
          message: success ? `Added ${category} memory successfully` : 'Failed to add memory',
          category: category,
          emoji_tags,
          topics,
          hierarchical_structure
        };
      } catch (error: any) {
        console.error('[Memory Tool] Error adding memory:', error);
        return {
          success: false,
          error: error.message || 'Failed to add memory',
          fallbackMessage: "Unable to add memory. Please try again later."
        };
      }
    }
  });
};

// Helper functions for defaults if LLM doesn't provide values
function getDefaultEmojiTags(category: MemoryCategoryType): string[] {
  switch (category) {
    case 'preferences':
      return ['👤', '⚙️'];
    case 'goals':
      return ['🎯', '📋'];
    case 'tasks':
      return ['✅', '⏰'];
    case 'knowledge':
      return ['💡', '📚'];
    default:
      return ['💾', '🔍'];
  }
}

function getDefaultTopics(category: MemoryCategoryType): string[] {
  switch (category) {
    case 'preferences':
      return ['preferences', 'settings'];
    case 'goals':
      return ['goals', 'projects'];
    case 'tasks':
      return ['tasks', 'reminders'];
    case 'knowledge':
      return ['knowledge', 'information'];
    default:
      return ['memory'];
  }
} 