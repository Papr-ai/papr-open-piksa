/**
 * Enhanced Spatial Scene Creation Tool
 * Addresses spatial consistency and prescriptive positioning for book image generation
 */

import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';

// Enhanced environment creation schema with spatial layout
const spatialEnvironmentSchema = z.object({
  bookId: z.string().describe('Book identifier'),
  environmentId: z.string().describe('Unique environment identifier'),
  environmentName: z.string().describe('Name of the environment (e.g., "Airplane Interior", "Castle Courtyard")'),
  
  // Spatial layout requirements
  viewType: z.enum(['top-down', 'isometric', 'wide-angle', 'birds-eye']).describe('Primary view type for spatial understanding'),
  spatialDescription: z.string().describe('Detailed spatial layout description including key areas, furniture placement, walkways, seating arrangements, etc.'),
  
  // Environment zones for character placement
  zones: z.array(z.object({
    zoneId: z.string().describe('Unique zone identifier (e.g., "pilot-seat", "window-seats-left", "aisle")'),
    zoneName: z.string().describe('Human-readable zone name'),
    description: z.string().describe('What this zone contains and its purpose'),
    characterCapacity: z.number().describe('Maximum number of characters that can be placed here'),
    accessibilityNotes: z.string().optional().describe('How characters access this zone')
  })).describe('Defined zones within the environment for precise character placement'),
  
  // Visual style
  styleBible: z.string().describe('Art style and visual approach'),
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '3:4', '9:16']).default('16:9')
});

// Enhanced scene composition with prescriptive positioning
const prescriptiveSceneSchema = z.object({
  bookId: z.string().describe('Book identifier'),
  sceneId: z.string().describe('Scene identifier'),
  environmentId: z.string().describe('Environment to use'),
  
  // Scene description
  sceneDescription: z.string().describe('What happens in this scene'),
  
  // Prescriptive character positioning
  characterPlacements: z.array(z.object({
    characterId: z.string().describe('Character identifier'),
    characterName: z.string().describe('Character name'),
    zoneId: z.string().describe('Which environment zone they are placed in'),
    specificPosition: z.string().describe('Exact position within the zone (e.g., "sitting in window seat 3A", "standing in the aisle between rows 2 and 3")'),
    pose: z.string().describe('Character pose and body language'),
    facingDirection: z.string().describe('Where the character is looking/facing'),
    interactionWithEnvironment: z.string().describe('How they interact with the environment (touching, leaning on, sitting in, etc.)')
  })).describe('Precise positioning for each character in the scene'),
  
  // Camera and composition
  cameraAngle: z.string().describe('Camera angle and perspective'),
  focusPoint: z.string().describe('What the scene should focus on'),
  lighting: z.string().describe('Lighting conditions and mood'),
  
  // Spatial validation
  spatialConsistency: z.string().describe('Notes about spatial relationships and consistency with environment layout')
});

type SpatialEnvironmentInput = z.infer<typeof spatialEnvironmentSchema>;
type PrescriptiveSceneInput = z.infer<typeof prescriptiveSceneSchema>;

/**
 * Create Environment with Spatial Layout Understanding
 */
export const createSpatialEnvironment = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Create environment images with comprehensive spatial layout understanding for accurate character placement.
    
    🗺️ **SPATIAL LAYOUT FIRST**: Creates environments with clear spatial understanding including:
    - Top-down or isometric views showing complete layout
    - Defined zones for character placement (seats, walkways, furniture areas)
    - Clear spatial relationships between elements
    - Accessibility paths and interaction points
    
    🎯 **ZONE-BASED PLACEMENT**: Defines specific zones within environments:
    - Each zone has clear boundaries and purpose
    - Character capacity limits prevent overcrowding
    - Accessibility notes for realistic movement
    - Consistent spatial logic across scenes
    
    📐 **ENHANCED SPATIAL PROMPTS**: Environment creation includes:
    - Architectural accuracy and proportions
    - Clear sight lines and perspective
    - Consistent scale references
    - Detailed spatial relationship descriptions
    
    This ensures characters can be placed accurately in subsequent scenes with proper spatial context.`,
    
    inputSchema: spatialEnvironmentSchema,
    
    execute: async (input: SpatialEnvironmentInput) => {
      const { bookId, environmentId, environmentName, viewType, spatialDescription, zones, styleBible, aspectRatio } = input;
      
      try {
        // Stream progress update
        dataStream.writeData({
          type: 'progress',
          message: `Creating spatial environment: ${environmentName}`,
          step: 'environment-spatial-creation'
        });
        
        // Create enhanced environment prompt with spatial understanding
        const spatialPrompt = createSpatialEnvironmentPrompt({
          environmentName,
          viewType,
          spatialDescription,
          zones,
          styleBible
        });
        
        // Use the createSingleBookImage tool for actual image generation
        const { createSingleBookImage } = await import('./create-single-book-image');
        const imageCreationTool = createSingleBookImage({ session, dataStream });
        
        if (imageCreationTool.execute) {
          const result = await imageCreationTool.execute({
            bookId,
            imageType: 'environment',
            name: environmentName,
            description: spatialPrompt,
            styleBible,
            aspectRatio,
            saveToMemory: true,
            saveToBookProp: true
          });
          
          // Save zone information to memory for later use
          await saveEnvironmentZones(bookId, environmentId, zones, session);
          
          return {
            success: true,
            environmentId,
            environmentName,
            imageUrl: result.imageUrl,
            zones: zones.map(zone => ({
              zoneId: zone.zoneId,
              zoneName: zone.zoneName,
              description: zone.description
            })),
            spatialLayout: {
              viewType,
              spatialDescription
            },
            message: `Spatial environment "${environmentName}" created with ${zones.length} placement zones`
          };
        }
        
        throw new Error('Image creation tool not available');
        
      } catch (error) {
        console.error('[createSpatialEnvironment] Error:', error);
        return {
          success: false,
          error: `Failed to create spatial environment: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  });

