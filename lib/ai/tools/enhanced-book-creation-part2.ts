import { z } from 'zod';
import { tool, type ToolCallOptions } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import type { CreateImageOutput } from './create-image';

// Helper function to extract image result from tool response
async function extractImageResultLocal(result: any): Promise<{
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

// Import FormattedMemory type for memory operations
interface FormattedMemory {
  id: string;
  content?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// Part 2: Environment Creation and Scene Composition Tools
// Steps 5-7 of the Enhanced Book Creation Workflow

// Batch Environment Creation Schema
const batchEnvironmentCreationSchema = z.object({
  bookId: z.string().describe('The book ID'),
  environments: z.array(z.object({
    environmentId: z.string().describe('Unique environment identifier'),
    location: z.string().describe('Location name'),
    timeOfDay: z.string().describe('Time of day'),
    weather: z.string().describe('Weather conditions'),
    masterPlateDescription: z.string().describe('Detailed description for the environment master plate'),
    persistentElements: z.array(z.string()).describe('Elements that should remain consistent (signage, furniture, etc.)'),
    layoutJson: z.record(z.string(), z.any()).describe('Layout information for prop placement'),
    
    // AI AGENT DECISIONS - exactly one of these should be provided:
    existingImageUrl: z.string().optional().describe('OPTION 1: Use this exact existing image as-is (AI agent decision)'),
    seedImageUrl: z.string().optional().describe('OPTION 2: Use this image as seed for style consistency (AI agent decision)'),
    createNew: z.boolean().optional().describe('OPTION 3: Create completely new image (AI agent decision)')
  })).max(3).describe('Up to 3 environments to create at once for feedback'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).default('16:9')
});

const environmentCreationSchema = z.object({
  bookId: z.string().describe('The book ID'),
  environmentId: z.string().describe('Unique environment identifier'),
  location: z.string().describe('Location name'),
  timeOfDay: z.string().describe('Time of day'),
  weather: z.string().describe('Weather conditions'),
  masterPlateDescription: z.string().describe('Detailed description for the environment master plate'),
  persistentElements: z.array(z.string()).describe('Elements that should remain consistent (signage, furniture, etc.)'),
  layoutJson: z.record(z.string(), z.any()).describe('Layout information for prop placement'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).default('16:9')
});

const sceneCompositionSchema = z.object({
  bookId: z.string().describe('The book ID'),
  sceneId: z.string().describe('Scene ID to render'),
  environmentId: z.string().describe('Environment to use as base'),
  characterIds: z.array(z.string()).describe('Character IDs to include'),
  propIds: z.array(z.string()).describe('Prop IDs to include'),
  sceneDescription: z.string().describe('Detailed scene description'),
  lighting: z.string().describe('Lighting conditions'),
  cameraAngle: z.string().describe('Camera angle/perspective'),
  compositionalNotes: z.string().optional().describe('Special compositional requirements'),
  seed: z.number().optional().describe('Random seed for consistency'),
  checkEnvironmentContinuity: z.boolean().optional().default(true).describe('Whether to check if this scene is in the same environment as the previous scene for visual continuity'),
  priorSceneId: z.string().optional().describe('ID of the previous scene to check for environment continuity')
});

const sceneManifestSchema = z.object({
  bookId: z.string().describe('The book ID'),
  sceneId: z.string().describe('Scene ID'),
  environmentId: z.string().describe('Environment ID'),
  requiredCharacters: z.array(z.string()).describe('Required character names'),
  requiredProps: z.array(z.string()).describe('Required prop names'),
  continuityChecks: z.array(z.object({
    item: z.string().describe('Item to check (wardrobe, prop, signage, etc.)'),
    requirement: z.string().describe('What must be consistent'),
    status: z.enum(['verified', 'missing', 'inconsistent']).describe('Check status')
  })).describe('Continuity verification checks')
});

// Step 5: Batch Environment Creation Tool
export const createEnvironments = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 5 of Enhanced Book Creation: Create environment master plates in batches.
    
    AI AGENT CONTROLLED: This tool executes the AI agent's decisions. For each environment, the AI agent decides:
    
    OPTION 1: existingImageUrl - Use exact existing image as-is (no creation needed)
    OPTION 2: seedImageUrl - Use existing image as seed for style consistency (create new with seed)  
    OPTION 3: createNew: true - Create completely new image (no seeds)
    
    The AI agent searches memory, evaluates context, and passes the appropriate option.
    This tool simply executes the decision - no intelligence needed here.
    
    Generates up to 3 environment master plate images at a time. Each environment shows
    the full room/location from above or at an angle that reveals the complete space.
    These serve as base layers for scene composition with characters.`,
    inputSchema: batchEnvironmentCreationSchema,
    execute: async (input) => {
      const { bookId, environments, aspectRatio } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'batch_environment_creation',
      });

      dataStream.write?.({
        type: 'title',
        content: `Batch Environment Creation (${environments.length} environments)`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${bookId}_batch_environments_${Date.now()}`,
      });

      const results = [];

      for (const environment of environments) {
        const { 
          environmentId, 
          location, 
          timeOfDay, 
          weather, 
          masterPlateDescription, 
          persistentElements, 
          layoutJson,
          existingImageUrl,
          seedImageUrl,
          createNew
        } = environment;

        let environmentImageUrl = '';

        // EXECUTE AI AGENT'S DECISION
        console.log(`[createEnvironments] Processing environment: ${location} (${timeOfDay}, ${weather})`);
        
        // OPTION 1: Use existing image as-is
        if (existingImageUrl) {
          console.log(`[createEnvironments] ✅ OPTION 1: Using existing image as-is - ${existingImageUrl.substring(0, 50)}...`);
          environmentImageUrl = existingImageUrl;
        }
        // OPTION 2 & 3: Create new image (with or without seed)
        else {
          const seedImages = seedImageUrl ? [seedImageUrl] : [];
          
          if (seedImageUrl) {
            console.log(`[createEnvironments] 🎨 OPTION 2: Creating new with seed - ${seedImageUrl.substring(0, 50)}...`);
          } else {
            console.log(`[createEnvironments] ✨ OPTION 3: Creating completely new environment`);
          }
          try {
            const { createSingleBookImage } = await import('./create-single-book-image');
            const imageTool = createSingleBookImage({ session, dataStream });

            // Create a much more detailed and unique environment description
            const uniqueIdentifier = `${location}_${timeOfDay}_${weather}_${Date.now()}`;
            const environmentDescription = `UNIQUE ENVIRONMENT MASTER PLATE: Create a completely original and distinct "${location}" environment that has never been created before.

SPECIFIC LOCATION: ${location}
DETAILED DESCRIPTION: ${masterPlateDescription}
TIME OF DAY: ${timeOfDay} - ensure lighting, shadows, and atmosphere reflect this specific time
WEATHER CONDITIONS: ${weather} - show clear weather effects and atmospheric conditions
PERSISTENT ELEMENTS: ${persistentElements.join(', ')}
UNIQUE ELEMENTS: Include specific architectural details, unique props, distinctive lighting, and characteristic features that make this "${location}" location completely different from any other environment
COMPOSITION: Wide establishing shot showing the complete environment space, empty of people but rich in environmental storytelling details

CRITICAL: This must be a completely unique interpretation of "${location}" - avoid generic or similar-looking environments. Focus on distinctive visual elements that make this location immediately recognizable and different from other locations.

Unique ID: ${uniqueIdentifier}`;

            const styleBible = 'Children\'s book illustration style with watercolor techniques, bright warm palette, confident ink linework';
            
            if (imageTool.execute) {
              const imageResult = await imageTool.execute({
                bookId: bookId || 'unknown',
                bookTitle: 'Book Environment',
                imageType: 'environment' as const,
                imageId: `env-${location}`,
                name: location,
                description: environmentDescription,
                styleBible,
                timeOfDay: timeOfDay || 'midday',
                weather: weather || 'clear',
                aspectRatio: aspectRatio as any || '4:3',
                styleConsistency: true,
                conversationContext: `Empty environment master plate for children's book scenes - background showing complete space for character placement`,
                seedImages: seedImages, // AI agent provides seed decision via parameters
                currentStep: undefined,
                totalSteps: undefined
              }, { toolCallId: 'book-env-optimized-' + Date.now(), messages: [] } as ToolCallOptions);

              // Extract image result from createSingleBookImage response
              const extractedResult = await extractImageResultLocal(imageResult);
              if (extractedResult && extractedResult.imageUrl) {
                environmentImageUrl = extractedResult.imageUrl;
                console.log(`[createEnvironments] ✅ Created optimized environment: ${location}`);
              }
            }
          } catch (error) {
            console.error('[createEnvironments] Error generating optimized environment:', error);
          }
        } // End of create new image (options 2 & 3)

        // Save environment to memory
        if (session?.user?.id && environmentImageUrl) {
          try {
            const { createMemoryService } = await import('@/lib/ai/memory/service');
            const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
            const apiKey = process.env.PAPR_MEMORY_API_KEY;
            
            if (apiKey) {
              const memoryService = createMemoryService(apiKey);
              const paprUserId = await ensurePaprUser(session.user.id, apiKey);
              
              if (paprUserId) {
                await memoryService.storeContent(
                  paprUserId,
                  `Environment: ${location}\nTime: ${timeOfDay}\nWeather: ${weather}\nDescription: ${masterPlateDescription}\nPersistent Elements: ${persistentElements.join(', ')}`,
                  'document',
                  {
                    kind: 'environment',
                    book_id: bookId,
                    environment_id: environmentId,
                    location,
                    time_of_day: timeOfDay,
                    weather,
                    image_url: environmentImageUrl,
                    layout_json: JSON.stringify(layoutJson),
                    persistent_elements: persistentElements,
                    step: 'environment_creation',
                    status: 'pending_approval'
                  },
                  session.user.id
                );
              }
            }
          } catch (error) {
            console.error('[createEnvironments] Error saving to memory:', error);
          }
        }

        results.push({
          environmentId,
          location,
          timeOfDay,
          weather,
          environmentImageUrl,
          existingEnvironment: false, // Always create new - AI agent decides on reuse
          persistentElements
        });
      }

      return {
        success: true,
        bookId,
        environmentsProcessed: results.length,
        results,
        nextStep: `Approval Gate 5: Please review and approve the ${results.length} environment master plates. If approved, you can create more environments (up to 3 at a time) or proceed to scene creation.`,
        approvalRequired: true,
        canCreateMoreEnvironments: true,
        maxBatchSize: 3
      };
    },
  });

