/**
 * Structured Book Image Creation Tool
 * Follows strict steps: Memory Check → Character Portraits → Environments → Scene Composition
 */

import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

// Input schema for structured book image creation
const structuredBookImageCreationSchema = z.object({
  bookId: z.string().uuid().describe('Unique identifier for the book (must be a valid UUID)'),
  bookTitle: z.string().describe('Title of the book'),
  characters: z.array(z.object({
    name: z.string().describe('Character name'),
    description: z.string().describe('Physical description of the character'),
    role: z.string().optional().describe('Character role in the story')
  })).describe('List of characters that need portraits'),
  environments: z.array(z.object({
    name: z.string().describe('Environment name (e.g., "Forest Clearing", "Castle Courtyard")'),
    description: z.string().describe('Detailed description of the environment'),
    timeOfDay: z.string().optional().describe('Time of day for the environment'),
    weather: z.string().optional().describe('Weather conditions')
  })).describe('List of environments that need to be created'),
  scenes: z.array(z.object({
    sceneId: z.string().describe('Unique identifier for the scene'),
    description: z.string().describe('What happens in this scene'),
    environment: z.string().describe('Which environment this scene takes place in'),
    characters: z.array(z.string()).describe('Which characters appear in this scene'),
    actions: z.string().optional().describe('Specific actions or poses for characters')
  })).describe('List of scenes to create by compositing characters and environments'),
  conversationContext: z.string().optional().describe('CRITICAL: Complete context from the conversation including Style Bible, character details, plot elements, and any established visual style to ensure consistency across all images'),
  skipApprovalGates: z.boolean().optional().default(false).describe('Set to true to skip user approval gates and create all images automatically'),
  approvedCharacters: z.boolean().optional().default(false).describe('Set to true if characters have already been approved by the user'),
  approvedEnvironments: z.boolean().optional().default(false).describe('Set to true if environments have already been approved by the user')
});

export type StructuredBookImageCreationInput = z.infer<typeof structuredBookImageCreationSchema>;

interface MemorySearchResult {
  found: boolean;
  memoryId?: string;
  imageUrl?: string;
  description?: string;
}

interface FormattedMemory {
  id: string;
  content?: string;
  createdAt: string;
  metadata?: {
    customMetadata?: {
      character_name?: string;
      book_id?: string;
      kind?: string;
      content_type?: string;
      image_url?: string;
      environment_name?: string;
      [key: string]: any;
    };
    [key: string]: unknown;
  };
}

// Helper function to extract image result from createImage tool response
async function extractImageResult(result: any): Promise<{
  imageUrl?: string;
  actualPrompt?: string;
  approach?: string;
  seedImagesUsed?: string[];
  reasoning?: string;
} | null> {
  if (!result) return null;
  
  // If it's a direct object with imageUrl
  if (typeof result === 'object' && result.imageUrl) {
    return {
      imageUrl: result.imageUrl,
      actualPrompt: result.actualPrompt,
      approach: result.approach,
      seedImagesUsed: result.seedImagesUsed,
      reasoning: result.reasoning
    };
  }
  
  // If it's an AsyncIterable, we need to consume it
  if (result && typeof result[Symbol.asyncIterator] === 'function') {
    for await (const chunk of result) {
      if (chunk && chunk.imageUrl) {
        return {
          imageUrl: chunk.imageUrl,
          actualPrompt: chunk.actualPrompt,
          approach: chunk.approach,
          seedImagesUsed: chunk.seedImagesUsed,
          reasoning: chunk.reasoning
        };
      }
    }
  }
  
  return null;
}

interface CreationResult {
  step: string;
  success: boolean;
  item: string;
  imageUrl?: string;
  memoryId?: string;
  error?: string;
  prompt?: string;
  approach?: string;
  seedImagesUsed?: string[];
  reasoning?: string;
}

interface StructuredBookImageCreationOutput {
  success: boolean;
  bookId: string;
  results: {
    memoryChecks: { characters: MemorySearchResult[]; environments: MemorySearchResult[] };
    characterPortraits: CreationResult[];
    environments: CreationResult[];
    scenes: CreationResult[];
  };
  summary: {
    charactersCreated: number;
    environmentsCreated: number;
    scenesCreated: number;
    totalImagesCreated: number;
  };
  nextSteps?: string;
  needsApproval?: 'characters' | 'environments';
  error?: string;
  uiProgressData?: {
    characterPortraits: CreationResult[];
    environments: CreationResult[];
    scenes: CreationResult[];
  };
}

export const createStructuredBookImages = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Structured Book Image Creation Tool - Follows strict 4-step process:

