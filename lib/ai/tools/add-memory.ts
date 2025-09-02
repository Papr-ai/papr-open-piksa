import { auth } from '@/app/(auth)/auth';
import { Papr } from '@papr/memory';
import { initPaprMemory } from '@/lib/ai/memory';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import { z } from 'zod';
import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { Session } from 'next-auth';
import { createMemoryService } from '@/lib/ai/memory/service';
import type { MemoryMetadata } from '@papr/memory/resources/memory';

// Define the category enum
const MemoryCategory = z.enum(['preferences', 'goals', 'tasks', 'knowledge']);
type MemoryCategoryType = z.infer<typeof MemoryCategory>;

interface AddMemoryProps {
  session: Session;
}

/**
 * Create a memory addition tool that matches the Tool type
 */
const addMemorySchema = z.object({
  content: z.string().describe('The content of the memory to add, should be specific and detailed enough for future retrieval'),
  category: MemoryCategory.describe('The category of memory: preferences (user preferences, style, etc), goals (long-term objectives), tasks (to-dos, reminders), or knowledge (technical facts, configurations)'),
  type: z.enum(['text', 'code_snippet', 'document']).default('text').describe('The type of memory content - use "document" for images and rich content'),
  emoji_tags: z.array(z.string()).optional().describe('List of emoji tags that represent this memory (e.g. ["👤", "⚙️", "🔧"] for preferences). Choose 2-4 relevant emojis that visually represent this memory.'),
  topics: z.array(z.string()).optional().describe('List of topics related to this memory (e.g. ["preferences", "ui settings", "personalization"] for preferences). These topics help with search and categorization.'),
  hierarchical_structure: z.string().optional().describe('A path-like string representing where this memory fits in a hierarchical structure (e.g. "preferences/ui/theme" or "knowledge/programming/javascript"). This helps organize memories.'),
  
  // Image-specific fields
  image_url: z.string().optional().describe('URL of the image if this is an image memory'),
  image_description: z.string().optional().describe('Detailed description of what the image shows'),
  
  // Flexible custom metadata for different content types
  custom_fields: z.record(z.string(), z.any()).optional().describe('Additional custom metadata fields specific to the content type. For images, this could include: character_name, character_traits, prop_type, scene_location, artistic_style, book_title, chapter_number, etc.')
});

type AddMemoryInput = z.infer<typeof addMemorySchema>;
type AddMemoryOutput = {
  success: boolean;
  message?: string;
  error?: string;
  category?: string;
  emoji_tags?: string[];
  topics?: string[];
  hierarchical_structure?: string;
  shouldShowUpgrade?: boolean;
  fallbackMessage?: string;
};

export const addMemory = ({ session }: AddMemoryProps): Tool<AddMemoryInput, AddMemoryOutput> =>
  tool({
    description: 'Add important information to user memory for future reference',
    inputSchema: addMemorySchema,
    execute: async (input: AddMemoryInput, options: ToolCallOptions): Promise<AddMemoryOutput> => {
      const { 
        content, 
        category, 
        type = 'text', 
        emoji_tags: providedEmojiTags,
        topics: providedTopics,
        hierarchical_structure: providedHierarchy,
        image_url,
        image_description,
        custom_fields
      } = input;
      
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

        // Helper function to serialize values for Papr Memory API
        const serializeCustomFields = (fields: Record<string, any>): Record<string, any> => {
          if (!fields) return {};
          
          const serialized: Record<string, any> = {};
          for (const [key, value] of Object.entries(fields)) {
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings to ensure API compatibility
              serialized[key] = JSON.stringify(value);
              console.log(`[Memory Tool] Serialized array field ${key}: ${value} -> ${serialized[key]}`);
            } else if (typeof value === 'object' && value !== null) {
              // Convert objects to JSON strings
              serialized[key] = JSON.stringify(value);
              console.log(`[Memory Tool] Serialized object field ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
            } else {
              // Keep primitive values as-is (string, number, boolean)
              serialized[key] = value;
            }
          }
          return serialized;
        };

        // Create metadata with proper structure following SDK field names
        const metadata: MemoryMetadata = {
          // Standard fields from the SDK
          sourceType: image_url ? 'PaprChat_Image' : 'PaprChat',
          sourceUrl: `/chat/${session.user.id}`, // Link to user's chat
          user_id: paprUserId,
          external_user_id: session.user.id,
          'emoji tags': emoji_tags,
          topics: topics,
          hierarchical_structures: hierarchical_structure,
          createdAt: new Date().toISOString(),
          
          // Custom fields in customMetadata - FLATTEN custom_fields to top level for searchability
          customMetadata: {
            // Core metadata
            category: category,
            app_user_id: session.user.id,
            tool: 'addMemory',
            content_type: type,
            // Image-specific fields (top-level for filtering)
            ...(image_url && { image_url }),
            ...(image_description && { image_description }),
            // Serialize and flatten custom_fields to top-level for searchability
            // This allows filtering on character_name, book_title, prop_type, etc.
            ...(custom_fields ? serializeCustomFields(custom_fields) : {})
          }
        };

        // Use the memory service to store the content
        const memoryService = createMemoryService(apiKey);
        const success = await memoryService.storeContent(
          paprUserId, 
          content,
          type as 'text' | 'code_snippet' | 'document',
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

        // Notify with step that memory was added
        const step = (options as any).step;
        if (step) {
          await step(`💾 Added ${category} memory: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
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
  } as any);

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