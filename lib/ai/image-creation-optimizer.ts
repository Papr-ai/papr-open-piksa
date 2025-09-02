import { generateImage } from '@/lib/ai/tools/generate-image';
import { editImage } from '@/lib/ai/tools/edit-image';
import { mergeImages } from '@/lib/ai/tools/merge-images';
import type { CreateImageInput } from '@/lib/ai/tools/create-image';

interface ImageCreationContext extends CreateImageInput {
  userId?: string;
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
  console.log('[ImageCreationOptimizer] Starting simple deterministic approach with context:', {
    description: context.description?.substring(0, 100),
    seedImages: context.seedImages?.length || 0,
    aspectRatio: context.aspectRatio
  });

  const mockSession = { user: { id: userId } };
  const mockDataStream = { write: (data: any) => console.log('[Tool]:', data) };

  // Filter out invalid seed images before processing
  const validSeedImages = (context.seedImages || []).filter(imageUrl => {
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

  console.log(`[ImageCreationOptimizer] Valid seed images: ${validSeedImages.length}`);

  try {
    if (validSeedImages.length > 1) {
      // Multiple seeds: mergeImages → editImage
      console.log('[ImageCreationOptimizer] Multiple seeds detected, using merge+edit approach');
      
      // Convert imageUrls to the correct format for mergeImages tool
      const imagesToMerge = validSeedImages.slice(0, 4).map((imageUrl, index) => {
        // Create a 2x2 grid layout for up to 4 images
        const positions = ['1x1', '1x2', '2x1', '2x2'];
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
      
      const editResult = await (editImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        imageUrl: (mergeResult as any).mergedImageUrl!,
        prompt: context.description,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (editResult as any).editedImageUrl,
        approach: 'merge_edit',
        seedImagesUsed: validSeedImages.slice(0, 4),
        reasoning: `Merged ${validSeedImages.length} seed images and edited with new prompt`,
        actualPrompt: context.description
      };
      
    } else if (validSeedImages.length === 1) {
      // Single seed: editImage
      console.log('[ImageCreationOptimizer] Single seed detected, using edit approach');
      
      const editResult = await (editImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        imageUrl: validSeedImages[0],
        prompt: context.description,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (editResult as any).editedImageUrl,
        approach: 'edit',
        seedImagesUsed: validSeedImages,
        reasoning: `Edited single seed image with new prompt`,
        actualPrompt: context.description
      };
      
    } else {
      // No seeds: generateImage
      console.log('[ImageCreationOptimizer] No seeds detected, using generate approach');
      
      const generateResult = await (generateImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        prompt: context.description,
        aspectRatio: context.aspectRatio
      });
      
      return {
        imageUrl: (generateResult as any).imageUrl,
        approach: 'generate',
        seedImagesUsed: [],
        reasoning: `Generated new image from prompt (no seed images available)`,
        actualPrompt: context.description
      };
    }
    
  } catch (error) {
    console.error('[ImageCreationOptimizer] Error during image creation:', error);
    
    // Fallback: always try generateImage if other approaches fail
    try {
      console.log('[ImageCreationOptimizer] Using fallback generateImage approach');
      const generateResult = await (generateImage({ session: mockSession as any, dataStream: mockDataStream }).execute as any)({
        prompt: context.description,
        aspectRatio: context.aspectRatio || '1:1'
      });
      
      return {
        imageUrl: (generateResult as any).imageUrl,
        approach: 'generate',
        seedImagesUsed: [],
        reasoning: `Fallback to generate due to error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actualPrompt: context.description
      };
    } catch (finalError) {
      console.error('[ImageCreationOptimizer] Final fallback failed:', finalError);
      throw new Error(`Image creation completely failed: ${finalError instanceof Error ? finalError.message : 'Unknown error'}`);
    }
  }
}