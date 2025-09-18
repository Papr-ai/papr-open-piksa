import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

// Helper function to extract key physical features from character description for seed image consistency
function extractCharacterPhysicalFeatures(characterDescription: string, characterName: string): string {
  const features = [];
  const desc = characterDescription.toLowerCase();
  
  // Extract age
  const ageMatches = desc.match(/(?:age|aged?)\s*:?\s*(\d+)|(\d+)\s*years?\s*old|(?:is|was)\s*(\d+)/i);
  if (ageMatches) {
    const age = ageMatches[1] || ageMatches[2] || ageMatches[3];
    features.push(`- Age: ${age} years old`);
  } else if (desc.includes('child') || desc.includes('kid') || desc.includes('young')) {
    features.push(`- Age: Child (approximately 5-8 years old)`);
  }
  
  // Extract eye color
  const eyeColors = ['blue', 'brown', 'green', 'hazel', 'gray', 'grey', 'amber', 'violet', 'dark', 'light'];
  for (const color of eyeColors) {
    if (desc.includes(`${color} eye`) || desc.includes(`${color}-eye`)) {
      features.push(`- Eyes: ${color.charAt(0).toUpperCase() + color.slice(1)} eyes`);
      break;
    }
  }
  
  // Extract hair color and style
  const hairColors = ['black', 'brown', 'blonde', 'blond', 'red', 'auburn', 'ginger', 'gray', 'grey', 'white', 'dark', 'light', 'golden'];
  const hairStyles = ['curly', 'wavy', 'straight', 'long', 'short', 'braided', 'ponytail', 'pigtails', 'bob'];
  
  let hairDescription = '';
  for (const color of hairColors) {
    if (desc.includes(`${color} hair`)) {
      hairDescription = color.charAt(0).toUpperCase() + color.slice(1);
      break;
    }
  }
  
  for (const style of hairStyles) {
    if (desc.includes(`${style} hair`) || desc.includes(`hair is ${style}`)) {
      hairDescription += (hairDescription ? ', ' : '') + style;
      break;
    }
  }
  
  if (hairDescription) {
    features.push(`- Hair: ${hairDescription} hair`);
  }
  
  // Extract height/size
  if (desc.includes('tall') || desc.includes('height')) {
    if (desc.includes('short')) {
      features.push(`- Height: Short for age`);
    } else if (desc.includes('tall')) {
      features.push(`- Height: Tall for age`);
    }
  }
  
  // Extract distinctive features
  if (desc.includes('freckle')) features.push(`- Features: Has freckles`);
  if (desc.includes('dimple')) features.push(`- Features: Has dimples`);
  if (desc.includes('glasses')) features.push(`- Accessories: Wears glasses`);
  
  // Extract clothing/outfit details
  const clothingMatches = desc.match(/wearing\s+([^.]+)|dressed\s+in\s+([^.]+)|outfit[:\s]+([^.]+)/i);
  if (clothingMatches) {
    const outfit = clothingMatches[1] || clothingMatches[2] || clothingMatches[3];
    features.push(`- Clothing: ${outfit.trim()}`);
  }
  
  // If no features found, add a general note
  if (features.length === 0) {
    features.push(`- Maintain all physical features exactly as shown in seed image`);
    features.push(`- Keep consistent appearance throughout the book`);
  }
  
  return features.join('\n');
}

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
  age: z.union([z.number(), z.string()]).optional().describe('Character age (e.g., 7, "8 years old", "young adult")'),
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
  seedImages?: string[];
  approach?: string;
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
    
    **🔄 WORKFLOW REFRESH REQUIREMENT:**
    After creating/updating an image, you MUST call createBookArtifact with action: 'update_step' to refresh the workflow UI:
    - Character images: Call createBookArtifact with stepNumber: 2 to refresh Step 2 (Character Creation)
    - Environment images: Call createBookArtifact with stepNumber: 4 to refresh Step 4 (Environment Design)
    - Scene images: Call createBookArtifact with stepNumber: 5 to refresh Step 5 (Scene Composition)
    This ensures the new images appear in the workflow immediately.
    
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
        physicalDescription, role, age, height, relativeSize, timeOfDay, weather, 
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
          error: 'No user session',
          seedImages: undefined,
          approach: undefined
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
          if (age) enhancedDescription += ` Age: ${age}`;
          if (height) enhancedDescription += ` Height: ${height}`;
          if (relativeSize) enhancedDescription += ` Size relative to others: ${relativeSize}`;
          
          // Extract and emphasize key physical features for seed image consistency
          if (physicalDescription || description) {
            const fullDescription = `${description} ${physicalDescription || ''}`;
            const physicalFeatures = extractCharacterPhysicalFeatures(fullDescription, name);
            if (physicalFeatures) {
              enhancedDescription += `

🎯 CRITICAL PHYSICAL FEATURES TO MAINTAIN (especially when using seed images):
${physicalFeatures}`;
            }
          }
          
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
          
          // Add character consistency notes for scenes with seed images
          if (validSeedImages.length > 0 && characters?.length) {
            enhancedDescription += `

🎯 CRITICAL CHARACTER CONSISTENCY (when using character seed images):
- Maintain EXACT physical features from seed character portraits (age, eye color, hair style, distinctive features)
- Keep consistent clothing/outfits as shown in character seeds
- Preserve character proportions and relative heights as specified
- Ensure characters look identical to their seed portraits in this scene`;
          }
          
          enhancedDescription += ` Style: ${styleBible || 'watercolor and ink line illustration'}`;
        }

        // Use optimizeImageCreation for enhanced prompt optimization with book context
        console.log('[createSingleBookImage] Using optimizeImageCreation for enhanced book context');
        
        const { optimizeImageCreation } = await import('@/lib/ai/image-creation-optimizer');
        
        // Extract book context from styleBible and other parameters
        const bookContext = {
          styleBible,
          bookTitle,
          // Extract themes and genre from styleBible if available
          bookThemes: styleBible?.includes('theme') ? [styleBible.split('theme')[1]?.split(',')[0]?.trim()] : undefined,
          bookGenre: styleBible?.includes('children') ? 'children\'s book' : undefined,
          targetAge: styleBible?.includes('age') ? styleBible.split('age')[1]?.split(',')[0]?.trim() : undefined,
        };
        
        const optimizedResult = await optimizeImageCreation({
          description: enhancedDescription,
          seedImages: validSeedImages,
          seedImageTypes: validSeedImages.map(() => imageType as any),
          sceneContext: `Book image creation for ${bookTitle}`,
          styleConsistency: true,
          aspectRatio: (aspectRatio as any) || '4:3',
          ...bookContext
        }, session.user?.id!);
        
        imageResult = {
          success: !!optimizedResult.imageUrl,
          imageUrl: optimizedResult.imageUrl,
          approach: optimizedResult.approach
        };

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

          // **NEW: Auto-insert scene images into book content (only for traditional chapter-based books)**
          if (imageType === 'scene') {
            try {
              // Check if this is a book creation workflow (which uses chapterNumber: 0 for workflow state)
              // Skip auto-insertion for workflow books as they handle images differently
              const { getBookChaptersByBookId } = await import('@/lib/db/book-queries');
              const chapters = await getBookChaptersByBookId(bookId, session.user.id);
              const workflowRecord = chapters.find(ch => ch.chapterNumber === 0);
              
              let insertionResult;
              let chapterNumber = 0; // Default for workflow books
              
              if (workflowRecord) {
                console.log(`[createSingleBookImage] 📚 Detected book creation workflow - skipping auto-insertion (images handled by workflow)`);
                // Skip the insertion logic for workflow books
                insertionResult = { success: true, updatedContent: '', skipReason: 'workflow-book' };
                chapterNumber = 0; // Workflow books use chapter 0
              } else {
                console.log(`[createSingleBookImage] Auto-inserting scene image for ${name}`);
                
                const { insertSceneImageIntoBook, extractSceneInfo } = await import('@/lib/ai/book-content-updater');
                
                // Extract chapter number from scene ID or use a default
                const sceneInfo = extractSceneInfo(name);
                chapterNumber = sceneInfo.sceneNumber || 1; // Default to chapter 1 if not found
                
                insertionResult = await insertSceneImageIntoBook({
                  bookId,
                  chapterNumber,
                  sceneId: name,
                  imageUrl: imageResult.imageUrl,
                  synopsis: description,
                  storyContext: conversationContext,
                  userId: session.user.id
                });
              }
              
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
              `\n🔄 **Next: Update workflow to show new image**\n` +
              `Call createBookArtifact with action: 'update_step', stepNumber: ${imageType === 'character' ? 2 : imageType === 'environment' ? 4 : 5}\n` +
              `\n${nextAction}`
            : `❌ Failed to create ${imageType}: ${name}`,
          error: imageResult.success ? undefined : imageResult.error,
          seedImages: validSeedImages.length > 0 ? validSeedImages : undefined,
          approach: imageResult.approach
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
          error: error instanceof Error ? error.message : 'Unknown error',
          seedImages: undefined,
          approach: undefined
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
  console.log('[createSingleBookImage] Creating UNIQUE environment with enhanced prompts:', params.name);
  
  // Use optimizeImageCreation for better prompt optimization
  const { optimizeImageCreation } = await import('@/lib/ai/image-creation-optimizer');
  
  // Create a much more detailed and unique environment description
  const uniqueIdentifier = `${params.name}_${params.timeOfDay}_${params.weather}_${Date.now()}`;
  const environmentDescription = `UNIQUE ENVIRONMENT MASTER PLATE: Create a completely original and distinct "${params.name}" environment that has never been created before. 

SPECIFIC LOCATION: ${params.name}
DETAILED DESCRIPTION: ${params.description}
TIME OF DAY: ${params.timeOfDay} - ensure lighting, shadows, and atmosphere reflect this specific time
WEATHER CONDITIONS: ${params.weather} - show clear weather effects and atmospheric conditions
UNIQUE ELEMENTS: Include specific architectural details, unique props, distinctive lighting, and characteristic features that make this "${params.name}" location completely different from any other environment
COMPOSITION: Wide establishing shot showing the complete environment space, empty of people but rich in environmental storytelling details
VISUAL STYLE: ${params.styleBible}

CRITICAL: This must be a completely unique interpretation of "${params.name}" - avoid generic or similar-looking environments. Focus on distinctive visual elements that make this location immediately recognizable and different from other locations.

Unique ID: ${uniqueIdentifier}`;
  
  try {
    const optimizedResult = await optimizeImageCreation({
      description: environmentDescription,
      seedImages: [], // Let it search memory automatically if no seeds provided by agent
      seedImageTypes: ['environment'],
      sceneContext: `Empty environment master plate for book scenes - ${params.name}`,
      styleConsistency: true,
      aspectRatio: '4:3',
      
      // Enhanced book context
      styleBible: params.styleBible,
      bookTitle: params.bookTitle,
      bookGenre: params.styleBible?.includes('children') ? 'children\'s book' : undefined,
      targetAge: params.styleBible?.includes('age') ? params.styleBible.split('age')[1]?.split(',')[0]?.trim() : undefined
    }, params.session.user?.id!);

    console.log('[createSingleBookImage] Environment optimization complete:', {
      approach: optimizedResult.approach,
      reasoning: optimizedResult.reasoning.substring(0, 100) + '...'
    });

    return {
      success: true,
      imageUrl: optimizedResult.imageUrl,
      actualPrompt: optimizedResult.actualPrompt,
      approach: optimizedResult.approach,
      seedImagesUsed: optimizedResult.seedImagesUsed,
      reasoning: optimizedResult.reasoning
    };
  } catch (error) {
    console.error('[createSingleBookImage] Environment optimization failed:', error);
    
    // Fallback to basic createImage
    const { createImage } = await import('./create-image');
    const imageTool = createImage({ session: params.session });
    
    if (!imageTool.execute) {
      throw new Error('Image tool execute method is not available');
    }
    
    return await imageTool.execute({
      description: environmentDescription,
      aspectRatio: '4:3',
      styleConsistency: true
    }, { toolCallId: 'environment-fallback-' + Date.now(), messages: [] });
  }
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

    // Convert complex metadata objects to strings for memory validation
    const sanitizedMetadata = { ...params.metadata };
    if (sanitizedMetadata.characterHeights && typeof sanitizedMetadata.characterHeights === 'object') {
      sanitizedMetadata.characterHeights = JSON.stringify(sanitizedMetadata.characterHeights);
    }

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
          ...sanitizedMetadata
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
