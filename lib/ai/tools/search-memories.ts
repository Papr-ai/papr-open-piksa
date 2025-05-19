import { tool } from 'ai';
import { z } from 'zod';
import { createMemoryService } from '../memory/service';
import type { Session } from 'next-auth';

// Define the shape of our extended user type
interface ExtendedUser {
  id: string;
  paprUserId?: string;
}

interface SearchMemoriesOptions {
  session: Session;
  dataStream: any;
}

export const searchMemories = ({ session }: SearchMemoriesOptions) =>
  tool({
    description:
      'Search through past conversations and memories to find relevant information. The query parameter should be TWO descriptive sentences: the first describing what the user is looking for, and the second providing additional context or details. This format helps the semantic search find the most relevant memories.',
    parameters: z.object({
      query: z
        .string()
        .describe(
          'Two descriptive sentences: first describing what to search for, second providing additional context. Example: "Looking for discussions about marketing strategy. Need information about past decisions on branding and positioning."',
        ),
    }),
    execute: async ({ query }) => {
      try {
        const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';
        if (!session?.user?.id) {
          return { memories: [], error: 'Memory service not configured' };
        }

        // Use paprUserId from session if available, with type assertion
        const user = session.user as unknown as ExtendedUser;
        const userId = user.paprUserId || user.id;
        console.log(
          `[Memory DEBUG] Using user ID for memory search: ${userId}`,
        );

        const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);

        // Search for memories using the SDK with fixed max_memories
        const memories = await memoryService.searchMemories(userId, query, 10);

        // Format the memories for the LLM
        return {
          memories: memories.map((memory) => ({
            content: memory.content || '',
            id: memory.id || '',
            timestamp: memory.created_at || '',
          })),
          error: null,
        };
      } catch (error) {
        console.error('[Memory Tool] Error searching memories:', error);
        return { memories: [], error: 'Failed to search memories' };
      }
    },
  });
