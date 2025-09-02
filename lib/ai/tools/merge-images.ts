import { tool } from 'ai';
import { z } from 'zod';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

// Define the grid position schema
const gridPositionSchema = z.object({
  imageUrl: z.string().describe('URL of the image to place in the grid'),
  position: z.string().describe('Grid position in format "rowxcol" (e.g., "1x1", "1x2", "2x1", etc.). Grid is 4x4, so valid positions are 1x1 to 4x4'),
  spanRows: z.number().min(1).max(4).default(1).describe('Number of rows this image should span (1-4)'),
  spanCols: z.number().min(1).max(4).default(1).describe('Number of columns this image should span (1-4)'),
});

const mergeImagesSchema = z.object({
  images: z.array(gridPositionSchema).min(1).max(16).describe('Array of images with their grid positions. Maximum 16 images for a 4x4 grid'),
  backgroundColor: z.string().default('#ffffff').describe('Background color for empty grid cells (hex color)'),
  outputWidth: z.number().default(1024).describe('Width of the final merged image in pixels'),
  outputHeight: z.number().default(1024).describe('Height of the final merged image in pixels'),
});

type MergeImagesInput = z.infer<typeof mergeImagesSchema>;
type MergeImagesOutput = {
  success: boolean;
  mergedImageUrl?: string;
  gridLayout?: any;
  dimensions?: { width: number; height: number };
  processedImages?: number;
  format?: string;
  message?: string;
  error?: string;
};

interface MergeImagesProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const mergeImages = ({ session, dataStream }: MergeImagesProps) =>
  tool({
    description: `Merge multiple images into a single 4x4 grid layout. This is useful for creating composite images from multiple sources that can then be used as a seed for image editing.
    
    The grid system works as follows:
    - Grid positions are specified as "rowxcol" (e.g., "1x1" for top-left, "4x4" for bottom-right)
    - Images can span multiple cells using spanRows and spanCols
    - The final merged image will be uploaded to Vercel Blob and can be used with other tools
    
    Examples:
    - Place image at top-left: position "1x1"
    - Place image spanning 2x2 area at top-left: position "1x1", spanRows 2, spanCols 2
    - Place image in bottom-right corner: position "4x4"`,
    inputSchema: mergeImagesSchema,
    execute: async (input: MergeImagesInput): Promise<MergeImagesOutput> => {
      const { images, backgroundColor, outputWidth, outputHeight } = input;
      if (!session?.user?.id) {
        throw new Error('User must be authenticated to merge images');
      }

      try {
        console.log('[merge-images] Starting image merge with', images.length, 'images');

        if (!images || !Array.isArray(images) || images.length === 0) {
          throw new Error('Images array is required');
        }

        // Calculate grid cell dimensions
        const cellWidth = Math.floor(outputWidth / 4);
        const cellHeight = Math.floor(outputHeight / 4);

        // Process each image and prepare for merging
        const processedImages = [];
        const gridLayout = [];

        for (const imageConfig of images) {
          try {
            // Validate image URL first
            if (!imageConfig.imageUrl || typeof imageConfig.imageUrl !== 'string') {
              console.warn(`[merge-images] Invalid image URL:`, imageConfig.imageUrl, 'skipping');
              continue;
            }
            
            // Check for incomplete data URLs
            if (imageConfig.imageUrl === 'data:image' || 
                (imageConfig.imageUrl.startsWith('data:') && !imageConfig.imageUrl.includes(';base64,'))) {
              console.warn(`[merge-images] Incomplete data URL: ${imageConfig.imageUrl.substring(0, 50)}, skipping`);
              continue;
            }

            // Parse position
            const [rowStr, colStr] = imageConfig.position.split('x');
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);

            if (row < 1 || row > 4 || col < 1 || col > 4) {
              console.warn(`[merge-images] Invalid position ${imageConfig.position}, skipping`);
              continue;
            }

            // Calculate dimensions and position
            const width = cellWidth * imageConfig.spanCols;
            const height = cellHeight * imageConfig.spanRows;
            const x = (col - 1) * cellWidth;
            const y = (row - 1) * cellHeight;

            console.log(`[merge-images] Processing image at ${imageConfig.position}, size: ${width}x${height}, pos: ${x},${y}`);

            // Store image info for processing (Sharp will fetch the images later)
            processedImages.push({
              x,
              y,
              width,
              height,
              originalUrl: imageConfig.imageUrl,
            });

            gridLayout.push({
              position: imageConfig.position,
              spanRows: imageConfig.spanRows,
              spanCols: imageConfig.spanCols,
              dimensions: { width, height, x, y },
              originalUrl: imageConfig.imageUrl,
            });

          } catch (error) {
            console.error(`[merge-images] Error processing image ${imageConfig.imageUrl}:`, error);
            continue;
          }
        }

        if (processedImages.length === 0) {
          throw new Error('No valid images to merge');
        }

        console.log('[merge-images] Creating merged image using Sharp...');

        // Create base canvas with background color
        const baseImage = sharp({
          create: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            background: backgroundColor
          }
        }).png();

        // Prepare composite operations for Sharp
        const compositeOperations = [];
        
        for (const img of processedImages) {
          try {
            // Fetch and process each image
            const imageResponse = await fetch(img.originalUrl);
            if (!imageResponse.ok) continue;
            
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            
            // Resize image to fit the grid cell
            const resizedImageBuffer = await sharp(imageBuffer)
              .resize(img.width, img.height, { fit: 'cover' })
              .png()
              .toBuffer();

            compositeOperations.push({
              input: resizedImageBuffer,
              top: img.y,
              left: img.x
            });
          } catch (error) {
            console.warn(`[merge-images] Failed to process image ${img.originalUrl}:`, error);
            continue;
          }
        }

        if (compositeOperations.length === 0) {
          throw new Error('No images could be processed for merging');
        }

        // Composite all images onto the base canvas
        const mergedImageBuffer = await baseImage
          .composite(compositeOperations)
          .png()
          .toBuffer();

        console.log('[merge-images] Sharp merge completed, uploading to Vercel Blob...');

        // Upload the merged PNG to Vercel Blob
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const filename = `images/merged/${session.user.id}-${timestamp}-${randomId}.png`;

        const blob = await put(filename, mergedImageBuffer, {
          access: 'public',
          contentType: 'image/png',
        });

        console.log('[merge-images] Successfully uploaded merged PNG image:', blob.url);
        
        // Stream the result for UI updates
        dataStream.write?.({
          type: 'images-merged',
          content: {
            mergedImageUrl: blob.url,
            gridLayout: gridLayout,
            dimensions: { width: outputWidth, height: outputHeight },
            processedImages: processedImages.length,
            format: 'png',
          },
        });

        return {
          success: true,
          mergedImageUrl: blob.url,
          dimensions: { width: outputWidth, height: outputHeight },
          processedImages: processedImages.length,
          format: 'png',
          message: `Successfully merged ${images.length} images into a ${outputWidth}x${outputHeight} PNG grid. URL: ${blob.url} - Ready for editImage tool!`,
        };
      } catch (error) {
        console.error('[merge-images] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to merge images',
        };
      }
    },
  });
