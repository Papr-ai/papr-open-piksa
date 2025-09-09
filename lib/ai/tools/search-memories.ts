import { initPaprMemory } from '@/lib/ai/memory';
import { Papr } from '@papr/memory';
import type { MemorySearchParams, SearchResponse } from '@papr/memory/resources/memory';
import { z } from 'zod';
import { tool, type Tool, type ToolCallOptions } from 'ai';
import type { Session } from 'next-auth';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';
import { createMemoryService } from '@/lib/ai/memory/service';

// Use SDK types for formatted memory
type FormattedMemory = {
  id: string;
  content?: string;
  timestamp: string;
  metadata?: SearchResponse.Data.Memory['metadata'];
};

interface SearchMemoriesProps {
  session: Session;
}

const searchMemoriesSchema = z.object({
  query: z.string().describe('A detailed search query (at least 2 sentences) describing exactly what to find in the user\'s memories. If the user is just testing or not specific, you must still generate a meaningful, detailed query that would help retrieve relevant memories. Do not leave this blank or generic; always provide a specific, information-rich query.'),
});

type SearchMemoriesInput = z.infer<typeof searchMemoriesSchema>;
type SearchMemoriesOutput = {
  success?: boolean;
  error?: string;
  shouldShowUpgrade?: boolean;
  memories?: FormattedMemory[];
  memoryData?: FormattedMemory[];
  memoryIds?: string[];
  count?: number;
  timing?: any;
  errorDetails?: string;
  fallbackMessage?: string;
};

/**
 * Create a memory search tool that matches the Tool type
 */
export const searchMemories = ({ session }: { session: Session }): Tool<SearchMemoriesInput, SearchMemoriesOutput> =>
  tool({
    description: 'Search through user memories to find relevant information from past conversations',
    inputSchema: searchMemoriesSchema,
    execute: async (input: SearchMemoriesInput, options: ToolCallOptions): Promise<SearchMemoriesOutput> => {
      const { query } = input;
      // Track execution timing
      const startTime = Date.now();
      const timestamps = {
        start: startTime,
        init: 0,
        search: 0,
        complete: 0
      };
      
      console.log('[Memory Tool] Starting search with query:', query);
      
      // Use AI SDK step() for reasoning instead of mock dataStream
      const step = (options as any).step;
      if (step) {
        await step(`🔍 Starting memory search with query: "${query}"`);
        await step(`🔄 Initializing memory search...`);
      }

      if (!session?.user?.id) {
        console.log('[Memory Tool] No user ID available');
        if (step) await step('❌ Error: No user ID available');
        return { error: 'No user ID available' };
      }

      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.log('[Memory Tool] No API key provided');
        if (step) await step('❌ Error: No API key provided');
        return { error: 'No API key provided' };
      }

      try {
        // Check usage limits before proceeding (using fast middleware)
        const { fastCheckMemorySearchLimit, trackMemorySearchAsync } = await import('@/lib/subscription/fast-usage-middleware');
        const usageCheck = await fastCheckMemorySearchLimit(session.user.id);
        if (!usageCheck.allowed) {
          console.log('[Memory Tool] Memory search limit exceeded for user:', session.user.id);
          if (step) await step(`❌ ${usageCheck.reason}`);
          return { 
            error: usageCheck.reason,
            shouldShowUpgrade: usageCheck.shouldShowUpgrade
          };
        }
        
        // Track the search asynchronously (non-blocking)
        trackMemorySearchAsync(session.user.id);

        // Initialize memory service instead of direct client
        const initStartTime = Date.now();
        const memoryService = createMemoryService(apiKey);

        // Get Papr user ID
        const userIdStartTime = Date.now();
        const paprUserId = await ensurePaprUser(session.user.id, apiKey);
        if (!paprUserId) {
          console.error('[Memory Tool] Failed to get Papr user ID');
          if (step) await step('❌ Error: Failed to get Papr user ID');
          return { error: 'Failed to get Papr user ID' };
        }
        
        const userIdDuration = Date.now() - userIdStartTime;
        console.log('[Memory Tool] Papr user ID:', paprUserId);
        
        // Emit search start event
        const searchStartTime = Date.now();
        if (step) await step(`🔍 Executing memory search for "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" ..`);

        // Use memory service for search
        console.log('[Memory Tool] Executing search with query:', query);
        const searchApiStartTime = Date.now();
        const searchResults = await memoryService.searchMemories(paprUserId, query, 25);
        const searchApiDuration = Date.now() - searchApiStartTime;
        console.log('[Memory Tool] Search complete, found memories:', searchResults.length);
        console.log('[Memory Tool] Search results:', JSON.stringify(searchResults, null, 2));

        // Map to our FormattedMemory type
        const memories: FormattedMemory[] = searchResults.map(memory => ({
          id: memory.id,
          content: memory.content,
          timestamp: new Date(memory.createdAt).toLocaleString(),
          metadata: memory.metadata,
        }));

        // Track memory search usage
        try {
          const { trackMemorySearch } = await import('@/lib/subscription/usage-middleware');
          await trackMemorySearch(session.user.id);
          console.log('[Memory Tool] Tracked memory search for user:', session.user.id);
        } catch (error) {
          console.error('[Memory Tool] Failed to track memory search usage:', error);
        }

        // Calculate total duration and emit completion event
        const totalDuration = Date.now() - startTime;
        const searchDuration = Date.now() - searchStartTime;
        
        // First emit completion event
        if (step) {
          await step(
            `✅ Found ${memories.length} relevant memories (API: ${(searchApiDuration / 1000).toFixed(2)}s, Total: ${(totalDuration / 1000).toFixed(2)}s)`
          );
        }

        const result = {
          success: true,
          memories: memories,
          memoryData: memories,
          memoryIds: memories.map(m => m.id),
          count: memories.length,
          timing: {
            total: totalDuration,
            search: searchDuration,
            api: searchApiDuration
          }
        };
        
        console.log('[Memory Tool] Final result:', JSON.stringify(result, null, 2));
        
        // Debug: Log what metadata is actually being returned to LLM
        console.log('[Memory Tool] Metadata being returned to LLM:');
        memories.forEach((memory, index) => {
          console.log(`[Memory Tool] Memory ${index + 1} metadata:`, JSON.stringify(memory.metadata, null, 2));
        });
        
        return result;
      } catch (error) {
        const errorDuration = Date.now() - startTime;
        console.error('[Memory Tool] Error searching memories:', error);
        if (step) await step(`❌ Error: Failed to search memories - ${error instanceof Error ? error.message : 'Unknown error'}`);
        return { 
          error: 'Failed to search memories',
          errorDetails: error instanceof Error ? error.message : String(error),
          fallbackMessage: "Unable to retrieve memories at the moment. Please try again later."
        };
      }
    }
  } as any);