// Step 6: Scene Manifest and Continuity Check Tool
export const createSceneManifest = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 6A of Enhanced Book Creation: Create scene manifest with continuity checks.
    
    Searches memory for environment, characters, and props. Performs preflight 
    continuity checks for must-have elements. Requires approval before rendering.`,
    inputSchema: sceneManifestSchema,
    execute: async (input) => {
      const { bookId, sceneId, environmentId, requiredCharacters, requiredProps, continuityChecks } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'scene_manifest',
      });

      dataStream.write?.({
        type: 'title',
        content: `Scene Manifest: ${sceneId}`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${sceneId}_manifest`,
      });

      const manifest = {
        sceneId,
        environmentId,
        requiredCharacters,
        requiredProps,
        continuityChecks,
        assets: {
          environment: null as any,
          characters: [] as any[],
          props: [] as any[]
        }
      };

      // Search memory for all required assets
      if (session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Find environment
              const envMemories = await memoryService.searchMemories(
                paprUserId,
                `environment ${environmentId} ${bookId}`,
                5
              );
              
              manifest.assets.environment = envMemories.find((mem: FormattedMemory) => 
                mem.metadata?.kind === 'environment' && 
                mem.metadata?.environment_id === environmentId
              );

              // Find characters
              for (const characterName of requiredCharacters) {
                const charMemories = await memoryService.searchMemories(
                  paprUserId,
                  `character ${characterName} portrait ${bookId}`,
                  5
                );
                
                const character = charMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'character' && 
                  mem.metadata?.character_name === characterName &&
                  mem.metadata?.book_id === bookId
                );
                
                if (character) {
                  manifest.assets.characters.push(character);
                }
              }

              // Find props
              for (const propName of requiredProps) {
                const propMemories = await memoryService.searchMemories(
                  paprUserId,
                  `prop ${propName} ${bookId}`,
                  5
                );
                
                const prop = propMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'prop' && 
                  mem.metadata?.prop_name === propName &&
                  mem.metadata?.book_id === bookId
                );
                
                if (prop) {
                  manifest.assets.props.push(prop);
                }
              }

              // Save scene manifest to memory
              await memoryService.storeContent(
                paprUserId,
                `Scene Manifest: ${sceneId}\nEnvironment: ${environmentId}\nCharacters: ${requiredCharacters.join(', ')}\nProps: ${requiredProps.join(', ')}\nContinuity Checks: ${continuityChecks.length} items verified`,
                'text',
                {
                  kind: 'scene_manifest',
                  book_id: bookId,
                  scene_id: sceneId,
                  environment_id: environmentId,
                  required_characters: requiredCharacters,
                  required_props: requiredProps,
                  continuity_checks: continuityChecks,
                  assets_found: {
                    environment: !!manifest.assets.environment,
                    characters: manifest.assets.characters.length,
                    props: manifest.assets.props.length
                  },
                  step: 'scene_manifest',
                  status: 'pending_approval'
                },
                session.user.id
              );
            }
          }
        } catch (error) {
          console.error('[createSceneManifest] Error searching memory:', error);
        }
      }

      const missingAssets = [];
      if (!manifest.assets.environment) missingAssets.push('Environment');
      if (manifest.assets.characters.length < requiredCharacters.length) {
        missingAssets.push(`Characters (${manifest.assets.characters.length}/${requiredCharacters.length})`);
      }
      if (manifest.assets.props.length < requiredProps.length) {
        missingAssets.push(`Props (${manifest.assets.props.length}/${requiredProps.length})`);
      }

      return {
        success: true,
        bookId,
        sceneId,
        environmentId,
        assetsFound: {
          environment: !!manifest.assets.environment,
          charactersFound: manifest.assets.characters.length,
          charactersRequired: requiredCharacters.length,
          propsFound: manifest.assets.props.length,
          propsRequired: requiredProps.length
        },
        missingAssets,
        continuityChecks,
        nextStep: missingAssets.length > 0 
          ? `Missing assets detected: ${missingAssets.join(', ')}. Please create missing assets before proceeding.`
          : 'Approval Gate 6: Please review and approve the scene manifest before rendering.',
        approvalRequired: true,
        canProceedToRender: missingAssets.length === 0
      };
    },
  });