1. MEMORY CHECK: Search memory for existing character portraits and environments
2. CHARACTER PORTRAITS: Create transparent character portraits if missing, save to memory & book_props
3. ENVIRONMENTS: Create empty top-view environments, save to memory & book_props  
4. SCENE COMPOSITION: Create scenes by seeding environment + character(s), save to memory

🎨 CRITICAL: This tool extracts the book's Style Bible from conversationContext to ensure ALL images (characters, environments, scenes) maintain consistent visual style throughout the book. Each book has its own unique art style that must be preserved.

This tool ensures systematic asset creation and prevents duplicate work by checking memory first.
All created images are automatically saved to both memory and the book_props database.`,
    inputSchema: structuredBookImageCreationSchema,
    execute: async (input): Promise<StructuredBookImageCreationOutput> => {
      const { 
        bookId, 
        bookTitle, 
        characters, 
        environments, 
        scenes, 
        conversationContext,
        skipApprovalGates = false,
        approvedCharacters = false,
        approvedEnvironments = false
      } = input;
      
      console.log(`[StructuredBookImages] Starting structured image creation for "${bookTitle}"`);
      console.log(`[StructuredBookImages] Pipeline: ${characters.length} characters, ${environments.length} environments, ${scenes.length} scenes`);

      // Send initial progress card
      dataStream.write?.({
        type: 'structured-book-image-start',
        content: {
          bookTitle,
          bookId,
          pipeline: {
            characters: characters.length,
            environments: environments.length,
            scenes: scenes.length,
            totalSteps: characters.length + environments.length + scenes.length
          }
        }
      });

      const results: StructuredBookImageCreationOutput['results'] = {
        memoryChecks: { characters: [], environments: [] },
        characterPortraits: [],
        environments: [],
        scenes: []
      };

      let totalImagesCreated = 0;

      try {
        // STEP 1: Memory Checks
        console.log('[StructuredBookImages] STEP 1: Checking memory for existing assets...');
        
        // Check for existing character portraits
        for (const character of characters) {
          const memoryResult = await checkMemoryForCharacter(character.name, bookId, session);
          results.memoryChecks.characters.push(memoryResult);
          console.log(`[StructuredBookImages] Character "${character.name}": ${memoryResult.found ? 'FOUND' : 'NOT FOUND'}`);
        }

        // Check for existing environments
        for (const environment of environments) {
          const memoryResult = await checkMemoryForEnvironment(environment.name, bookId, session);
          results.memoryChecks.environments.push(memoryResult);
          console.log(`[StructuredBookImages] Environment "${environment.name}": ${memoryResult.found ? 'FOUND' : 'NOT FOUND'}`);
        }

        // STEP 2: Create Character Portraits
        console.log('[StructuredBookImages] STEP 2: Creating missing character portraits...');
        
        for (let i = 0; i < characters.length; i++) {
          const character = characters[i];
          const memoryCheck = results.memoryChecks.characters[i];
          
          if (!memoryCheck.found) {
            console.log(`[StructuredBookImages] Creating portrait for: ${character.name}`);
            
            // Send progress update for character portrait start
            dataStream.write?.({
              type: 'structured-book-image-progress',
              content: {
                step: 'character_portrait',
                stepNumber: i + 1,
                totalSteps: characters.length + environments.length + scenes.length,
                action: 'creating',
                item: character.name,
                description: `Creating transparent portrait for ${character.name}`
              }
            });
            
            const portraitResult = await createCharacterPortrait({
              character,
              bookId,
              bookTitle,
              conversationContext,
              session,
              dataStream
            });
            
            // Send progress update for character portrait completion
            if (portraitResult.success) {
              dataStream.write?.({
                type: 'structured-book-image-result',
                content: {
                  step: 'character_portrait',
                  success: true,
                  item: character.name,
                  imageUrl: portraitResult.imageUrl,
                  prompt: portraitResult.prompt,
                  approach: portraitResult.approach,
                  seedImagesUsed: portraitResult.seedImagesUsed,
                  reasoning: `Created transparent portrait for ${character.name} to use in scene compositions`
                }
              });
            } else {
              dataStream.write?.({
                type: 'structured-book-image-result',
                content: {
                  step: 'character_portrait',
                  success: false,
                  item: character.name,
                  error: portraitResult.error
                }
              });
            }
            
            results.characterPortraits.push(portraitResult);
            if (portraitResult.success) totalImagesCreated++;
          } else {
            console.log(`[StructuredBookImages] Using existing portrait for: ${character.name}`);
            
            // Send update for existing asset
            dataStream.write?.({
              type: 'structured-book-image-result',
              content: {
                step: 'character_portrait',
                success: true,
                item: character.name,
                imageUrl: memoryCheck.imageUrl,
                existingAsset: true,
                reasoning: `Found existing portrait for ${character.name} in memory`
              }
            });
            
            results.characterPortraits.push({
              step: 'character_portrait',
              success: true,
              item: character.name,
              imageUrl: memoryCheck.imageUrl,
              memoryId: memoryCheck.memoryId
            });
          }
        }

        // CHARACTER APPROVAL GATE
        if (!skipApprovalGates && !approvedCharacters) {
          console.log('[StructuredBookImages] === CHARACTER APPROVAL GATE ===');
          
          // Send character approval request
          dataStream.write?.({
            type: 'structured-book-image-approval',
            content: {
              step: 'character_approval',
              title: 'Character Portraits Created',
              message: `Created ${results.characterPortraits.filter(r => r.success).length} character portraits. Please review and approve before proceeding to environments.`,
              approvalType: 'characters',
              items: results.characterPortraits,
              nextStep: 'environments'
            }
          });
          
          // Return partial results with approval needed
          return {
            success: false,
            bookId,
            results,
            summary: {
              charactersCreated: results.characterPortraits.filter(r => r.success).length,
              environmentsCreated: 0,
              scenesCreated: 0,
              totalImagesCreated
            },
            nextSteps: `Character portraits completed. Waiting for user approval before proceeding to create ${environments.length} environments.`,
            needsApproval: 'characters',
            uiProgressData: {
              characterPortraits: results.characterPortraits,
              environments: [],
              scenes: []
            }
          };
        }

        // STEP 3: Create Environments
        console.log('[StructuredBookImages] STEP 3: Creating missing environments...');
        
        for (let i = 0; i < environments.length; i++) {
          const environment = environments[i];
          const memoryCheck = results.memoryChecks.environments[i];
          
          if (!memoryCheck.found) {
            console.log(`[StructuredBookImages] Creating environment: ${environment.name}`);
            
            // Send progress update for environment start
            dataStream.write?.({
              type: 'structured-book-image-progress',
              content: {
                step: 'environment',
                stepNumber: characters.length + i + 1,
                totalSteps: characters.length + environments.length + scenes.length,
                action: 'creating',
                item: environment.name,
                description: `Creating empty top-view environment: ${environment.name}`
              }
            });
            
            const environmentResult = await createEnvironmentImage({
              environment,
              bookId,
              bookTitle,
              conversationContext,
              session,
              dataStream
            });
            
            // Send progress update for environment completion
            if (environmentResult.success) {
              dataStream.write?.({
                type: 'structured-book-image-result',
                content: {
                  step: 'environment',
                  success: true,
                  item: environment.name,
                  imageUrl: environmentResult.imageUrl,
                  prompt: environmentResult.prompt,
                  approach: environmentResult.approach,
                  seedImagesUsed: environmentResult.seedImagesUsed,
                  reasoning: `Created empty ${environment.name} environment for scene compositions`
                }
              });
            } else {
              dataStream.write?.({
                type: 'structured-book-image-result',
                content: {
                  step: 'environment',
                  success: false,
                  item: environment.name,
                  error: environmentResult.error
                }
              });
            }
            
            results.environments.push(environmentResult);
            if (environmentResult.success) totalImagesCreated++;
          } else {
            console.log(`[StructuredBookImages] Using existing environment: ${environment.name}`);
            
            // Send update for existing environment
            dataStream.write?.({
              type: 'structured-book-image-result',
              content: {
                step: 'environment',
                success: true,
                item: environment.name,
                imageUrl: memoryCheck.imageUrl,
                existingAsset: true,
                reasoning: `Found existing ${environment.name} environment in memory`
              }
            });
            
            results.environments.push({
              step: 'environment',
              success: true,
              item: environment.name,
              imageUrl: memoryCheck.imageUrl,
              memoryId: memoryCheck.memoryId
            });
          }
        }

        // ENVIRONMENT APPROVAL GATE
        if (!skipApprovalGates && !approvedEnvironments) {
          console.log('[StructuredBookImages] === ENVIRONMENT APPROVAL GATE ===');
          
          // Send environment approval request
          dataStream.write?.({
            type: 'structured-book-image-approval',
            content: {
              step: 'environment_approval',
              title: 'Environments Created',
              message: `Created ${results.environments.filter(r => r.success).length} environments. Please review and approve before proceeding to scene composition.`,
              approvalType: 'environments',
              items: results.environments,
              nextStep: 'scenes'
            }
          });
          
          // Return partial results with approval needed
          return {
            success: false,
            bookId,
            results,
            summary: {
              charactersCreated: results.characterPortraits.filter(r => r.success).length,
              environmentsCreated: results.environments.filter(r => r.success).length,
              scenesCreated: 0,
              totalImagesCreated
            },
            nextSteps: `Environments completed. Waiting for user approval before proceeding to create ${scenes.length} scene compositions.`,
            needsApproval: 'environments',
            uiProgressData: {
              characterPortraits: results.characterPortraits,
              environments: results.environments,
              scenes: []
            }
          };
        }

        // STEP 4: Create Scenes
        console.log('[StructuredBookImages] STEP 4: Creating scenes with character + environment seeding...');
        
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          console.log(`[StructuredBookImages] Creating scene: ${scene.sceneId}`);
          
          // Send progress update for scene start
          dataStream.write?.({
            type: 'structured-book-image-progress',
            content: {
              step: 'scene',
              stepNumber: characters.length + environments.length + i + 1,
              totalSteps: characters.length + environments.length + scenes.length,
              action: 'creating',
              item: scene.sceneId,
              description: `Composing scene with characters and environment: ${scene.description}`
            }
          });
          
          const sceneResult = await createSceneComposition({
            scene,
            characters: results.characterPortraits,
            environments: results.environments,
            bookId,
            bookTitle,
            conversationContext,
            session,
            dataStream
          });
          
          // Send progress update for scene completion
          if (sceneResult.success) {
            dataStream.write?.({
              type: 'structured-book-image-result',
              content: {
                step: 'scene',
                success: true,
                item: scene.sceneId,
                imageUrl: sceneResult.imageUrl,
                prompt: sceneResult.prompt,
                approach: sceneResult.approach,
                seedImagesUsed: sceneResult.seedImagesUsed,
                reasoning: `Composed scene using environment and character assets`
              }
            });
          } else {
            dataStream.write?.({
              type: 'structured-book-image-result',
              content: {
                step: 'scene',
                success: false,
                item: scene.sceneId,
                error: sceneResult.error
              }
            });
          }
          
          results.scenes.push(sceneResult);
          if (sceneResult.success) totalImagesCreated++;
        }

        // Generate summary
        const summary = {
          charactersCreated: results.characterPortraits.filter(r => r.success && !results.memoryChecks.characters.find(c => c.found)).length,
          environmentsCreated: results.environments.filter(r => r.success && !results.memoryChecks.environments.find(e => e.found)).length,
          scenesCreated: results.scenes.filter(r => r.success).length,
          totalImagesCreated
        };

        console.log(`[StructuredBookImages] ✅ Completed! Created ${totalImagesCreated} new images`);
        console.log(`[StructuredBookImages] Summary:`, summary);

        // Send completion summary
        dataStream.write?.({
          type: 'structured-book-image-complete',
          content: {
            success: true,
            bookId,
            bookTitle,
            summary,
            results: {
              characterPortraits: results.characterPortraits.length,
              environments: results.environments.length,
              scenes: results.scenes.length,
              totalImagesCreated
            },
            nextSteps: generateNextSteps(summary, results)
          }
        });

        return {
          success: true,
          bookId,
          results,
          summary,
          nextSteps: generateNextSteps(summary, results),
          // Include detailed results for UI rendering
          uiProgressData: {
            characterPortraits: results.characterPortraits,
            environments: results.environments,
            scenes: results.scenes
          }
        };

      } catch (error) {
        console.error('[StructuredBookImages] Error in structured image creation:', error);
        
        // Send error notification to UI
        dataStream.write?.({
          type: 'structured-book-image-complete',
          content: {
            success: false,
            bookId,
            bookTitle,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            summary: {
              charactersCreated: 0,
              environmentsCreated: 0,
              scenesCreated: 0,
              totalImagesCreated: 0
            }
          }
        });
        
        return {
          success: false,
          bookId,
          results,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          summary: {
            charactersCreated: 0,
            environmentsCreated: 0,
            scenesCreated: 0,
            totalImagesCreated: 0
          }
        };
      }
    }
  });

/**
 * Check memory for existing character portrait
 */
async function checkMemoryForCharacter(characterName: string, bookId: string, session: Session): Promise<MemorySearchResult> {
  try {
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) {
      return { found: false };
    }

    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) {
      return { found: false };
    }

    // Search for character portrait in memory
    const memories = await memoryService.searchMemories(
      paprUserId,
      `character portrait ${characterName} book ${bookId}`,
      5
    );

    // Look for character-specific memories with images
    const characterMemory = memories.find(m => {
      const customMeta = m.metadata?.customMetadata as any;
      return customMeta?.character_name === characterName &&
        customMeta?.book_id === bookId &&
        (customMeta?.kind === 'character' || customMeta?.content_type === 'character_portrait') &&
        customMeta?.image_url;
    });

    if (characterMemory) {
      const customMeta = characterMemory.metadata?.customMetadata as any;
      return {
        found: true,
        memoryId: characterMemory.id,
        imageUrl: customMeta?.image_url,
        description: characterMemory.content
      };
    }

    return { found: false };
  } catch (error) {
    console.error(`[StructuredBookImages] Error checking memory for character ${characterName}:`, error);
    return { found: false };
  }
}

/**
 * Check memory for existing environment image
 */
async function checkMemoryForEnvironment(environmentName: string, bookId: string, session: Session): Promise<MemorySearchResult> {
  try {
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) {
      return { found: false };
    }

    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) {
      return { found: false };
    }

    // Search for environment in memory
    const memories = await memoryService.searchMemories(
      paprUserId,
      `environment ${environmentName} book ${bookId}`,
      5
    );

    // Look for environment-specific memories with images
    const environmentMemory = memories.find(m => {
      const customMeta = m.metadata?.customMetadata as any;
      return customMeta?.environment_name === environmentName &&
        customMeta?.book_id === bookId &&
        customMeta?.kind === 'environment' &&
        customMeta?.image_url;
    });

    if (environmentMemory) {
      const customMeta = environmentMemory.metadata?.customMetadata as any;
      return {
        found: true,
        memoryId: environmentMemory.id,
        imageUrl: customMeta?.image_url,
        description: environmentMemory.content
      };
    }

    return { found: false };
  } catch (error) {
    console.error(`[StructuredBookImages] Error checking memory for environment ${environmentName}:`, error);
    return { found: false };
  }
}

/**
 * Create a character portrait with transparent background
 */
async function createCharacterPortrait({
  character,
  bookId,
  bookTitle,
  conversationContext,
  session,
  dataStream
}: {
  character: any;
  bookId: string;
  bookTitle: string;
  conversationContext?: string;
  session: Session;
  dataStream: DataStreamWriter;
}): Promise<CreationResult> {
  try {
    const { createImage } = await import('./create-image');
    const imageTool = createImage({ session });

    // Extract style from conversation context or use default
    const styleMatch = conversationContext?.match(/Style Bible:\s*([^\n]+)/i);
    const bookStyle = styleMatch ? styleMatch[1] : 'children\'s book illustration with consistent art style';
    
    const portraitDescription = `Create a character portrait of ${character.name}. ${character.description}. The character should be shown from chest up, facing forward, with a friendly expression. Style: ${bookStyle}. Use a completely transparent or white background for easy compositing into scenes.`;

    const context = conversationContext ? `Book: ${bookTitle}. Context: ${conversationContext}` : `Book: ${bookTitle}. Style: ${bookStyle}`;

    if (imageTool.execute) {
      const result = await imageTool.execute({
        description: portraitDescription,
        sceneContext: context,
        seedImages: [], // No seed images for portraits
        seedImageTypes: [], // Empty for new portraits
        styleConsistency: false,
        aspectRatio: '1:1'
      }, { toolCallId: `portrait-${character.name}-${Date.now()}`, messages: [] });

      const imageResult = await extractImageResult(result);
      if (imageResult && imageResult.imageUrl) {
        // Save character to memory with image URL
        await saveCharacterToMemory({
          character,
          imageUrl: imageResult.imageUrl,
          bookId,
          bookTitle,
          session
        });

        return {
          step: 'character_portrait',
          success: true,
          item: character.name,
          imageUrl: imageResult.imageUrl,
          prompt: imageResult.actualPrompt,
          approach: imageResult.approach,
          seedImagesUsed: imageResult.seedImagesUsed,
          reasoning: imageResult.reasoning,
          memoryId: undefined // createImage doesn't return memoryId
        };
      }
    }

    return {
      step: 'character_portrait',
      success: false,
      item: character.name,
      error: 'Failed to create character portrait'
    };

  } catch (error) {
    console.error(`[StructuredBookImages] Error creating portrait for ${character.name}:`, error);
    return {
      step: 'character_portrait',
      success: false,
      item: character.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create an environment image (empty, top-view)
 */
async function createEnvironmentImage({
  environment,
  bookId,
  bookTitle,
  conversationContext,
  session,
  dataStream
}: {
  environment: any;
  bookId: string;
  bookTitle: string;
  conversationContext?: string;
  session: Session;
  dataStream: DataStreamWriter;
}): Promise<CreationResult> {
  try {
    const { createImage } = await import('./create-image');
    const imageTool = createImage({ session });

    // Extract style from conversation context or use default
    const styleMatch = conversationContext?.match(/Style Bible:\s*([^\n]+)/i);
    const bookStyle = styleMatch ? styleMatch[1] : 'children\'s book illustration with consistent art style';
    
    // Ensure "empty" is in the prompt as requested
    const environmentDescription = `Create an empty top-view image of ${environment.name}. ${environment.description}. The environment should be completely empty with no characters, people, or moving objects. Show the location from a top-down or slightly angled perspective that would work well for placing characters into the scene later. Style: ${bookStyle}. ${environment.timeOfDay ? `Time: ${environment.timeOfDay}.` : ''} ${environment.weather ? `Weather: ${environment.weather}.` : ''}`;

    const context = conversationContext ? `Book: ${bookTitle}. Context: ${conversationContext}` : `Book: ${bookTitle}. Style: ${bookStyle}`;

    if (imageTool.execute) {
      const result = await imageTool.execute({
        description: environmentDescription,
        sceneContext: context,
        seedImages: [], // No seed images for environments
        seedImageTypes: ['environment'],
        styleConsistency: false,
        aspectRatio: '16:9'
      }, { toolCallId: `env-${environment.name}-${Date.now()}`, messages: [] });

      const imageResult = await extractImageResult(result);
      if (imageResult && imageResult.imageUrl) {
        // Save environment to memory with image URL
        await saveEnvironmentToMemory({
          environment,
          imageUrl: imageResult.imageUrl,
          bookId,
          bookTitle,
          session
        });

        return {
          step: 'environment',
          success: true,
          item: environment.name,
          imageUrl: imageResult.imageUrl,
          prompt: imageResult.actualPrompt,
          approach: imageResult.approach,
          seedImagesUsed: imageResult.seedImagesUsed,
          reasoning: imageResult.reasoning,
          memoryId: undefined // createImage doesn't return memoryId
        };
      }
    }

    return {
      step: 'environment',
      success: false,
      item: environment.name,
      error: 'Failed to create environment image'
    };

  } catch (error) {
    console.error(`[StructuredBookImages] Error creating environment ${environment.name}:`, error);
    return {
      step: 'environment',
      success: false,
      item: environment.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a scene by compositing environment + characters
 */
async function createSceneComposition({
  scene,
  characters,
  environments,
  bookId,
  bookTitle,
  conversationContext,
  session,
  dataStream
}: {
  scene: any;
  characters: CreationResult[];
  environments: CreationResult[];
  bookId: string;
  bookTitle: string;
  conversationContext?: string;
  session: Session;
  dataStream: DataStreamWriter;
}): Promise<CreationResult> {
  try {
    const { createImage } = await import('./create-image');
    const imageTool = createImage({ session });

    // Find the environment for this scene
    const environmentResult = environments.find(env => env.item === scene.environment);
    if (!environmentResult || !environmentResult.imageUrl) {
      return {
        step: 'scene',
        success: false,
        item: scene.sceneId,
        error: `Environment "${scene.environment}" not found or has no image`
      };
    }

    // Find character images for this scene
    const sceneCharacters = scene.characters.map((charName: string) => {
      const charResult = characters.find(char => char.item === charName);
      return { name: charName, imageUrl: charResult?.imageUrl };
    }).filter((char: { name: string; imageUrl?: string }) => char.imageUrl);

    if (sceneCharacters.length === 0) {
      return {
        step: 'scene',
        success: false,
        item: scene.sceneId,
        error: 'No character images found for scene'
      };
    }

    // Prepare seed images (environment + characters)
    const seedImages = [environmentResult.imageUrl, ...sceneCharacters.map((char: { name: string; imageUrl?: string }) => char.imageUrl!)];
    const seedImageTypes: ('character' | 'environment' | 'prop' | 'other')[] = [
      'environment',
      ...sceneCharacters.map(() => 'character' as const)
    ];

    // Extract style from conversation context or use default
    const styleMatch = conversationContext?.match(/Style Bible:\s*([^\n]+)/i);
    const bookStyle = styleMatch ? styleMatch[1] : 'children\'s book illustration with consistent art style';
    
    const sceneDescription = `Compose a scene: ${scene.description}. Place the characters (${scene.characters.join(', ')}) into the ${scene.environment} environment. ${scene.actions ? `Actions: ${scene.actions}.` : ''} The characters should be naturally integrated into the environment with proper lighting, shadows, and perspective. Maintain the original character appearances and environment layout. Style: ${bookStyle}.`;

    const context = conversationContext ? `Book: ${bookTitle}. Scene: ${scene.sceneId}. Context: ${conversationContext}` : `Book: ${bookTitle}. Scene: ${scene.sceneId}. Style: ${bookStyle}`;

    if (imageTool.execute) {
      const result = await imageTool.execute({
        description: sceneDescription,
        sceneContext: context,
        seedImages,
        seedImageTypes,
        styleConsistency: true,
        aspectRatio: '16:9'
      }, { toolCallId: `scene-${scene.sceneId}-${Date.now()}`, messages: [] });

      const imageResult = await extractImageResult(result);
      if (imageResult && imageResult.imageUrl) {
        // Save scene to memory with image URL
        await saveSceneToMemory({
          scene,
          imageUrl: imageResult.imageUrl,
          bookId,
          bookTitle,
          session
        });

        return {
          step: 'scene',
          success: true,
          item: scene.sceneId,
          imageUrl: imageResult.imageUrl,
          prompt: imageResult.actualPrompt,
          approach: imageResult.approach,
          seedImagesUsed: imageResult.seedImagesUsed,
          memoryId: undefined // createImage doesn't return memoryId
        };
      }
    }

    return {
      step: 'scene',
      success: false,
      item: scene.sceneId,
      error: 'Failed to create scene composition'
    };

  } catch (error) {
    console.error(`[StructuredBookImages] Error creating scene ${scene.sceneId}:`, error);
    return {
      step: 'scene',
      success: false,
      item: scene.sceneId,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Save character to memory with image URL and directly to BookProp table
 */
async function saveCharacterToMemory({
  character,
  imageUrl,
  bookId,
  bookTitle,
  session
}: {
  character: any;
  imageUrl: string;
  bookId: string;
  bookTitle: string;
  session: Session;
}): Promise<void> {
  try {
    // Save directly to BookProp table first (like /characters page does)
    const { createBookProp } = await import('@/lib/db/book-queries');
    
    const bookProp = await createBookProp({
      bookId,
      bookTitle,
      type: 'character',
      name: character.name,
      description: character.description,
      metadata: {
        role: character.role || 'character',
        createdFrom: 'structured_book_images',
        step: 'character_creation',
        background_type: 'transparent',
        content_type: 'character_portrait'
      },
      memoryId: undefined, // Will be updated after memory save
      imageUrl,
      userId: session.user?.id || '',
    });

    console.log(`[StructuredBookImages] ✅ Saved character "${character.name}" to BookProp table (ID: ${bookProp.id})`);

    // Then save to memory (existing logic)
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) return;

    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) return;

    const characterContent = `Character Portrait: ${character.name}