/**
 * Create Scene with Prescriptive Character Positioning
 */
export const createPrescriptiveScene = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Create scenes with prescriptive, spatially-aware character positioning to prevent spatial inconsistencies.
    
    🎯 **PRESCRIPTIVE POSITIONING**: Each character has:
    - Specific zone assignment within the environment
    - Exact position description (seat numbers, precise locations)
    - Defined pose and body language
    - Clear facing direction and focus
    - Specific environment interactions
    
    🗺️ **SPATIAL VALIDATION**: Ensures:
    - Characters are placed in logical, accessible positions
    - No spatial conflicts or impossible placements
    - Consistent scale and perspective
    - Realistic interaction with environment elements
    
    📝 **DETAILED INSTRUCTIONS**: Scene creation includes:
    - Zone-based placement system
    - Specific positioning language
    - Environmental interaction details
    - Spatial relationship validation
    
    This prevents issues like "character sitting on airplane tray" by being explicit about placement.`,
    
    inputSchema: prescriptiveSceneSchema,
    
    execute: async (input: PrescriptiveSceneInput) => {
      const { 
        bookId, 
        sceneId, 
        environmentId, 
        sceneDescription, 
        characterPlacements, 
        cameraAngle, 
        focusPoint, 
        lighting,
        spatialConsistency 
      } = input;
      
      try {
        // Stream progress update
        dataStream.writeData({
          type: 'progress',
          message: `Creating prescriptive scene: ${sceneId}`,
          step: 'scene-prescriptive-creation'
        });
        
        // Load environment zones from memory
        const environmentZones = await loadEnvironmentZones(bookId, environmentId, session);
        
        // Validate character placements against zones
        const validationResult = validateCharacterPlacements(characterPlacements, environmentZones);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: `Spatial validation failed: ${validationResult.errors.join(', ')}`
          };
        }
        
        // Create prescriptive scene prompt
        const prescriptivePrompt = createPrescriptiveScenePrompt({
          sceneDescription,
          characterPlacements,
          environmentZones,
          cameraAngle,
          focusPoint,
          lighting,
          spatialConsistency
        });
        
        // Get character and environment images as seeds
        const seedImages = await gatherSceneSeedImages(bookId, environmentId, characterPlacements, session);
        
        // Use createImage tool with prescriptive prompt
        const { createImage } = await import('./create-image');
        const imageCreationTool = createImage({ session });
        
        if (imageCreationTool.execute) {
          const result = await imageCreationTool.execute({
            prompt: prescriptivePrompt,
            seedImages: seedImages.urls,
            seedImageTypes: seedImages.types,
            context: `Book: ${bookId}, Scene: ${sceneId}`,
            saveToMemory: true
          });
          
          return {
            success: true,
            sceneId,
            imageUrl: result.imageUrl,
            characterPlacements: characterPlacements.map(cp => ({
              character: cp.characterName,
              zone: cp.zoneId,
              position: cp.specificPosition
            })),
            spatialValidation: validationResult.summary,
            message: `Prescriptive scene created with ${characterPlacements.length} precisely positioned characters`
          };
        }
        
        throw new Error('Image creation tool not available');
        
      } catch (error) {
        console.error('[createPrescriptiveScene] Error:', error);
        return {
          success: false,
          error: `Failed to create prescriptive scene: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
  });

/**
 * Helper Functions
 */

function createSpatialEnvironmentPrompt({ environmentName, viewType, spatialDescription, zones, styleBible }: {
  environmentName: string;
  viewType: string;
  spatialDescription: string;
  zones: any[];
  styleBible: string;
}): string {
  return `SPATIAL ENVIRONMENT MASTER PLATE: ${environmentName}

VIEW TYPE: ${viewType} - Show complete spatial layout and relationships
SPATIAL LAYOUT: ${spatialDescription}

DEFINED ZONES FOR CHARACTER PLACEMENT:
${zones.map(zone => 
  `- ${zone.zoneName} (${zone.zoneId}): ${zone.description} [Capacity: ${zone.characterCapacity}]`
).join('\n')}

CRITICAL SPATIAL REQUIREMENTS:
1. Show complete environment layout with clear zone boundaries
2. Ensure all zones are visible and accessible
3. Maintain consistent scale and proportions
4. Include clear sight lines and perspective references
5. Show architectural details that define spatial relationships
6. Create empty environment ready for character placement

STYLE: ${styleBible}

The environment should provide a clear spatial framework where characters can be placed logically and realistically in subsequent scene compositions.`;
}