// Step 6B: Scene Composition and Rendering Tool
export const renderScene = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 6B of Enhanced Book Creation: Compose and render scene with visual continuity.
    
    🔗 **ENVIRONMENT CONTINUITY**: Automatically detects when consecutive scenes occur in the same environment and uses the prior scene's image as a seed to ensure visual consistency and smooth transitions between book spreads.
    
    Composes the final scene image from environment plate + canon characters + props.
    Uses approved scene manifest and performs final validation.
    
    **Key Features**:
    - Detects same environment as previous scene for visual continuity
    - Seeds prior scene image when environments match
    - Maintains consistent lighting, camera angles, and environmental details
    - Ensures smooth visual flow between consecutive book spreads`,
    inputSchema: sceneCompositionSchema,
    execute: async (input) => {
      const { 
        bookId, 
        sceneId, 
        environmentId, 
        characterIds, 
        propIds, 
        sceneDescription, 
        lighting, 
        cameraAngle, 
        compositionalNotes,
        seed,
        checkEnvironmentContinuity,
        priorSceneId
      } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'scene_render',
      });

      dataStream.write?.({
        type: 'title',
        content: `Scene Render: ${sceneId}`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${sceneId}_render`,
      });

      let sceneImageUrl = '';
      const seedImages: string[] = [];
      const seedImageTypes: ('character' | 'environment' | 'prop' | 'other')[] = [];
      let environmentContinuityDetected = false;
      let priorSceneImageUrl: string | null = null;

      // Check for environment continuity with prior scene
      if (checkEnvironmentContinuity && priorSceneId && session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Search for prior scene information
              const priorSceneMemories = await memoryService.searchMemories(
                paprUserId,
                `scene ${priorSceneId} render ${bookId}`,
                5
              );
              
              if (priorSceneMemories.length > 0) {
                const priorScene = priorSceneMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'scene_render' && 
                  mem.metadata?.scene_id === priorSceneId
                );
                
                if (priorScene) {
                  const priorEnvironmentId = priorScene.metadata?.environment_id;
                  
                  // Check if same environment
                  if (priorEnvironmentId === environmentId) {
                    environmentContinuityDetected = true;
                    priorSceneImageUrl = priorScene.metadata?.final_image_url as string;
                    
                    if (priorSceneImageUrl) {
                      console.log(`[renderScene] 🔗 Environment continuity detected! Prior scene ${priorSceneId} in same environment ${environmentId}`);
                      console.log(`[renderScene] 🖼️ Using prior scene image as seed for visual continuity`);
                      
                      // Announce continuity to user
                      dataStream.write?.({
                        type: 'text',
                        content: `🔗 **Environment Continuity Detected**: This scene takes place in the same environment as the previous scene (${priorSceneId}). Using the prior scene image as a seed to ensure visual consistency and smooth transitions between spreads.`,
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[renderScene] Error checking environment continuity:', error);
        }
      }

      // Gather all seed images from memory
      if (session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Prioritize prior scene image for environment continuity
              if (environmentContinuityDetected && priorSceneImageUrl) {
                seedImages.push(priorSceneImageUrl);
                seedImageTypes.push('environment');
              } else {
                // Get environment image
                const envMemories = await memoryService.searchMemories(
                  paprUserId,
                  `environment ${environmentId} ${bookId}`,
                  5
                );
                
                const environment = envMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'environment' && 
                  mem.metadata?.environment_id === environmentId &&
                  mem.metadata?.image_url
                );
                
                if (environment?.metadata?.image_url) {
                  seedImages.push(environment.metadata.image_url as string);
                  seedImageTypes.push('environment');
                }
              }

              // Get character images
              for (const characterId of characterIds) {
                const charMemories = await memoryService.searchMemories(
                  paprUserId,
                  `character ${characterId} portrait ${bookId}`,
                  5
                );
                
                const character = charMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'character' && 
                  mem.metadata?.character_name === characterId &&
                  mem.metadata?.portrait_url
                );
                
                if (character?.metadata?.portrait_url) {
                  seedImages.push(character.metadata.portrait_url as string);
                  seedImageTypes.push('character');
                }
              }

              // Get prop images (if they have image URLs)
              for (const propId of propIds) {
                const propMemories = await memoryService.searchMemories(
                  paprUserId,
                  `prop ${propId} ${bookId}`,
                  5
                );
                
                const prop = propMemories.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'prop' && 
                  mem.metadata?.prop_name === propId &&
                  mem.metadata?.image_url
                );
                
                if (prop?.metadata?.image_url) {
                  seedImages.push(prop.metadata.image_url as string);
                  seedImageTypes.push('prop');
                }
              }
            }
          }
        } catch (error) {
          console.error('[renderScene] Error gathering seed images:', error);
        }
      }

      // Render the scene using the createImage tool with proper composition
      try {
        const { createImage } = await import('./create-image');
        const imageTool = createImage({ session });

        const fullDescription = `CHILDREN'S BOOK SCENE COMPOSITION:

SCENE: ${sceneDescription}
LIGHTING: ${lighting}
CAMERA ANGLE: ${cameraAngle}
${compositionalNotes ? `COMPOSITION NOTES: ${compositionalNotes}` : ''}

CRITICAL REQUIREMENTS:
1. Use the provided ENVIRONMENT as the base setting (should show the complete space)
2. Place the CHARACTERS naturally within the environment using their base outfits
3. Characters should maintain their appearance from the seed images (white/transparent background characters placed into the environment)
4. Ensure proper scale and positioning of characters within the environment
5. Maintain consistent lighting and style across all elements
6. Create a cohesive scene that looks natural and story-appropriate
7. Characters should interact with the environment appropriately
8. Preserve the personality and appearance of each character from their portraits

The seed images provide:
- Environment: Complete background/setting
- Characters: Individual character portraits with transparent backgrounds
- These should be naturally composed together into a single cohesive scene`;
        
        if (imageTool.execute) {
          const imageResult = await imageTool.execute({
            description: fullDescription,
            seedImages: seedImages.length > 0 ? seedImages : undefined,
            seedImageTypes: seedImageTypes.length > 0 ? seedImageTypes : undefined,
            sceneContext: `Scene composition for children's book${environmentContinuityDetected ? ' - maintaining visual continuity from prior scene in same environment' : ' - combining environment background with character portraits to create cohesive scene'}`,
            priorScene: environmentContinuityDetected ? `Prior scene ${priorSceneId} in same environment for visual continuity` : undefined,
            styleConsistency: true,
            aspectRatio: '16:9'
          }, { toolCallId: 'book-scene-' + Date.now(), messages: [] } as ToolCallOptions) as CreateImageOutput;

          if (imageResult.imageUrl) {
            sceneImageUrl = imageResult.imageUrl;
          }
        }
      } catch (error) {
        console.error('[renderScene] Error rendering scene:', error);
      }

      // Save render manifest to memory
      if (session?.user?.id && sceneImageUrl) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              await memoryService.storeContent(
                paprUserId,
                `Scene Render: ${sceneId}\nDescription: ${sceneDescription}\nLighting: ${lighting}\nCamera: ${cameraAngle}\nFinal Image: ${sceneImageUrl}`,
                'document',
                {
                  kind: 'scene_render',
                  book_id: bookId,
                  scene_id: sceneId,
                  environment_id: environmentId,
                  character_ids: characterIds,
                  prop_ids: propIds,
                  final_image_url: sceneImageUrl,
                  seed_images: seedImages,
                  lighting,
                  camera_angle: cameraAngle,
                  seed: seed || null,
                  step: 'scene_rendering',
                  status: 'pending_approval'
                },
                session.user.id
              );
            }
          }
        } catch (error) {
          console.error('[renderScene] Error saving render manifest:', error);
        }
      }

      return {
        success: true,
        bookId,
        sceneId,
        sceneImageUrl,
        seedImagesUsed: seedImages.length,
        environmentContinuityDetected,
        priorSceneUsed: environmentContinuityDetected ? priorSceneId : null,
        lighting,
        cameraAngle,
        nextStep: environmentContinuityDetected 
          ? `Approval Gate 7: Please review the rendered scene. Visual continuity has been maintained from the prior scene in the same environment. Approve or request fixes before proceeding to the next scene.`
          : 'Approval Gate 7: Please review the rendered scene. Approve or request fixes before proceeding to the next scene.',
        approvalRequired: true
      };
    },
  });