Physical Description: ${character.description}
${character.role ? `Role: ${character.role}` : ''}

Image URL: ${imageUrl}
Image: Transparent background portrait for scene composition
Book: ${bookTitle}
Created: ${new Date().toISOString()}`;

    await memoryService.storeContent(
      paprUserId,
      characterContent,
      'document', // Use document type for images as per memory guidelines
      {
        kind: 'character',
        book_id: bookId,
        book_title: bookTitle,
        character_name: character.name,
        character_role: character.role || 'character',
        image_url: imageUrl,
        content_type: 'character_portrait',
        background_type: 'transparent',
        created_by: 'structured_book_images',
        step: 'character_creation',
        prop_id: bookProp.id // Link to the BookProp entry
      },
      session.user.id
    );

    console.log(`[StructuredBookImages] ✅ Saved character "${character.name}" to memory with image`);
  } catch (error) {
    console.error(`[StructuredBookImages] Error saving character ${character.name}:`, error);
  }
}

/**
 * Save environment to memory with image URL and directly to BookProp table
 */
async function saveEnvironmentToMemory({
  environment,
  imageUrl,
  bookId,
  bookTitle,
  session
}: {
  environment: any;
  imageUrl: string;
  bookId: string;
  bookTitle: string;
  session: Session;
}): Promise<void> {
  try {
    // Save directly to BookProp table first (like /characters page does)
    const { createBookProp } = await import('@/lib/db/book-queries');
    
    const bookProp = await createBookProp({
      bookId,
      bookTitle,
      type: 'environment',
      name: environment.name,
      description: environment.description,
      metadata: {
        createdFrom: 'structured_book_images',
        step: 'environment_creation',
        scene_type: environment.name.toLowerCase().replace(/\s+/g, '_'),
        time_of_day: environment.timeOfDay || 'day',
        weather_conditions: environment.weather || 'clear',
        view_type: 'top_view',
        is_empty: true,
        content_type: 'environment_image'
      },
      memoryId: undefined, // Will be updated after memory save
      imageUrl,
      userId: session.user?.id || '',
    });

    console.log(`[StructuredBookImages] ✅ Saved environment "${environment.name}" to BookProp table (ID: ${bookProp.id})`);

    // Then save to memory (existing logic)
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) return;

    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) return;

    const environmentContent = `Environment: ${environment.name}

