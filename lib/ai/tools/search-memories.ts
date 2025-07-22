import { initPaprMemory } from '@/lib/ai/memory';
import { Papr } from '@papr/memory';
import type { MemorySearchParams, SearchResponse } from '@papr/memory/resources/memory';
import { z } from 'zod';
import { tool } from 'ai';
import type { DataStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import { ensurePaprUser } from '@/lib/ai/memory/middleware';

// Use SDK types for formatted memory
type FormattedMemory = {
  id: string;
  content?: string;
  timestamp: string;
  metadata?: SearchResponse.Data.Memory['metadata'];
};

interface SearchMemoriesProps {
  session: Session;
  dataStream: DataStreamWriter;
}

type ReasoningStep = 'start' | 'init' | 'search' | 'complete' | 'error' | 'reading';

/**
 * Create a memory search tool that matches the Tool type
 */
export const searchMemories = ({ session, dataStream }: SearchMemoriesProps) =>
  tool({
    description: 'Search through user memories to find relevant information from past conversations',
    parameters: z.object({
      query: z.string().describe('A detailed search query (at least 2 sentences) describing exactly what to find in the user\'s memories. If the user is just testing or not specific, you must still generate a meaningful, detailed query that would help retrieve relevant memories. Do not leave this blank or generic; always provide a specific, information-rich query.'),
    }),
    execute: async (args) => {
      const { query } = args;
      // Track execution timing
      const startTime = Date.now();
      const timestamps = {
        start: startTime,
        init: 0,
        search: 0,
        complete: 0
      };
      
      console.log('[Memory Tool] Starting search with query:', query);
      
      // Helper function to emit reasoning events with consistent format
      const emitReasoningEvent = (text: string, step: ReasoningStep, duration?: number) => {
        const now = Date.now();
        // Ensure duration is a number for JSON serialization
        const durationValue = duration !== undefined ? duration : null;
        
        const event = {
          type: 'step-start',
          data: {
            type: 'reasoning',
            reasoning: {
              text,
              timestamp: new Date().toISOString(),
              step,
              duration: durationValue
            }
          }
        };
        console.log('[Memory Tool] Emitting reasoning event:', JSON.stringify(event, null, 2));
        dataStream.writeData({
          type: 'data',
          data: {
            type: 'part',
            data: event
          }
        });
        
        // Update timestamps for the current step
        if (step === 'init') timestamps.init = now;
        if (step === 'search') timestamps.search = now;
        if (step === 'complete') timestamps.complete = now;
        
        return now;
      };

      // Emit initial "start" event
      emitReasoningEvent(`🔍 Starting memory search with query: "${query}"`, 'start');

      if (!session?.user?.id) {
        console.log('[Memory Tool] No user ID available');
        emitReasoningEvent('❌ Error: No user ID available', 'error');
        return { error: 'No user ID available' };
      }

      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.log('[Memory Tool] No API key provided');
        emitReasoningEvent('❌ Error: No API key provided', 'error');
        return { error: 'No API key provided' };
      }

      try {
        // Initialize SDK client
        const initStartTime = Date.now();
        const API_BASE_URL = process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai';
        const paprClient = initPaprMemory(apiKey, {
          baseURL: API_BASE_URL,
        });

        // Emit initialization event with duration
        const initDuration = Date.now() - initStartTime;
        emitReasoningEvent('🔄 Initializing memory search...', 'init', initDuration);

        // Get Papr user ID
        const userIdStartTime = Date.now();
        const paprUserId = await ensurePaprUser(session.user.id, apiKey);
        if (!paprUserId) {
          console.error('[Memory Tool] Failed to get Papr user ID');
          emitReasoningEvent('❌ Error: Failed to get Papr user ID', 'error');
          return { error: 'Failed to get Papr user ID' };
        }
        
        const userIdDuration = Date.now() - userIdStartTime;
        console.log('[Memory Tool] Papr user ID:', paprUserId);
        
        // Create search parameters using SDK types
        const searchParams: MemorySearchParams = {
          query,
          user_id: paprUserId,
          rank_results: false,
        };
        
        // Emit search start event
        const searchStartTime = Date.now();
        emitReasoningEvent(`🔍 Executing memory search for "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}" ..`, 'search', userIdDuration);

        // Use SDK to search
        console.log('[Memory Tool] Executing search with params:', searchParams);
        const searchApiStartTime = Date.now();
        const response = await paprClient.memory.search(searchParams, {
          query: {
            max_memories: 25
          }
        });
        const searchApiDuration = Date.now() - searchApiStartTime;
        console.log('[Memory Tool] Search response:', response);

        // Handle different response formats
        let memories: SearchResponse.Data.Memory[] = [];
        
        if (response && response.data) {
          if (Array.isArray(response.data.memories)) {
            memories = response.data.memories;
          }
        }

        // Format memories for display
        const formattedMemories = memories
          .filter(memory => memory.id) // Only keep memories with IDs
          .map((memory): FormattedMemory => {
            // Parse metadata if it's a string
            const metadata = typeof memory.metadata === 'string' 
              ? JSON.parse(memory.metadata)
              : memory.metadata;

            // Get the timestamp, defaulting to current time if none exists
            const timestamp = memory.created_at || 
              (metadata && typeof metadata === 'object' && 'createdAt' in metadata ? metadata.createdAt : null) || 
              new Date().toISOString();
            
            return {
              id: memory.id,
              content: memory.content,
              timestamp,
              metadata
            };
          });

        // Calculate total duration and emit completion event
        const totalDuration = Date.now() - startTime;
        const searchDuration = Date.now() - searchStartTime;
        
        console.log('[Memory Tool] Search complete, found memories:', formattedMemories.length);
        
        // First emit completion event
        emitReasoningEvent(
          `✅ Found ${formattedMemories.length} relevant memories (API: ${(searchApiDuration / 1000).toFixed(2)}s, Total: ${(totalDuration / 1000).toFixed(2)}s)`,
          'complete',
          searchDuration
        );

        return {
          memories: formattedMemories,
          memoryData: formattedMemories,
          memoryIds: formattedMemories.map(m => m.id).join(', '),
          count: formattedMemories.length,
          timing: {
            total: totalDuration,
            search: searchDuration,
            api: searchApiDuration
          }
        };
      } catch (error) {
        const errorDuration = Date.now() - startTime;
        console.error('[Memory Tool] Error searching memories:', error);
        emitReasoningEvent(`❌ Error: Failed to search memories - ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', errorDuration);
        return { 
          error: 'Failed to search memories',
          errorDetails: error instanceof Error ? error.message : String(error),
          fallbackMessage: "Unable to retrieve memories at the moment. Please try again later."
        };
      }
    }
  });
