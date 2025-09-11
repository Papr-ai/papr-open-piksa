import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

interface CreateSingleBookImageProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const createSingleBookImageSchema = z.object({
  bookId: z.string().describe('The unique identifier for the book'),
  bookTitle: z.string().describe('The title of the book'),
  imageType: z.enum(['character', 'environment', 'scene']).describe('Type of image to create'),
  imageId: z.string().describe('Unique identifier for this specific image (from the plan)'),
  name: z.string().describe('Name of the character, environment, or scene'),
  description: z.string().describe('Detailed description of what to create'),
  styleBible: z.string().describe('Art style guidelines for consistent visual style'),
  
  // Character-specific fields
  physicalDescription: z.string().optional().describe('Physical appearance details for characters'),
  role: z.string().optional().describe('Character role in the story'),
  height: z.string().optional().describe('Character height (e.g., "tall", "short", "average", "4 feet", "very tall for age 8")'),
  relativeSize: z.string().optional().describe('Size relative to other characters (e.g., "tallest", "shortest", "same height as Sarah")'),
  
  // Environment-specific fields  
  timeOfDay: z.string().optional().describe('Time of day for environments'),
  weather: z.string().optional().describe('Weather conditions for environments'),
  
  // Scene-specific fields
  characters: z.array(z.string()).optional().describe('Character names in the scene'),
  characterHeights: z.record(z.string(), z.string()).optional().describe('Character heights for proper proportions in scenes. Key: character name, Value: height description (e.g., {"Sarah": "tall for age 8", "Tom": "short for age 6", "Dad": "6 feet tall"})'),
  environment: z.string().optional().describe('Environment name for the scene'),
  
  // Seed image support for consistency
  seedImages: z.array(z.string()).optional().describe('COMPLETE URLs of existing images to use as seeds for consistency. Essential for character portraits (use reference photos) and scenes (use existing character/environment assets).'),
  seedImageTypes: z.array(z.enum(['character', 'environment', 'prop', 'other'])).optional().describe('Types of seed images provided. Must match seedImages array order. Use "character" for both reference photos and existing character portraits.'),
  styleConsistency: z.boolean().optional().default(true).describe('Whether to prioritize style consistency with seed images. Defaults to true for book assets.'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).optional().default('4:3').describe('Aspect ratio for the image. Defaults to 4:3 for book illustrations.'),
  
  // Context
  sceneContext: z.string().optional().describe('Context about the current scene and story for continuity'),
  priorScene: z.string().optional().describe('Description of the previous scene for visual continuity'),
  conversationContext: z.string().optional().describe('Full conversation context for additional style guidance'),
  planId: z.string().optional().describe('Reference to the original plan'),
  currentStep: z.number().optional().describe('Current step number in the sequence'),
  totalSteps: z.number().optional().describe('Total number of steps in the sequence')
});

type CreateSingleBookImageInput = z.infer<typeof createSingleBookImageSchema>;

type CreateSingleBookImageOutput = {
  success: boolean;
  imageType: 'character' | 'environment' | 'scene';
  imageId: string;
  name: string;
  imageUrl?: string;
  description: string;
  bookId: string;
  bookTitle: string;
  savedToMemory: boolean;
  savedToDatabase: boolean;
  currentStep?: number;
  totalSteps?: number;
  nextAction: string;
  message: string;
  error?: string;
};

