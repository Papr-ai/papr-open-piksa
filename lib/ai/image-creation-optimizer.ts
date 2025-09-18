import { generateImage } from '@/lib/ai/tools/generate-image';
import { editImage } from '@/lib/ai/tools/edit-image';
import { mergeImages } from '@/lib/ai/tools/merge-images';
import type { CreateImageInput } from '@/lib/ai/tools/create-image';
import { optimizeImagePrompt } from '@/lib/ai/image-prompt-optimizer';

interface ImageCreationContext extends CreateImageInput {
  userId?: string;
  seedImageTypes?: ('character' | 'environment' | 'prop' | 'other')[];
  
  // Enhanced book context
  styleBible?: string;
  bookThemes?: string[];
  bookGenre?: string;
  targetAge?: string;
  conversationContext?: string;
}

interface OptimizedImageResult {
  imageUrl: string;
  approach: 'generate' | 'edit' | 'merge_edit';
  seedImagesUsed?: string[];
  reasoning: string;
  actualPrompt: string;
}

export async function optimizeImageCreation(
  context: ImageCreationContext,
  userId: string
): Promise<OptimizedImageResult> {
  console.log('[ImageCreationOptimizer] Starting intelligent approach with memory search:', {
    description: context.description?.substring(0, 100),
    seedImages: context.seedImages?.length || 0,
    aspectRatio: context.aspectRatio
  });

  const mockSession = { user: { id: userId } };
  const mockDataStream = { write: (data: any) => console.log('[Tool]:', data) };

  // Filter out invalid seed images before processing
  let validSeedImages = (context.seedImages || []).filter(imageUrl => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      console.warn('[ImageCreationOptimizer] Filtering out invalid seed image:', imageUrl);
      return false;
    }
    if (imageUrl === 'data:image' || (imageUrl.startsWith('data:') && !imageUrl.includes(';base64,'))) {
      console.warn('[ImageCreationOptimizer] Filtering out incomplete data URL:', imageUrl.substring(0, 50));
      return false;
    }
    return true;
  });

  // The AI agent should handle memory search and pass appropriate seed images
  // The image creation optimizer should only optimize prompts and create images

  console.log(`[ImageCreationOptimizer] Final seed images count: ${validSeedImages.length}`);

  // Optimize the prompt using Gemini best practices
  let optimizedDescription = context.description;
  try {
    console.log('[ImageCreationOptimizer] Optimizing prompt using Gemini best practices...');
    const promptOptimization = await optimizeImagePrompt({
      description: context.description,
      sceneContext: context.sceneContext,
      priorScene: context.priorScene,
      style: 'realistic', // Default to realistic for most use cases
      aspectRatio: context.aspectRatio,
      seedImages: validSeedImages,
      seedImageTypes: context.seedImageTypes,
      userId: userId,
      isEditing: validSeedImages.length > 0, // Use editing mode if we have seed images
      
      // Pass enhanced book context
      styleBible: context.styleBible,
      bookThemes: context.bookThemes,
      bookGenre: context.bookGenre,
      targetAge: context.targetAge,
      conversationContext: context.conversationContext
    });
    
    optimizedDescription = promptOptimization.optimizedPrompt;
    console.log('[ImageCreationOptimizer] Prompt optimized successfully:', {
      originalLength: context.description.length,
      optimizedLength: optimizedDescription.length,
      reasoning: promptOptimization.reasoning.substring(0, 100) + '...'
    });
  } catch (promptError) {
    console.warn('[ImageCreationOptimizer] Prompt optimization failed, using original:', promptError);
    // Continue with original description
  }

  try {
    if (validSeedImages.length > 1) {
      // Multiple seeds: mergeImages → editImage
      console.log('[ImageCreationOptimizer] Multiple seeds detected, using merge+edit approach');
      console.log(`[ImageCreationOptimizer] Using ${Math.min(validSeedImages.length, 9)} out of ${validSeedImages.length} seed images`);
      
      // Convert imageUrls to the correct format for mergeImages tool
      // Support up to 9 images in a 3x3 grid layout for better seed utilization
      const maxImages = Math.min(validSeedImages.length, 9);
      const imagesToMerge = validSeedImages.slice(0, maxImages).map((imageUrl, index) => {
        // Create a 3x3 grid layout for up to 9 images
        const positions = [
          '1x1', '1x2', '1x3',
          '2x1', '2x2', '2x3', 
          '3x1', '3x2', '3x3'
        ];
        return {
          imageUrl,
          position: positions[index] || '1x1',
          spanRows: 1,
          spanCols: 1
        };
      });
      
      const mergeResult = await (mergeImages({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        images: imagesToMerge,
        backgroundColor: '#ffffff',
        outputWidth: 1024,
        outputHeight: 1024
      });
      
      console.log('🔄 [FINAL IMAGE PROMPT] Sending to editImage (merge+edit approach):');
      console.log('=' .repeat(80));
      console.log(optimizedDescription);
      console.log('=' .repeat(80));
      
      const editResult = await (editImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        imageUrl: (mergeResult as any).mergedImageUrl!,
        prompt: optimizedDescription,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (editResult as any).editedImageUrl,
        approach: 'merge_edit',
        seedImagesUsed: validSeedImages.slice(0, maxImages),
        reasoning: `Merged ${maxImages} seed images (from ${validSeedImages.length} provided) and edited with optimized prompt`,
        actualPrompt: optimizedDescription
      };
      
    } else if (validSeedImages.length === 1) {
      // Single seed: editImage
      console.log('[ImageCreationOptimizer] Single seed detected, using edit approach');
      
      console.log('🔄 [FINAL IMAGE PROMPT] Sending to editImage (single seed approach):');
      console.log('=' .repeat(80));
      console.log(optimizedDescription);
      console.log('=' .repeat(80));
      
      const editResult = await (editImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        imageUrl: validSeedImages[0],
        prompt: optimizedDescription,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (editResult as any).editedImageUrl,
        approach: 'edit',
        seedImagesUsed: validSeedImages,
        reasoning: `Edited single seed image with optimized prompt`,
        actualPrompt: optimizedDescription
      };
      
    } else {
      // No seeds: generateImage
      console.log('[ImageCreationOptimizer] No seeds detected, using generate approach');
      
      console.log('🆕 [FINAL IMAGE PROMPT] Sending to generateImage (no seeds approach):');
      console.log('=' .repeat(80));
      console.log(optimizedDescription);
      console.log('=' .repeat(80));
      
      const generateResult = await (generateImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        prompt: optimizedDescription,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (generateResult as any).imageUrl,
        approach: 'generate',
        seedImagesUsed: [],
        reasoning: `Generated new image from optimized prompt (no seed images available)`,
        actualPrompt: optimizedDescription
      };
    }
    
  } catch (error) {
    console.error('[ImageCreationOptimizer] Error during image creation:', error);
    
    // Fallback: always try generateImage if other approaches fail
    try {
      console.log('[ImageCreationOptimizer] Using fallback generateImage approach');
      const generateResult = await (generateImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        prompt: optimizedDescription,
        aspectRatio: context.aspectRatio || '1:1'
      });
      
      return {
        imageUrl: (generateResult as any).imageUrl,
        approach: 'generate',
        seedImagesUsed: [],
        reasoning: `Fallback to generate due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actualPrompt: optimizedDescription
      };
    } catch (finalError) {
      console.error('[ImageCreationOptimizer] Final fallback failed:', finalError);
      throw new Error(`Image creation completely failed: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
    }
  }
}