import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { ToolCallOptions } from 'ai';
import { createMemoryService } from '@/lib/ai/memory/service';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import type { MemoryMetadata } from '@papr/memory/resources/memory';

// Define the category enum
const MemoryCategory = z.enum(['preferences', 'goals', 'tasks', 'knowledge']);
type MemoryCategoryType = z.infer<typeof MemoryCategory>;

interface UpdateMemoryProps {
  session: Session;
}

const updateMemorySchema = z.object({
  memory_id: z.string().describe('The ID of the memory to update'),
  content: z.string().optional().describe('New content for the memory (if updating content)'),
  category: MemoryCategory.optional().describe('Updated category: preferences, goals, tasks, or knowledge'),
  type: z.enum(['text', 'code_snippet', 'document']).optional().describe('Updated type of memory content'),
  emoji_tags: z.array(z.string()).optional().describe('Updated emoji tags that represent this memory'),
  topics: z.array(z.string()).optional().describe('Updated topics related to this memory'),
  hierarchical_structure: z.string().optional().describe('Updated hierarchical structure path'),
  image_url: z.string().optional().describe('Updated image URL if this is an image memory'),
  image_description: z.string().optional().describe('Updated description of what the image shows'),
  custom_fields: z.record(z.string(), z.any()).optional().describe('Updated custom metadata fields specific to the content type')
});

type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
type UpdateMemoryOutput = {
  success: boolean;
  message?: string;
  error?: string;
  memory_id?: string;
  updated_fields?: string[];
};

export const updateMemory = ({ session }: UpdateMemoryProps) =>
  tool({
    description: `Update an existing memory with new information. Use this when:
    
    🔄 **When to Update**:
    - User preferences or settings change
    - Project goals or requirements evolve  
    - Task status or details are modified
    - Knowledge becomes outdated or incomplete
    - Character descriptions or story elements change
    
    🎯 **Smart Updates**:
    - Only provide fields that need to be changed
    - Preserve existing metadata when possible
    - Update categories if the memory's purpose changes
    - Maintain searchability with updated topics/tags
    
    📝 **Examples**:
    - "Update my coding style preference to prefer TypeScript"
    - "Change the project deadline to next month"
    - "Mark the database setup task as completed"
    - "Update the character's age from 25 to 26"`,
    inputSchema: updateMemorySchema,
    execute: async (input: UpdateMemoryInput, options: ToolCallOptions): Promise<UpdateMemoryOutput> => {
      const { 
        memory_id,
        content,
        category,
        type,
        emoji_tags,
        topics,
        hierarchical_structure,
        image_url,
        image_description,
        custom_fields
      } = input;
      
      console.log('[Update Memory Tool] Updating memory:', memory_id);
      
      if (!session?.user?.id) {
        console.error('[Update Memory Tool] No user ID available');
        return { 
          success: false,
          error: 'No user ID available' 
        };
      }

      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.error('[Update Memory Tool] No API key provided');
        return { 
          success: false,
          error: 'No API key provided' 
        };
      }

      try {
        // Ensure we have a Papr user ID
        const paprUserId = await ensurePaprUser(session.user.id, apiKey);
        if (!paprUserId) {
          return { 
            success: false,
            error: 'Failed to resolve user ID' 
          };
        }

        // Helper function to serialize values for Papr Memory API (same as add-memory)
        const serializeCustomFields = (fields: Record<string, any>): Record<string, any> => {
          if (!fields) return {};
          
          const serialized: Record<string, any> = {};
          for (const [key, value] of Object.entries(fields)) {
            if (Array.isArray(value)) {
              serialized[key] = JSON.stringify(value);
              console.log(`[Update Memory Tool] Serialized array field ${key}: ${value} -> ${serialized[key]}`);
            } else if (typeof value === 'object' && value !== null) {
              serialized[key] = JSON.stringify(value);
              console.log(`[Update Memory Tool] Serialized object field ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
            } else {
              serialized[key] = value;
            }
          }
          return serialized;
        };

        // Build updates object - only include fields that are provided
        const updates: any = {};
        const updatedFields: string[] = [];

        if (content !== undefined) {
          updates.content = content;
          updatedFields.push('content');
        }

        if (type !== undefined) {
          updates.type = type;
          updatedFields.push('type');
        }

        // Build metadata updates if any metadata fields are provided
        if (category || emoji_tags || topics || hierarchical_structure || image_url || image_description || custom_fields) {
          const metadataUpdates: Partial<MemoryMetadata> = {
            // Only update fields that are provided
            ...(emoji_tags && { 'emoji tags': emoji_tags }),
            ...(topics && { topics }),
            ...(hierarchical_structure && { hierarchical_structures: hierarchical_structure }),
          };

          // Build customMetadata updates
          const customMetadataUpdates: Record<string, any> = {};
          
          if (category) {
            customMetadataUpdates.category = category;
            updatedFields.push('category');
          }
          
          if (image_url) {
            customMetadataUpdates.image_url = image_url;
            updatedFields.push('image_url');
          }
          
          if (image_description) {
            customMetadataUpdates.image_description = image_description;
            updatedFields.push('image_description');
          }

          if (custom_fields) {
            Object.assign(customMetadataUpdates, serializeCustomFields(custom_fields));
            updatedFields.push('custom_fields');
          }

          if (Object.keys(customMetadataUpdates).length > 0) {
            metadataUpdates.customMetadata = customMetadataUpdates;
          }

          if (Object.keys(metadataUpdates).length > 0) {
            updates.metadata = metadataUpdates;
            updatedFields.push('metadata');
          }
        }

        if (Object.keys(updates).length === 0) {
          return {
            success: false,
            error: 'No fields provided for update'
          };
        }

        console.log('[Update Memory Tool] Update payload:', {
          memory_id,
          updates: JSON.stringify(updates, null, 2),
          updatedFields
        });

        // Use the memory service to update the memory
        const memoryService = createMemoryService(apiKey);
        const success = await memoryService.updateMemory(memory_id, updates);

        // Notify with step that memory was updated
        const step = (options as any).step;
        if (step && success) {
          const fieldsText = updatedFields.join(', ');
          await step(`🔄 Updated memory (${fieldsText}): "${content?.substring(0, 50) || memory_id}${content && content.length > 50 ? '...' : ''}"`);
        }

        return {
          success,
          message: success ? `Updated memory successfully` : 'Failed to update memory',
          memory_id,
          updated_fields: updatedFields
        };

      } catch (error: any) {
        console.error('[Update Memory Tool] Error updating memory:', error);
        return {
          success: false,
          error: error.message || 'Failed to update memory',
          memory_id
        };
      }
    }
  });
