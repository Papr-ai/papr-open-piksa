import { tool } from 'ai';
import { z } from 'zod';
import { createMemoryService } from '../memory/service';
import { ensurePaprUser } from '../memory/middleware';
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
      'Search through past conversations and memories to find relevant information. IMPORTANT: After using this tool, DO NOT include the results in your text response or attempt to format them - the UI will handle displaying the memories automatically in a separate component. The query parameter should be TWO descriptive sentences: the first describing what the user is looking for, and the second providing additional context or details. This format helps the semantic search find the most relevant memories.',
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
          return {
            memories: [],
            error: 'Memory service not configured',
          };
        }

        // Get the app user ID
        const appUserId = session.user.id;

        // IMPORTANT: Use ensurePaprUser to get the correct Papr user ID
        // This will fetch from database or create one if needed
        const paprUserId = await ensurePaprUser(appUserId, PAPR_MEMORY_API_KEY);

        if (!paprUserId) {
          console.error(
            `[Memory Tool] Failed to get Papr user ID for app user ${appUserId}`,
          );
          return {
            memories: [],
            error: 'Memory service configuration issue',
          };
        }

        console.log(
          `[Memory Tool] Using Papr user ID: ${paprUserId} for memory search (app user: ${appUserId})`,
        );

        const memoryService = createMemoryService(PAPR_MEMORY_API_KEY);

        // Search for memories using the SDK with fixed max_memories
        const memories = await memoryService.searchMemories(
          paprUserId,
          query,
          10,
        );

        const formattedMemories = memories.map((memory) => {
          return {
            content: memory.content || '',
            id: memory.id || '',
            timestamp: memory.created_at || '',
          };
        });

        console.log(
          `[Memory Tool] Found ${formattedMemories.length} memories in search results`,
        );

        // Return simple serializable data structure
        return {
          memories: formattedMemories,
          error: null,
        };
      } catch (error) {
        console.error('[Memory Tool] Error searching memories:', error);
        return {
          memories: [],
          error: 'Failed to search memories',
        };
      }
    },
  });
