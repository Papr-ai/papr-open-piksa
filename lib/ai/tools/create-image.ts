import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { optimizeImageCreation } from '@/lib/ai/image-creation-optimizer';

const createImageInput = z.object({
  description: z.string().describe('Detailed description of the image to create'),
  seedImages: z.array(z.string()).optional().describe('COMPLETE URLs of existing images to use as seeds for consistency. Only provide if you have full HTTP URLs or complete base64 data URLs. Leave empty to let the tool search memory automatically.'),
  sceneContext: z.string().optional().describe('Context about the current scene and story for continuity'),
  priorScene: z.string().optional().describe('Description of the previous scene for visual continuity'),
  styleConsistency: z.boolean().optional().default(false).describe('Whether to prioritize style consistency with seed images'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().default('1:1').describe('Aspect ratio for the generated image')
});

const createImageOutput = z.object({
  imageUrl: z.string().describe('URL of the created image'),
  approach: z.enum(['generate', 'edit', 'merge_edit']).describe('Approach used to create the image'),
  seedImagesUsed: z.array(z.string()).optional().describe('Seed images that were actually used'),
  reasoning: z.string().describe('Explanation of why this approach was chosen'),
  actualPrompt: z.string().describe('The actual prompt used to generate/edit the image'),
  metadata: z.object({
    description: z.string(),
    approach: z.string(),
    seedCount: z.number(),
    hasSceneContext: z.boolean(),
    hasPriorScene: z.boolean()
  }).describe('Metadata about the image creation process')
});

export type CreateImageInput = z.infer<typeof createImageInput>;
export type CreateImageOutput = z.infer<typeof createImageOutput>;

export const createImage = ({ session }: { session: Session }) =>
  tool({
    description: `Create images with intelligent continuity management. This tool automatically:
    
    🎨 **Smart Image Creation**:
    - Analyzes your request and searches for relevant seed images
    - Uses merge+edit for multiple seeds, edit for single seed, generate for new scenes
    - Ensures visual consistency across scenes and characters
    
    🧠 **Continuity Intelligence**:
    - Searches memory for matching characters, rooms, objects
    - Maintains consistent character appearances and environments
    - Uses prior scene context for smooth visual transitions
    
    📝 **Usage Examples**:
    - "Create Sarah in the library" → Searches for Sarah's portrait + library images
    - "Show the next scene in the same room" → Uses room + character consistency
    - "Generate a new magical forest" → Creates fresh scene when no seeds exist
    
    ⚠️ **IMPORTANT - Seed Images**:
    - Use URLs from hyperlinked images in the conversation when available
    - Only provide seedImages if you have COMPLETE HTTP URLs (https://...) or COMPLETE base64 data URLs (data:image/jpeg;base64,...)
    - DO NOT use partial data URLs like "data:image" - these will cause errors
    - If you don't have complete image URLs, leave seedImages empty - the tool will search memory automatically
    - The tool's memory search is more reliable than providing partial/invalid URLs
    
    ✨ **Best Practices**:
    - Provide detailed descriptions for better results
    - Include scene context for story continuity
    - Mention specific characters/locations for consistency searches
    - Leave seedImages empty unless you have complete, valid URLs`,
    inputSchema: createImageInput,
    execute: async (input) => {
      try {
        // Filter out invalid seed images before processing
        const validSeedImages = (input.seedImages || []).filter(imageUrl => {
          if (!imageUrl || typeof imageUrl !== 'string') {
            console.warn('[CREATE IMAGE] Filtering out invalid seed image:', imageUrl);
            return false;
          }
          if (imageUrl === 'data:image' || (imageUrl.startsWith('data:') && !imageUrl.includes(';base64,'))) {
            console.warn('[CREATE IMAGE] Filtering out incomplete data URL:', imageUrl.substring(0, 50));
            return false;
          }
          return true;
        });

        console.log('[CREATE IMAGE] Starting intelligent image creation:', {
          description: input.description.substring(0, 100) + '...',
          originalSeedCount: input.seedImages?.length || 0,
          validSeedCount: validSeedImages.length,
          hasContext: !!input.sceneContext,
          hasPriorScene: !!input.priorScene
        });

        // Use GPT-5 mini to analyze the request and optimize the approach
        const optimizedResult = await optimizeImageCreation({
          description: input.description,
          seedImages: validSeedImages,
          sceneContext: input.sceneContext,
          priorScene: input.priorScene,
          styleConsistency: input.styleConsistency || false,
          aspectRatio: input.aspectRatio || '1:1'
        }, session.user?.id!);

        console.log('[CREATE IMAGE] Optimization complete:', {
          approach: optimizedResult.approach,
          finalSeedCount: optimizedResult.seedImagesUsed?.length || 0,
          reasoning: optimizedResult.reasoning.substring(0, 150) + '...'
        });

        const result: CreateImageOutput = {
          imageUrl: optimizedResult.imageUrl,
          approach: optimizedResult.approach,
          seedImagesUsed: optimizedResult.seedImagesUsed,
          reasoning: optimizedResult.reasoning,
          actualPrompt: optimizedResult.actualPrompt,
          metadata: {
            description: input.description,
            approach: optimizedResult.approach,
            seedCount: optimizedResult.seedImagesUsed?.length || 0,
            hasSceneContext: !!input.sceneContext,
            hasPriorScene: !!input.priorScene
          }
        };

        console.log('[CREATE IMAGE] Final result:', {
          imageUrl: result.imageUrl.substring(0, 50) + '...',
          approach: result.approach,
          seedCount: result.seedImagesUsed?.length || 0
        });

        return result;

      } catch (error) {
        console.error('[CREATE IMAGE] Error:', error);
        throw new Error(`Failed to create image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