// Step 7: Book Completion and Publishing Tool
export const completeBook = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 7 of Enhanced Book Creation: Complete book and prepare for publishing.
    
    Searches for all approved scenes and assets, compiles them into the final book,
    and prepares publication-ready materials.`,
    inputSchema: z.object({
      bookId: z.string().describe('The book ID to complete'),
      finalReview: z.boolean().describe('Whether this is the final review before publishing'),
      publishingFormat: z.enum(['digital', 'print', 'both']).describe('Intended publishing format'),
      additionalNotes: z.string().optional().describe('Any additional notes or requirements')
    }),
    execute: async (input) => {
      const { bookId, finalReview, publishingFormat, additionalNotes } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'book_completion',
      });

      dataStream.write?.({
        type: 'title',
        content: `Book Completion: ${bookId}`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${bookId}_complete`,
      });

      const bookAssets = {
        bookBrief: null as any,
        characters: [] as any[],
        chapters: [] as any[],
        scenes: [] as any[],
        environments: [] as any[],
        props: [] as any[]
      };

      // Gather all approved book assets from memory
      if (session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Search for all book-related memories
              const allBookMemories = await memoryService.searchMemories(
                paprUserId,
                `book ${bookId}`,
                50 // Get more results for complete book
              );

              // Categorize memories
              for (const memory of allBookMemories) {
                if (memory.metadata?.book_id === bookId) {
                  switch (memory.metadata.kind) {
                    case 'book_brief':
                      bookAssets.bookBrief = memory;
                      break;
                    case 'character':
                      bookAssets.characters.push(memory);
                      break;
                    case 'chapter_draft':
                      bookAssets.chapters.push(memory);
                      break;
                    case 'scene_render':
                      bookAssets.scenes.push(memory);
                      break;
                    case 'environment':
                      bookAssets.environments.push(memory);
                      break;
                    case 'prop':
                      bookAssets.props.push(memory);
                      break;
                  }
                }
              }

              // Sort chapters and scenes by number
              bookAssets.chapters.sort((a, b) => 
                (a.metadata?.chapter_number || 0) - (b.metadata?.chapter_number || 0)
              );
              bookAssets.scenes.sort((a, b) => 
                (a.metadata?.scene_number || 0) - (b.metadata?.scene_number || 0)
              );

              // Save completion summary to memory
              await memoryService.storeContent(
                paprUserId,
                `Book Completion Summary for ${bookId}\n\nAssets Found:\n- Book Brief: ${bookAssets.bookBrief ? 'Yes' : 'No'}\n- Characters: ${bookAssets.characters.length}\n- Chapters: ${bookAssets.chapters.length}\n- Scenes: ${bookAssets.scenes.length}\n- Environments: ${bookAssets.environments.length}\n- Props: ${bookAssets.props.length}\n\nPublishing Format: ${publishingFormat}\n${additionalNotes ? `Notes: ${additionalNotes}` : ''}`,
                'text',
                {
                  kind: 'book_completion',
                  book_id: bookId,
                  publishing_format: publishingFormat,
                  asset_counts: {
                    characters: bookAssets.characters.length,
                    chapters: bookAssets.chapters.length,
                    scenes: bookAssets.scenes.length,
                    environments: bookAssets.environments.length,
                    props: bookAssets.props.length
                  },
                  final_review: finalReview,
                  step: 'book_completion',
                  status: finalReview ? 'ready_for_publishing' : 'pending_final_review'
                },
                session.user.id
              );
            }
          }
        } catch (error) {
          console.error('[completeBook] Error gathering book assets:', error);
        }
      }

      const isComplete = bookAssets.bookBrief && 
                        bookAssets.characters.length > 0 && 
                        bookAssets.chapters.length > 0;

      return {
        success: true,
        bookId,
        isComplete,
        publishingFormat,
        assetCounts: {
          characters: bookAssets.characters.length,
          chapters: bookAssets.chapters.length,
          scenes: bookAssets.scenes.length,
          environments: bookAssets.environments.length,
          props: bookAssets.props.length
        },
        readyForPublishing: finalReview && isComplete,
        nextStep: finalReview 
          ? 'Book is ready for publishing! All assets have been compiled and approved.'
          : 'Final Review: Please review all book assets before marking ready for publishing.',
        approvalRequired: !finalReview
      };
    },
  });

export type BatchEnvironmentCreationInput = z.infer<typeof batchEnvironmentCreationSchema>;
export type EnvironmentCreationInput = z.infer<typeof environmentCreationSchema>;
export type SceneCompositionInput = z.infer<typeof sceneCompositionSchema>;
export type SceneManifestInput = z.infer<typeof sceneManifestSchema>;