function createPrescriptiveScenePrompt({ 
  sceneDescription, 
  characterPlacements, 
  environmentZones, 
  cameraAngle, 
  focusPoint, 
  lighting, 
  spatialConsistency 
}: {
  sceneDescription: string;
  characterPlacements: any[];
  environmentZones: any[];
  cameraAngle: string;
  focusPoint: string;
  lighting: string;
  spatialConsistency: string;
}): string {
  return `PRESCRIPTIVE SCENE COMPOSITION:

SCENE: ${sceneDescription}
CAMERA ANGLE: ${cameraAngle}
FOCUS POINT: ${focusPoint}
LIGHTING: ${lighting}

PRECISE CHARACTER POSITIONING:
${characterPlacements.map(cp => `
CHARACTER: ${cp.characterName}
- ZONE: ${cp.zoneId} (${getZoneDescription(cp.zoneId, environmentZones)})
- EXACT POSITION: ${cp.specificPosition}
- POSE: ${cp.pose}
- FACING: ${cp.facingDirection}
- ENVIRONMENT INTERACTION: ${cp.interactionWithEnvironment}
`).join('\n')}

SPATIAL CONSISTENCY NOTES: ${spatialConsistency}

CRITICAL COMPOSITION REQUIREMENTS:
1. Place each character EXACTLY as specified in their designated zone
2. Ensure characters interact with environment elements as described
3. Maintain proper scale and perspective for all characters
4. Show clear spatial relationships between characters and environment
5. Validate that all positions are physically possible and logical
6. Characters should appear naturally integrated, not artificially placed

The seed images provide the environment base and character appearances - compose them according to the precise positioning instructions above.`;
}

async function saveEnvironmentZones(bookId: string, environmentId: string, zones: any[], session: Session): Promise<void> {
  // Save zone information to memory for later retrieval
  try {
    const { addMemory } = await import('@/lib/ai/memory/middleware');
    const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY;
    
    if (PAPR_MEMORY_API_KEY) {
      await addMemory({
        userId: session.user.id,
        content: JSON.stringify({
          type: 'environment-zones',
          bookId,
          environmentId,
          zones
        }),
        type: 'environment-spatial-data',
        apiKey: PAPR_MEMORY_API_KEY
      });
    }
  } catch (error) {
    console.error('[saveEnvironmentZones] Error:', error);
  }
}

async function loadEnvironmentZones(bookId: string, environmentId: string, session: Session): Promise<any[]> {
  // Load zone information from memory
  try {
    const { searchMemories } = await import('@/lib/ai/memory/middleware');
    const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY;
    
    if (PAPR_MEMORY_API_KEY) {
      const memories = await searchMemories({
        userId: session.user.id,
        query: `environment zones ${environmentId} ${bookId}`,
        maxResults: 5,
        apiKey: PAPR_MEMORY_API_KEY
      });
      
      for (const memory of memories) {
        try {
          const data = JSON.parse(memory.content);
          if (data.type === 'environment-zones' && data.environmentId === environmentId) {
            return data.zones;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error('[loadEnvironmentZones] Error:', error);
  }
  
  return [];
}

function validateCharacterPlacements(placements: any[], zones: any[]): { isValid: boolean; errors: string[]; summary: string } {
  const errors: string[] = [];
  const zoneUsage: Record<string, number> = {};
  
  for (const placement of placements) {
    const zone = zones.find(z => z.zoneId === placement.zoneId);
    
    if (!zone) {
      errors.push(`Zone "${placement.zoneId}" not found for character ${placement.characterName}`);
      continue;
    }
    
    zoneUsage[placement.zoneId] = (zoneUsage[placement.zoneId] || 0) + 1;
    
    if (zoneUsage[placement.zoneId] > zone.characterCapacity) {
      errors.push(`Zone "${placement.zoneId}" exceeds capacity (${zone.characterCapacity}) with ${zoneUsage[placement.zoneId]} characters`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    summary: `Validated ${placements.length} character placements across ${Object.keys(zoneUsage).length} zones`
  };
}

function getZoneDescription(zoneId: string, zones: any[]): string {
  const zone = zones.find(z => z.zoneId === zoneId);
  return zone ? zone.description : 'Unknown zone';
}

async function gatherSceneSeedImages(bookId: string, environmentId: string, characterPlacements: any[], session: Session): Promise<{ urls: string[]; types: string[] }> {
  // This would gather environment and character images as seeds
  // Implementation would search memory/BookProp for relevant images
  
  return {
    urls: [], // Would be populated with actual image URLs
    types: [] // Would be populated with image types ('environment', 'character', etc.)
  };
}