export const createSingleBookImage = ({ session, dataStream }: CreateSingleBookImageProps) =>
  tool({
    description: `Create a single book image (character portrait, environment, or scene composition) for a specific book project.

    **IMPORTANT: Use this tool for ALL book-related images, including character portraits, environments, and scenes.**
    
    This tool:
    - Saves images to BOTH memory AND the BookProp database table for proper book asset management
    - **SUPPORTS SEED IMAGES** for visual consistency (reference photos, existing assets)
    - Creates transparent character portraits for reuse across scenes
    - Generates empty environments for character placement
    - Composes complete scenes with characters in environments
    - Provides immediate feedback and progress updates
    
    **Seed Image Usage:**
    - **Character portraits**: Use reference photos as seed images for likeness
    - **Environments**: Use existing environment assets for consistency
    - **Scenes**: Use character portraits + environments as seeds for composition
    - **Style consistency**: Maintains visual coherence across all book assets
    
    **When to use:**
    - Creating character portraits for a book (use reference photos as seeds)
    - Creating environment plates for book scenes
    - Creating composed scenes for book spreads (use existing assets as seeds)
    - ANY image that should be part of a book's asset library
    
    **Do NOT use the generic 'createImage' tool for book content - use this tool instead.**
    **CRITICAL: This tool handles ALL image creation internally - do NOT call other image tools after using this!**
    
    **IMPORTANT: For EDITING existing scenes in book images, use the created scene images as the seed for 'editImage' tool instead with a simple prompt like "Edit the image to increase the height of the second character" !**
    - If the user wants a totally different scene image then you will need to recreate it with the right character and environment as seeds vs. use the existing scene image as the seed.
    - If user wants to modify an existing image (change height, colors, add/remove elements), use editImage
    - This tool is for creating NEW book images from scratch and saves them to BookProp database
    
    Image Types:
    - character: Transparent character portraits for reuse (saved to BookProp)
    - environment: Empty environments for character placement (saved to BookProp)
    - scene: Composed scenes with characters in environments (saved to BookProp)`,
    inputSchema: createSingleBookImageSchema,
    execute: async (input: CreateSingleBookImageInput): Promise<CreateSingleBookImageOutput> => {
      const { 
        bookId, bookTitle, imageType, imageId, name, description, styleBible,
        physicalDescription, role, height, relativeSize, timeOfDay, weather, 
        characters, characterHeights, environment, seedImages, seedImageTypes, 
        styleConsistency, aspectRatio, sceneContext, priorScene, conversationContext, 
        planId, currentStep, totalSteps 
      } = input;

      if (!session?.user?.id) {
        console.error('[createSingleBookImage] Unauthorized: No user session');
        return {
          success: false,
          imageType,
          imageId,
          name,
          description,
          bookId,
          bookTitle,
          savedToMemory: false,
          savedToDatabase: false,
          nextAction: 'Authentication required',
          message: 'User session not found',
          error: 'No user session'
        };
      }

      try {
        console.log(`[createSingleBookImage] Creating ${imageType}: ${name} for book: ${bookTitle}`);

        // Send progress update
        dataStream.write?.({
          type: 'single-book-image-start',
          content: {
            imageType,
            imageId,
            name,
            bookTitle,
            currentStep,
            totalSteps,
            planId
          }
        });

        // Create the image using optimizeImageCreation with seed image support
        let imageResult: any;
        let savedToMemory = false;
        let savedToDatabase = false;

        // Prepare valid seed images
        const validSeedImages = seedImages?.filter(url => 
          url && (url.startsWith('http') || url.startsWith('data:'))
        ) || [];

        console.log(`[createSingleBookImage] Creating ${imageType} with ${validSeedImages.length} seed images`);

        // Build comprehensive description based on image type
        let enhancedDescription = description;
        
        if (imageType === 'character') {
          enhancedDescription = `Transparent character portrait: ${name}. ${description}`;
          if (physicalDescription) enhancedDescription += ` Physical description: ${physicalDescription}`;
          if (role) enhancedDescription += ` Role: ${role}`;
          if (height) enhancedDescription += ` Height: ${height}`;
          if (relativeSize) enhancedDescription += ` Size relative to others: ${relativeSize}`;
          enhancedDescription += ` Style: ${styleBible || 'watercolor and ink line illustration'}`;
        } else if (imageType === 'environment') {
          enhancedDescription = `Empty environment plate: ${name}. ${description}`;
          if (timeOfDay) enhancedDescription += ` Time: ${timeOfDay}`;
          if (weather) enhancedDescription += ` Weather: ${weather}`;
          enhancedDescription += ` Style: ${styleBible || 'watercolor and ink line illustration'}. Clear foreground for character placement.`;
        } else if (imageType === 'scene') {
          enhancedDescription = `Complete scene composition: ${name}. ${description}`;
          if (characters?.length) enhancedDescription += ` Characters: ${characters.join(', ')}`;
          if (characterHeights) {
            const heightDescriptions = Object.entries(characterHeights)
              .map(([char, height]) => `${char} (${height})`)
              .join(', ');
            enhancedDescription += ` Character Heights: ${heightDescriptions}`;
          }
          if (environment) enhancedDescription += ` Environment: ${environment}`;
          enhancedDescription += ` Style: ${styleBible || 'watercolor and ink line illustration'}`;
        }

        // Create image directly using appropriate approach based on seed images
        if (validSeedImages.length > 1) {
          // Multiple seeds: merge + edit approach
          console.log(`[createSingleBookImage] Using merge+edit approach with ${validSeedImages.length} seeds`);
          
          const { mergeImages } = await import('./merge-images');
          const { editImage } = await import('./edit-image');
          
          // First merge the seed images (use same logic as optimizeImageCreation)
          const maxImages = Math.min(validSeedImages.length, 6);
          const imagesToMerge = validSeedImages.slice(0, maxImages).map((imageUrl, index) => {
            const positions = [
              '1x1', '1x2', '1x3', 
              '2x1', '2x2', '2x3'
            ];
            return {
              imageUrl,
              position: positions[index] || '1x1',
              spanRows: 1,
              spanCols: 1
            };
          });
          
          const mergeResult = await (mergeImages({ session, dataStream }).execute as any)({
            images: imagesToMerge,
            backgroundColor: '#ffffff',
            outputWidth: 1024,
            outputHeight: 1024
          });
          
          if (mergeResult.mergedImageUrl) {
            // Then edit the merged image with the description
            const editResult = await (editImage({ session, dataStream }).execute as any)({
              imageUrl: mergeResult.mergedImageUrl,
              prompt: enhancedDescription,
              editType: 'modify',
              preserveOriginal: true
            });
            
            imageResult = {
              success: !!editResult.editedImageUrl,
              imageUrl: editResult.editedImageUrl,
              approach: 'merge_edit'
            };
          } else {
            throw new Error('Failed to merge seed images');
          }
          
        } else if (validSeedImages.length === 1) {
          // Single seed: edit approach
          console.log('[createSingleBookImage] Using edit approach with single seed');
          
          const { editImage } = await import('./edit-image');
          const editResult = await (editImage({ session, dataStream }).execute as any)({
            imageUrl: validSeedImages[0],
            prompt: enhancedDescription,
            editType: 'modify',
            preserveOriginal: true
          });
          
          imageResult = {
            success: !!editResult.editedImageUrl,
            imageUrl: editResult.editedImageUrl,
            approach: 'edit'
          };
          
        } else {
          // No seeds: generate approach
          console.log('[createSingleBookImage] Using generate approach (no seeds)');
          
          const { generateImage } = await import('./generate-image');
          const generateResult = await (generateImage({ session, dataStream }).execute as any)({
            prompt: enhancedDescription,
            aspectRatio: aspectRatio || '4:3'
          });
          
          imageResult = {
            success: !!generateResult.imageUrl,
            imageUrl: generateResult.imageUrl,
            approach: 'generate'
          };
        }

        if (imageResult.success && imageResult.imageUrl) {
          let memoryId: string | null = null;
          
          // Save to memory
          try {
            memoryId = await saveImageToMemory({
              imageType,
              name,
              description,
              imageUrl: imageResult.imageUrl,
              bookId,
              bookTitle,
              metadata: {
                physicalDescription,
                role,
                height,
                relativeSize,
                timeOfDay,
                weather,
                characters,
                characterHeights,
                environment
              },
              session
            });
            savedToMemory = !!memoryId;
            console.log(`[createSingleBookImage] Memory save result: ${memoryId ? 'success' : 'failed'}, ID: ${memoryId}`);
          } catch (memoryError) {
            console.error('[createSingleBookImage] Error saving to memory:', memoryError);
          }

          // Save to database
          try {
            console.log(`[createSingleBookImage] 🗄️ Attempting to save "${name}" to database with memoryId: ${memoryId}...`);
            await saveImageToDatabase({
              imageType,
              name,
              description,
              imageUrl: imageResult.imageUrl,
              bookId,
              bookTitle,
              memoryId, // Pass the memory ID
              metadata: {
                physicalDescription,
                role,
                height,
                relativeSize,
                timeOfDay,
                weather,
                characters,
                characterHeights,
                environment
              },
              session
            });
            savedToDatabase = true;
            console.log(`[createSingleBookImage] ✅ Successfully saved "${name}" to BookProp table with memoryId: ${memoryId}`);
          } catch (dbError) {
            console.error(`[createSingleBookImage] ❌ Error saving "${name}" to database:`, dbError);
          }

          // **NEW: Auto-insert scene images into book content**
          if (imageType === 'scene') {
            try {
              console.log(`[createSingleBookImage] Auto-inserting scene image for ${name}`);
              
              const { insertSceneImageIntoBook, extractSceneInfo } = await import('@/lib/ai/book-content-updater');
              
              // Extract chapter number from scene ID or use a default
              const sceneInfo = extractSceneInfo(name);
              const chapterNumber = sceneInfo.sceneNumber || 1; // Default to chapter 1 if not found
              
              const insertionResult = await insertSceneImageIntoBook({
                bookId,
                chapterNumber,
                sceneId: name,
                imageUrl: imageResult.imageUrl,
                synopsis: description,
                storyContext: conversationContext,
                userId: session.user.id
              });
              
              if (insertionResult.success) {
                console.log(`[createSingleBookImage] ✅ Successfully inserted scene image into book`);
                
                // Update completion message to indicate auto-insertion
                dataStream.write?.({
                  type: 'single-book-image-auto-inserted',
                  content: {
                    imageType,
                    imageId,
                    name,
                    imageUrl: imageResult.imageUrl,
                    bookTitle,
                    chapterNumber,
                    sceneId: name,
                    insertedSuccessfully: true
                  }
                });
              } else {
                console.warn(`[createSingleBookImage] Failed to insert scene image: ${insertionResult.error}`);
                
                dataStream.write?.({
                  type: 'single-book-image-auto-insert-failed',
                  content: {
                    imageType,
                    imageId,
                    name,
                    error: insertionResult.error,
                    imageUrl: imageResult.imageUrl
                  }
                });
              }
              
            } catch (insertError) {
              console.error('[createSingleBookImage] Error auto-inserting scene image:', insertError);
              
              dataStream.write?.({
                type: 'single-book-image-auto-insert-error',
                content: {
                  imageType,
                  imageId,
                  name,
                  error: insertError instanceof Error ? insertError.message : 'Unknown insertion error'
                }
              });
            }
          }

          // Send completion update
          dataStream.write?.({
            type: 'single-book-image-complete',
            content: {
              imageType,
              imageId,
              name,
              imageUrl: imageResult.imageUrl,
              bookTitle,
              currentStep,
              totalSteps,
              planId,
              savedToMemory,
              savedToDatabase,
              seedImages: validSeedImages,
              approach: imageResult.approach || 'unknown'
            }
          });
        }

        const progressText = currentStep && totalSteps ? ` (${currentStep}/${totalSteps})` : '';
        const nextAction = currentStep && totalSteps && currentStep < totalSteps
          ? `Ready for next image${progressText}`
          : 'Image creation sequence complete';

        // Prepare the response - handle potential OpenAI download errors gracefully
        const response = {
          success: imageResult.success,
          imageType,
          imageId,
          name,
          imageUrl: imageResult.success ? imageResult.imageUrl : undefined,
          description,
          bookId,
          bookTitle,
          savedToMemory,
          savedToDatabase,
          currentStep,
          totalSteps,
          nextAction,
          message: imageResult.success 
            ? `✅ **${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Created${progressText}**\n\n` +
              `**${name}** for "${bookTitle}"\n` +
              `${savedToMemory ? '💾 Saved to memory\n' : ''}` +
              `${savedToDatabase ? '🗃️ Saved to database\n' : ''}` +
              `\n${nextAction}`
            : `❌ Failed to create ${imageType}: ${name}`,
          error: imageResult.success ? undefined : imageResult.error
        };

        // Note: If OpenAI fails to download the image URL for validation, 
        // the image is still created and accessible via dataStream for the UI
        console.log(`[createSingleBookImage] Returning response with imageUrl: ${response.imageUrl ? 'included' : 'excluded'}`);
        
        return response;

      } catch (error) {
        console.error('[createSingleBookImage] Error:', error);
        
        dataStream.write?.({
          type: 'single-book-image-error',
          content: {
            imageType,
            imageId,
            name,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        return {
          success: false,
          imageType,
          imageId,
          name,
          description,
          bookId,
          bookTitle,
          savedToMemory: false,
          savedToDatabase: false,
          currentStep,
          totalSteps,
          nextAction: 'Error occurred',
          message: `❌ Failed to create ${imageType}: ${name}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
  });

// Helper functions (simplified versions of the existing logic)
async function createCharacterPortrait(params: any) {
  // Import and use existing character creation logic
  const { createImage } = await import('./create-image');
  const imageTool = createImage({ session: params.session });
  
  const prompt = `Create a transparent character portrait of ${params.name}. ${params.description}. Physical appearance: ${params.physicalDescription}. Style: ${params.styleBible}. Character should be on transparent background for easy placement in scenes.`;
  
  if (!imageTool.execute) {
    throw new Error('Image tool execute method is not available');
  }
  
  return await imageTool.execute({
    description: prompt,
    aspectRatio: '1:1',
    styleConsistency: true
  }, { toolCallId: 'character-' + Date.now(), messages: [] });
}

async function createEnvironmentImage(params: any) {
  const { createImage } = await import('./create-image');
  const imageTool = createImage({ session: params.session });
  
  const prompt = `Create an empty top-view environment image of ${params.name}. ${params.description}. Time: ${params.timeOfDay}, Weather: ${params.weather}. Style: ${params.styleBible}. Environment should be completely empty with no characters for later character placement.`;
  
  if (!imageTool.execute) {
    throw new Error('Image tool execute method is not available');
  }
  
  return await imageTool.execute({
    description: prompt,
    aspectRatio: '1:1',
    styleConsistency: true
  }, { toolCallId: 'environment-' + Date.now(), messages: [] });
}

async function createSceneComposition(params: any) {
  const { createImage } = await import('./create-image');
  const imageTool = createImage({ session: params.session });
  
  const prompt = `Create a scene composition for ${params.name}. ${params.description}. Characters: ${params.characters.join(', ')}. Environment: ${params.environment}. Style: ${params.styleBible}.`;
  
  if (!imageTool.execute) {
    throw new Error('Image tool execute method is not available');
  }
  
  return await imageTool.execute({
    description: prompt,
    aspectRatio: '16:9',
    styleConsistency: true
  }, { toolCallId: 'scene-' + Date.now(), messages: [] });
}

async function saveImageToMemory(params: any): Promise<string | null> {
  // Save to Papr Memory and return the memory ID
  try {
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const { initPaprMemory } = await import('@/lib/ai/memory');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey) {
      console.log('[saveImageToMemory] No Papr API key available');
      return null;
    }

    const paprUserId = await ensurePaprUser(params.session.user.id, apiKey);
    if (!paprUserId) {
      console.log('[saveImageToMemory] Failed to get Papr user ID');
      return null;
    }

    const content = `${params.imageType.charAt(0).toUpperCase() + params.imageType.slice(1)}: ${params.name}\n\n${params.description}\n\nImage URL: ${params.imageUrl}\nType: ${params.imageType}\nBook: ${params.bookTitle}`;
    
    // Initialize Papr client directly to get the memory ID
    const paprClient = initPaprMemory(apiKey, {
      baseURL: process.env.PAPR_MEMORY_API_URL || 'https://memory.papr.ai',
    });

    const memoryParams = {
      content,
      type: 'text' as const,
      metadata: {
        sourceType: 'PaprChat_BookImage',
        user_id: paprUserId,
        external_user_id: params.session.user.id,
        createdAt: new Date().toISOString(),
        topics: [params.imageType, 'book images', params.bookTitle.toLowerCase().replace(/\s+/g, '_')],
        hierarchical_structures: `book_images/${params.bookId}/${params.imageType}`,
        customMetadata: {
          [`${params.imageType}_name`]: params.name,
          book_id: params.bookId,
          book_title: params.bookTitle,
          image_url: params.imageUrl,
          app_user_id: params.session.user.id,
          tool: 'createSingleBookImage',
          ...params.metadata
        }
      },
      skip_background_processing: false
    };

    const response = await paprClient.memory.add(memoryParams);
    
    if (!response || !response.data?.[0]?.memoryId) {
      console.error('[saveImageToMemory] Invalid response:', response);
      return null;
    }

    const memoryId = response.data[0].memoryId;
    console.log(`[saveImageToMemory] ✅ Saved to memory with ID: ${memoryId}`);

    // Track memory usage
    try {
      const { trackMemoryAdd } = await import('@/lib/subscription/usage-middleware');
      await trackMemoryAdd(params.session.user.id);
    } catch (error) {
      console.error('[saveImageToMemory] Failed to track memory usage:', error);
    }

    return memoryId;
  } catch (error) {
    console.error('[saveImageToMemory] Error saving to memory:', error);
    return null;
  }
}

async function saveImageToDatabase(params: any) {
  // Save to book_props table
  console.log(`[saveImageToDatabase] 🗄️ Saving ${params.imageType} "${params.name}" to BookProp table...`);
  console.log(`[saveImageToDatabase] Parameters:`, {
    bookId: params.bookId,
    bookTitle: params.bookTitle,
    type: params.imageType,
    name: params.name,
    userId: params.session.user?.id,
    hasImageUrl: !!params.imageUrl,
    hasDescription: !!params.description,
    memoryId: params.memoryId
  });
  
  const { createBookProp } = await import('@/lib/db/book-queries');
  
  const bookProp = await createBookProp({
    bookId: params.bookId,
    bookTitle: params.bookTitle,
    type: params.imageType,
    name: params.name,
    description: params.description,
    imageUrl: params.imageUrl,
    metadata: params.metadata,
    memoryId: params.memoryId, // Include the memory ID
    userId: params.session.user.id
  });
  
  console.log(`[saveImageToDatabase] ✅ Successfully saved to BookProp table with ID: ${bookProp.id} and memoryId: ${params.memoryId}`);
}
