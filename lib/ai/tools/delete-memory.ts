import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { ToolCallOptions } from 'ai';
import { createMemoryService } from '@/lib/ai/memory/service';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';

interface DeleteMemoryProps {
  session: Session;
}

const deleteMemorySchema = z.object({
  memory_id: z.string().describe('The ID of the memory to delete'),
  reason: z.string().optional().describe('Optional reason for deletion (for logging purposes)')
});

type DeleteMemoryInput = z.infer<typeof deleteMemorySchema>;
type DeleteMemoryOutput = {
  success: boolean;
  message?: string;
  error?: string;
  memory_id?: string;
};

export const deleteMemory = ({ session }: DeleteMemoryProps) =>
  tool({
    description: `Delete a memory that is no longer needed or relevant. Use this when:
    
    🗑️ **When to Delete**:
    - Information becomes completely outdated or incorrect
    - User explicitly asks to forget something
    - Duplicate memories exist (keep the better one)
    - Temporary information is no longer needed
    - Privacy concerns require removal
    
    ⚠️ **Use Carefully**:
    - Consider updating instead of deleting when possible
    - Only delete when information is truly no longer valuable
    - Prefer archiving or marking as outdated over deletion
    - Double-check the memory ID before deletion
    
    📝 **Examples**:
    - "Delete the old project requirements that were replaced"
    - "Remove the outdated API documentation memory"
    - "Delete the duplicate character description"
    - "Forget my old email address preference"`,
    inputSchema: deleteMemorySchema,
    execute: async (input: DeleteMemoryInput, options: ToolCallOptions): Promise<DeleteMemoryOutput> => {
      const { memory_id, reason } = input;
      
      console.log('[Delete Memory Tool] Deleting memory:', { memory_id, reason });
      
      if (!session?.user?.id) {
        console.error('[Delete Memory Tool] No user ID available');
        return { 
          success: false,
          error: 'No user ID available' 
        };
      }

      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.error('[Delete Memory Tool] No API key provided');
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

        console.log('[Delete Memory Tool] Proceeding with deletion:', {
          memory_id,
          reason: reason || 'No reason provided',
          user_id: session.user.id
        });

        // Use the memory service to delete the memory
        const memoryService = createMemoryService(apiKey);
        const success = await memoryService.deleteMemory(memory_id);

        // Notify with step that memory was deleted
        const step = (options as any).step;
        if (step && success) {
          const reasonText = reason ? ` (${reason})` : '';
          await step(`🗑️ Deleted memory${reasonText}: ${memory_id}`);
        }

        return {
          success,
          message: success ? `Deleted memory successfully` : 'Failed to delete memory',
          memory_id
        };

      } catch (error: any) {
        console.error('[Delete Memory Tool] Error deleting memory:', error);
        return {
          success: false,
          error: error.message || 'Failed to delete memory',
          memory_id
        };
      }
    }
  });