Description: ${environment.description}
${environment.timeOfDay ? `Time of Day: ${environment.timeOfDay}` : ''}
${environment.weather ? `Weather: ${environment.weather}` : ''}

Image URL: ${imageUrl}
Type: Empty top-view environment for character placement
Book: ${bookTitle}
Created: ${new Date().toISOString()}`;

    await memoryService.storeContent(
      paprUserId,
      environmentContent,
      'document',
      {
        kind: 'environment',
        book_id: bookId,
        book_title: bookTitle,
        environment_name: environment.name,
        scene_type: environment.name.toLowerCase().replace(/\s+/g, '_'),
        time_of_day: environment.timeOfDay || 'day',
        weather_conditions: environment.weather || 'clear',
        image_url: imageUrl,
        content_type: 'environment_image',
        view_type: 'top_view',
        is_empty: true,
        created_by: 'structured_book_images',
        step: 'environment_creation',
        prop_id: bookProp.id // Link to the BookProp entry
      },
      session.user.id
    );

    console.log(`[StructuredBookImages] ✅ Saved environment "${environment.name}" to memory with image`);
  } catch (error) {
    console.error(`[StructuredBookImages] Error saving environment ${environment.name}:`, error);
  }
}

/**
 * Save scene to memory with image URL and directly to BookProp table
 */
async function saveSceneToMemory({
  scene,
  imageUrl,
  bookId,
  bookTitle,
  session
}: {
  scene: any;
  imageUrl: string;
  bookId: string;
  bookTitle: string;
  session: Session;
}): Promise<void> {
  try {
    // Save directly to BookProp table first (like /characters page does)
    const { createBookProp } = await import('@/lib/db/book-queries');
    
    const bookProp = await createBookProp({
      bookId,
      bookTitle,
      type: 'scene',
      name: scene.sceneId,
      description: scene.description,
      metadata: {
        createdFrom: 'structured_book_images',
        step: 'scene_creation',
        environment_name: scene.environment,
        characters_in_scene: scene.characters,
        scene_actions: scene.actions || '',
        content_type: 'scene_composition',
        composition_type: 'character_environment_composite'
      },
      memoryId: undefined, // Will be updated after memory save
      imageUrl,
      userId: session.user?.id || '',
    });

    console.log(`[StructuredBookImages] ✅ Saved scene "${scene.sceneId}" to BookProp table (ID: ${bookProp.id})`);

    // Then save to memory (existing logic)
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) return;

    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) return;

    const sceneContent = `Scene: ${scene.sceneId}

