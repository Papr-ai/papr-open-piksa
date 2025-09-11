import { tool } from 'ai';
import { z } from 'zod';
import { type Session } from 'next-auth';
import { DataStreamWriter } from '@/lib/types';

interface CreateBookImagePlanProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const createBookImagePlanSchema = z.object({
  bookId: z.string().describe('The unique identifier for the book'),
  bookTitle: z.string().describe('The title of the book'),
  characters: z.array(z.object({
    name: z.string().describe('Character name'),
    description: z.string().describe('Character description and personality'),
    physicalDescription: z.string().describe('Physical appearance details'),
    role: z.string().optional().describe('Character role in the story')
  })).describe('List of characters that need portraits'),
  environments: z.array(z.object({
    name: z.string().describe('Environment name'),
    description: z.string().describe('Environment description and mood'),
    timeOfDay: z.string().optional().describe('Time of day for the environment'),
    weather: z.string().optional().describe('Weather conditions')
  })).describe('List of environments that need images'),
  scenes: z.array(z.object({
    sceneId: z.string().describe('Unique scene identifier'),
    description: z.string().describe('Scene description'),
    characters: z.array(z.string()).describe('Character names in this scene'),
    environment: z.string().describe('Environment name for this scene')
  })).optional().describe('Optional list of scenes that need composition images'),
  styleBible: z.string().optional().describe('Art style guidelines for the book'),
  conversationContext: z.string().optional().describe('Full conversation context for style consistency')
});

type CreateBookImagePlanInput = z.infer<typeof createBookImagePlanSchema>;

type CreateBookImagePlanOutput = {
  success: boolean;
  planId: string;
  bookId: string;
  bookTitle: string;
  totalImages: number;
  phases: {
    characters: {
      count: number;
      items: Array<{
        id: string;
        name: string;
        description: string;
        physicalDescription: string;
        priority: number;
      }>;
    };
    environments: {
      count: number;
      items: Array<{
        id: string;
        name: string;
        description: string;
        timeOfDay?: string;
        weather?: string;
        priority: number;
      }>;
    };
    scenes?: {
      count: number;
      items: Array<{
        id: string;
        sceneId: string;
        description: string;
        characters: string[];
        environment: string;
        priority: number;
      }>;
    };
  };
  styleBible: string;
  nextAction: string;
  message: string;
};

export const createBookImagePlan = ({ session, dataStream }: CreateBookImagePlanProps) =>
  tool({
    description: `Create a structured plan for book image creation. This tool analyzes the book requirements and creates a prioritized plan for generating character portraits, environments, and scene compositions.

    This is the FIRST step in the book image creation workflow:
    1. 📋 Plan Creation (this tool) - Analyzes needs and creates task list
    2. 👤 Character Creation - Individual character portraits with approval gates  
    3. 🏞️ Environment Creation - Individual environment images with approval gates
    4. 🎬 Scene Composition - Individual scene compositions (optional)

    Benefits:
    - User sees immediate plan and progress
    - Each image shows up as it's created
    - User can approve/reject individual images
    - Better error handling and retry capability
    - Clear progress tracking`,
    inputSchema: createBookImagePlanSchema,
    execute: async (input: CreateBookImagePlanInput): Promise<CreateBookImagePlanOutput> => {
      const { bookId, bookTitle, characters, environments, scenes, styleBible, conversationContext } = input;

      if (!session?.user?.id) {
        console.error('[createBookImagePlan] Unauthorized: No user session');
        return {
          success: false,
          planId: '',
          bookId,
          bookTitle,
          totalImages: 0,
          phases: { characters: { count: 0, items: [] }, environments: { count: 0, items: [] } },
          styleBible: '',
          nextAction: 'Authentication required',
          message: 'User session not found'
        };
      }

      try {
        console.log(`[createBookImagePlan] Creating image plan for book: ${bookTitle}`);

        // Generate unique plan ID
        const planId = `plan-${bookId}-${Date.now()}`;

        // Create character tasks with priority
        const characterTasks = characters.map((char, index) => ({
          id: `char-${bookId}-${char.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: char.name,
          description: char.description,
          physicalDescription: char.physicalDescription,
          priority: index + 1 // Main characters first
        }));

        // Create environment tasks with priority  
        const environmentTasks = environments.map((env, index) => ({
          id: `env-${bookId}-${env.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: env.name,
          description: env.description,
          timeOfDay: env.timeOfDay,
          weather: env.weather,
          priority: index + 1
        }));

        // Create scene tasks (optional)
        const sceneTasks = scenes?.map((scene, index) => ({
          id: `scene-${bookId}-${scene.sceneId}`,
          sceneId: scene.sceneId,
          description: scene.description,
          characters: scene.characters,
          environment: scene.environment,
          priority: index + 1
        })) || [];

        const totalImages = characterTasks.length + environmentTasks.length + sceneTasks.length;
        const extractedStyleBible = styleBible || conversationContext?.match(/Style Bible:\s*([^\n]+)/i)?.[1] || 'Children\'s book illustration style';

        // Send progress update
        dataStream.write?.({
          type: 'book-image-plan-created',
          content: {
            planId,
            bookId,
            bookTitle,
            totalImages,
            characterCount: characterTasks.length,
            environmentCount: environmentTasks.length,
            sceneCount: sceneTasks.length,
            styleBible: extractedStyleBible
          }
        });

        const result: CreateBookImagePlanOutput = {
          success: true,
          planId,
          bookId,
          bookTitle,
          totalImages,
          phases: {
            characters: {
              count: characterTasks.length,
              items: characterTasks
            },
            environments: {
              count: environmentTasks.length,
              items: environmentTasks
            },
            ...(sceneTasks.length > 0 && {
              scenes: {
                count: sceneTasks.length,
                items: sceneTasks
              }
            })
          },
          styleBible: extractedStyleBible,
          nextAction: characterTasks.length > 0 
            ? `Ready to create ${characterTasks.length} character portrait${characterTasks.length > 1 ? 's' : ''}. I'll start with "${characterTasks[0].name}".`
            : environmentTasks.length > 0
            ? `Ready to create ${environmentTasks.length} environment image${environmentTasks.length > 1 ? 's' : ''}. I'll start with "${environmentTasks[0].name}".`
            : 'Plan created but no images to generate.',
          message: `📋 **Image Creation Plan Created**\n\n` +
            `**Book**: ${bookTitle}\n` +
            `**Total Images**: ${totalImages}\n\n` +
            `**Phase 1**: ${characterTasks.length} Character Portraits\n` +
            `**Phase 2**: ${environmentTasks.length} Environment Images\n` +
            `${sceneTasks.length > 0 ? `**Phase 3**: ${sceneTasks.length} Scene Compositions\n` : ''}` +
            `\n**Style**: ${extractedStyleBible}\n\n` +
            `✅ Plan ready! I'll create each image individually so you can see progress and approve each one.`
        };

        console.log(`[createBookImagePlan] Plan created successfully:`, {
          planId,
          totalImages,
          characterCount: characterTasks.length,
          environmentCount: environmentTasks.length
        });

        return result;

      } catch (error) {
        console.error('[createBookImagePlan] Error creating plan:', error);
        return {
          success: false,
          planId: '',
          bookId,
          bookTitle,
          totalImages: 0,
          phases: { characters: { count: 0, items: [] }, environments: { count: 0, items: [] } },
          styleBible: '',
          nextAction: 'Error occurred',
          message: `Failed to create image plan: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },
  });
