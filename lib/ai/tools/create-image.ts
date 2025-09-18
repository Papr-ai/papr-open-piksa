import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { optimizeImageCreation } from '@/lib/ai/image-creation-optimizer';

const createImageInput = z.object({
  description: z.string().describe('Detailed description of the image to create'),
  seedImages: z.array(z.string()).optional().describe('COMPLETE URLs of existing images to use as seeds for consistency. Only provide if you have full HTTP URLs or complete base64 data URLs. Leave empty to let the tool search memory automatically.'),
  seedImageTypes: z.array(z.enum(['character', 'environment', 'prop', 'other'])).optional().describe('Types of seed images provided (character, environment, prop, other). Must match the order of seedImages array. This helps optimize prompts for seeded image operations.'),
  sceneContext: z.string().optional().describe('Context about the current scene and story for continuity'),
  priorScene: z.string().optional().describe('Description of the previous scene for visual continuity'),
  styleConsistency: z.boolean().optional().default(false).describe('Whether to prioritize style consistency with seed images'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().default('1:1').describe('Aspect ratio for the generated image'),
  
  // Enhanced book context
  styleBible: z.string().optional().describe('Art style guidelines from book creation for consistent visual style'),
  bookTitle: z.string().optional().describe('Title of the book for context'),
  bookThemes: z.array(z.string()).optional().describe('Main themes of the book to reflect in the image'),
  bookGenre: z.string().optional().describe('Book genre for appropriate style context'),
  targetAge: z.string().optional().describe('Target age group for appropriate style'),
  conversationContext: z.string().optional().describe('Full conversation context with style details')
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
    description: `ENHANCED: Create general-purpose images with automatic memory search, continuity management, and Gemini-optimized prompts.

    **⚠️ IMPORTANT: For book-related content (characters, environments, scenes), use 'createSingleBookImage' tool instead!**
    **This tool does NOT save to the BookProp database table - book images will be lost if created here.**
    
    **Use this tool for:**
    - General illustrations not part of a book project
    - Standalone artwork or graphics
    - Non-book creative content
    
    **Do NOT use this tool for:**
    - Character portraits for books (use createSingleBookImage)
    - Book environments or scenes (use createSingleBookImage) 
    - Any content that should be saved as book assets
    - **EDITING EXISTING IMAGES** (use editImage tool instead)
    - Modifying height, colors, or elements in existing images (use editImage)

    🚨 **CRITICAL WORKFLOW CHANGE**:
    The AI assistant should ALWAYS use searchMemories BEFORE calling this tool to find existing assets and ask user approval!
    
    🎨 **Smart Image Creation**:
    - Automatically searches memory for relevant seed images when none provided
    - Uses merge+edit for multiple seeds, edit for single seed, generate for new scenes
    - Ensures visual consistency across scenes and characters
    - Optimizes prompts using Gemini 2.5 Flash best practices
    
    🧠 **Enhanced Memory Integration**:
    - Backend automatically searches memory when no seed images provided
    - Extracts image URLs from relevant memories
    - Maintains consistent character appearances and environments
    - Uses prior scene context for smooth visual transitions
    
    🎯 **Gemini Prompt Optimization**:
    - Transforms simple descriptions into detailed, narrative prompts
    - Applies photography terms for realistic images (camera angles, lighting, composition)
    - Uses hyper-specific details and semantic positive language
    - Follows Gemini's best practices for coherent, high-quality images
    - Adapts prompts based on image type (photorealistic, illustration, sticker, etc.)
    
    📝 **Usage Examples**:
    - "Create Sarah in the library" → Memory search finds Sarah's portrait + library images, optimizes to detailed scene description
    - "Show the next scene in the same room" → Uses room + character consistency from memory with cinematic prompt
    - "Generate a new magical forest" → Creates fresh scene with atmospheric, narrative description
    
    ⚠️ **IMPORTANT - Seed Images**:
    - Tool now searches memory automatically if no seedImages provided
    - Use URLs from hyperlinked images in the conversation when available
    - Only provide seedImages if you have COMPLETE HTTP URLs (https://...) or COMPLETE base64 data URLs (data:image/jpeg;base64,...)
    - DO NOT use partial data URLs like "data:image" - these will cause errors
    - Leave seedImages empty to trigger automatic memory search
    
    ✨ **Best Practices**:
    - Provide detailed descriptions - they'll be enhanced with Gemini best practices automatically
    - Include scene context for story continuity and better prompt optimization
    - Mention specific characters/locations for better memory matching and prompt details
    - Leave seedImages empty unless you have complete, valid URLs - memory search is more reliable
    - Simple descriptions work well - the system will optimize them into professional prompts`,
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
          seedImageTypes: input.seedImageTypes,
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

        // Note: If OpenAI fails to download the image URL for validation, 
        // the image is still created and accessible via dataStream for the UI
        console.log('[CREATE IMAGE] Returning result with imageUrl for display in UI');

        return result;

      } catch (error) {
        console.error('[CREATE IMAGE] Error:', error);
        throw new Error(`Failed to create image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