Description: ${scene.description}
Environment: ${scene.environment}
Characters: ${scene.characters.join(', ')}
${scene.actions ? `Actions: ${scene.actions}` : ''}

Image URL: ${imageUrl}
Type: Composed scene with characters placed in environment
Book: ${bookTitle}
Created: ${new Date().toISOString()}`;

    await memoryService.storeContent(
      paprUserId,
      sceneContent,
      'document',
      {
        kind: 'scene',
        book_id: bookId,
        book_title: bookTitle,
        scene_id: scene.sceneId,
        environment_name: scene.environment,
        characters_in_scene: scene.characters,
        scene_actions: scene.actions || '',
        image_url: imageUrl,
        content_type: 'scene_composition',
        composition_type: 'character_environment_composite',
        created_by: 'structured_book_images',
        step: 'scene_creation',
        prop_id: bookProp.id // Link to the BookProp entry
      },
      session.user.id
    );

    console.log(`[StructuredBookImages] ✅ Saved scene "${scene.sceneId}" to memory with image`);
  } catch (error) {
    console.error(`[StructuredBookImages] Error saving scene ${scene.sceneId}:`, error);
  }
}

/**
 * Generate next steps based on results
 */
function generateNextSteps(summary: any, results: any): string {
  const steps = [];
  
  if (summary.charactersCreated > 0) {
    steps.push(`✅ Created ${summary.charactersCreated} character portrait(s)`);
  }
  
  if (summary.environmentsCreated > 0) {
    steps.push(`✅ Created ${summary.environmentsCreated} environment image(s)`);
  }
  
  if (summary.scenesCreated > 0) {
    steps.push(`✅ Created ${summary.scenesCreated} scene composition(s)`);
  }

  const failedItems = [
    ...results.characterPortraits.filter((r: any) => !r.success),
    ...results.environments.filter((r: any) => !r.success),
    ...results.scenes.filter((r: any) => !r.success)
  ];

  if (failedItems.length > 0) {
    steps.push(`⚠️ ${failedItems.length} item(s) failed - check logs for details`);
  }

  if (summary.totalImagesCreated === 0) {
    steps.push(`ℹ️ All assets already existed in memory - no new images created`);
  }

  return steps.join('\n');
}
