import { z } from 'zod';
import { tool, type ToolCallOptions } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import type { CreateImageOutput } from './create-image';

// Import FormattedMemory type for memory operations
interface FormattedMemory {
  id: string;
  content?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// Enhanced Book Creation Workflow Tool
// Implements the complete 7-step book creation process with approval gates

// Base schemas for book creation workflow
const bookPlanningSchema = z.object({
  bookTitle: z.string().describe('The title of the book'),
  genre: z.string().describe('Genre of the book (e.g., children\'s adventure, fantasy, mystery)'),
  targetAge: z.string().describe('Target age group (e.g., 4-8 years, 8-12 years)'),
  premise: z.string().describe('High-level story premise and plot outline'),
  themes: z.array(z.string()).describe('Main themes of the book'),
  mainCharacters: z.array(z.object({
    name: z.string(),
    role: z.string().describe('Character role (protagonist, antagonist, sidekick, etc.)'),
    personality: z.string().describe('Character personality traits and motivations'),
    physicalDescription: z.string().describe('Detailed physical appearance for consistency'),
    backstory: z.string().optional().describe('Character backstory and history')
  })).describe('Main characters with detailed descriptions'),
  styleBible: z.string().describe('Art and writing style guidelines for consistency'),
  isPictureBook: z.boolean().describe('Whether this is a picture book requiring illustrations'),
  conversationContext: z.string().optional().describe('CRITICAL: Full context from the chat conversation including all character details, plot points, and story elements discussed. This ensures consistency with what was established in the conversation.'),
  skipMemorySearch: z.boolean().optional().default(false).describe('Set to true if the AI has already searched memories and has all necessary context from the conversation'),
  autoCreateDocuments: z.boolean().optional().default(false).describe('Set to true to automatically create character profile and outline documents using createDocument tool'),
  skipApprovalGate: z.boolean().optional().default(false).describe('Set to true when user has indicated to proceed/continue without explicit approval')
});

const chapterDraftSchema = z.object({
  bookId: z.string().describe('The book ID from the planning phase'),
  chapterNumber: z.number().describe('Chapter number'),
  chapterTitle: z.string().describe('Chapter title'),
  chapterText: z.string().describe('Full chapter text content'),
  wordCount: z.number().describe('Word count of the chapter'),
  keyEvents: z.array(z.string()).describe('Key story events in this chapter'),
  isPictureBook: z.boolean().optional().describe('Whether this is a picture book requiring scene structure - if true, the tool will automatically break the chapter into scenes'),
  bookContext: z.string().optional().describe('Additional context about the book, characters, and story style for scene generation')
});

const sceneSegmentationSchema = z.object({
  bookId: z.string().describe('The book ID'),
  chapterNumber: z.number().describe('Chapter number to segment'),
  scenes: z.array(z.object({
    sceneId: z.string().describe('Unique scene identifier'),
    sceneNumber: z.number().describe('Scene number within chapter'),
    synopsis: z.string().describe('Brief scene synopsis'),
    environment: z.object({
      location: z.string().describe('Location/setting name'),
      timeOfDay: z.enum(['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night']),
      weather: z.string().describe('Weather conditions'),
      mood: z.string().describe('Environmental mood/atmosphere'),
      description: z.string().describe('Detailed environment description')
    }),
    requiredCharacters: z.array(z.string()).describe('Character names required in this scene'),
    requiredProps: z.array(z.string()).describe('Props/objects required in this scene'),
    continuityNotes: z.string().optional().describe('Important continuity requirements')
  })).describe('Scenes broken down from the chapter')
});

const characterPortraitSchema = z.object({
  bookId: z.string().describe('The book ID'),
  characterName: z.string().describe('Character name to create portrait for'),
  generatePortrait: z.boolean().describe('Whether to generate a new portrait or use existing'),
  portraitStyle: z.string().describe('Art style for the portrait (consistent with book style)'),
  transparentBackground: z.boolean().default(true).describe('Whether to generate with transparent/white background for scene composition'),
  baseOutfit: z.string().describe('Description of the character\'s base outfit - their standard, consistent clothing worn throughout the book'),
  props: z.array(z.object({
    propName: z.string(),
    description: z.string(),
    mustPresent: z.boolean().describe('Whether this prop must appear in every scene with this character'),
    size: z.string().describe('Relative size (small, medium, large)'),
    material: z.string().describe('Material/texture of the prop')
  })).optional().describe('Associated character props to create')
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
  seed: z.number().optional().describe('Random seed for consistency')
});

// Step 1: High-level Story + Character Planning Tool
export const createBookPlan = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 1 of Enhanced Book Creation: Plan high-level story, themes, and main characters.
    
    🚨 CRITICAL REQUIREMENTS:
    1. ALWAYS searches memory FIRST for existing book plans, character information, and related content
    2. MUST receive conversationContext parameter with ALL details from the chat conversation
    3. Uses existing context to build upon previous work, ensuring NO information is lost
    
    The conversationContext parameter is ESSENTIAL to preserve:
    - Character names, ages, genders, and descriptions from the conversation
    - Plot details and story elements discussed in chat
    - User preferences and specific requirements mentioned
    - Any existing character portraits or images referenced
    
    This tool creates the foundational elements of your book:
    - Story premise and themes
    - Main character personalities and descriptions
    - Art/writing style bible
    - Determines if it's a picture book
    
    After completion, user approval is required before proceeding to Step 2 (Chapter Writing).`,
    inputSchema: bookPlanningSchema,
    execute: async (input) => {
      const { bookTitle, genre, targetAge, premise, themes, mainCharacters, styleBible, isPictureBook, conversationContext, skipMemorySearch, autoCreateDocuments, skipApprovalGate } = input;
      
      // Validate that conversation context was provided
      if (!conversationContext || conversationContext.length < 50) {
        console.warn('[createBookPlan] ⚠️ WARNING: conversationContext is missing or very short. This may result in character details being lost or changed!');
        console.warn('[createBookPlan] conversationContext length:', conversationContext?.length || 0);
      } else {
        console.log('[createBookPlan] ✅ Conversation context provided:', conversationContext.substring(0, 100) + '...');
      }

      // CONDITIONALLY SEARCH MEMORY - skip if AI already has context
      let existingBookContext = '';
      let existingCharacters: any[] = [];
      
      if (!skipMemorySearch && session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              console.log('[createBookPlan] Searching memory for existing book plans and characters...');
              
              // Search for existing book plans
              const bookMemories = await memoryService.searchMemories(
                paprUserId,
                `book brief "${bookTitle}" story premise themes characters`,
                10
              );
              
              if (bookMemories.length > 0) {
                existingBookContext = bookMemories.map(mem => mem.content).join('\n\n');
                console.log(`[createBookPlan] Found ${bookMemories.length} existing book-related memories`);
              }
              
              // Search for existing characters mentioned in the plan
              for (const character of mainCharacters) {
                const charMemories = await memoryService.searchMemories(
                  paprUserId,
                  `character "${character.name}" personality description portrait`,
                  5
                );
                
                if (charMemories.length > 0) {
                  existingCharacters.push({
                    name: character.name,
                    existingInfo: charMemories.map(mem => mem.content).join('\n'),
                    memories: charMemories
                  });
                  console.log(`[createBookPlan] Found existing information for character: ${character.name}`);
                }
              }
            }
          }
        } catch (error) {
          console.error('[createBookPlan] Error searching memory:', error);
        }
      }
      
      dataStream.write?.({
        type: 'kind',
        content: 'book_plan',
      });

      dataStream.write?.({
        type: 'title',
        content: `${bookTitle} - Story Plan`,
      });

      // Generate unique book ID using proper UUID format
      const { generateUUID } = await import('@/lib/utils');
      const bookId = generateUUID();

      dataStream.write?.({
        type: 'id',
        content: bookId,
      });

      // Save book plan to memory with existing context integration
      if (session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Save enhanced book brief with existing context AND conversation context
              const bookBriefContent = `Book: ${bookTitle}

Genre: ${genre}
Target Age: ${targetAge}

Premise: ${premise}

Themes: ${themes.join(', ')}

Style Bible: ${styleBible}

${conversationContext ? `\n--- CONVERSATION CONTEXT ---\n${conversationContext}` : ''}

${existingBookContext ? `\n--- EXISTING CONTEXT FROM MEMORY ---\n${existingBookContext}` : ''}`;

              await memoryService.storeContent(
                paprUserId,
                bookBriefContent,
                'text',
                {
                  kind: 'book_brief',
                  book_id: bookId,
                  book_title: bookTitle,
                  genre,
                  target_age: targetAge,
                  is_picture_book: isPictureBook,
                  step: 'planning',
                  status: 'pending_approval',
                  has_existing_context: existingBookContext.length > 0,
                  has_conversation_context: !!conversationContext
                },
                session.user.id
              );

              // Save or update character bios in memory
              for (const character of mainCharacters) {
                const existingChar = existingCharacters.find(ec => ec.name === character.name);
                
                const characterContent = `Character: ${character.name}

Role: ${character.role}
Personality: ${character.personality}
Physical Description: ${character.physicalDescription}
${character.backstory ? `Backstory: ${character.backstory}` : ''}`;

                const characterMetadata = {
                  kind: 'character',
                  book_id: bookId,
                  book_title: bookTitle,
                  character_name: character.name,
                  character_role: character.role,
                  step: 'planning',
                  status: 'pending_approval',
                  updated_at: new Date().toISOString()
                };

                if (existingChar && existingChar.memories && existingChar.memories.length > 0) {
                  // Update the most recent existing memory instead of creating a new one
                  const mostRecentMemory = existingChar.memories[0]; // First result is usually most recent
                  console.log(`[createBookPlan] Updating existing memory for character: ${character.name}`);
                  
                  await memoryService.updateMemory(
                    mostRecentMemory.id,
                    {
                      content: characterContent,
                      metadata: {
                        customMetadata: characterMetadata
                      }
                    }
                  );
                } else {
                  // Create new memory if none exists
                  console.log(`[createBookPlan] Creating new memory for character: ${character.name}`);
                  
                  await memoryService.storeContent(
                    paprUserId,
                    characterContent,
                    'text',
                    characterMetadata,
                    session.user.id
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error('[createBookPlan] Error saving to memory:', error);
        }
      }

      // AUTOMATICALLY CREATE DOCUMENTS if requested
      if (autoCreateDocuments) {
        try {
          console.log('[createBookPlan] Auto-creating character profiles and outline documents...');
          
          // Import createDocument tool
          const { createDocument } = await import('./create-document');
          const docTool = createDocument({ session, dataStream });

          // Create character profiles document
          const characterProfilesContent = mainCharacters.map(char => 
            `## ${char.name}
**Role**: ${char.role}
**Personality**: ${char.personality}  
**Physical Description**: ${char.physicalDescription}
${char.backstory ? `**Backstory**: ${char.backstory}` : ''}`
          ).join('\n\n');

          const characterContext = `${conversationContext || ''}\n\nBook: ${bookTitle}\nGenre: ${genre}\nTarget Age: ${targetAge}`;
          
          if (docTool.execute) {
            await docTool.execute({
              title: `${bookTitle} - Character Profiles`,
              kind: 'text',
              conversationContext: characterContext
            }, { toolCallId: 'char-profiles-' + Date.now(), messages: [] });
          }

          // Create story outline document  
          const outlineContent = `# ${bookTitle} - Story Outline

**Genre**: ${genre}
**Target Age**: ${targetAge}

## Premise
${premise}

## Themes
${themes.map(theme => `- ${theme}`).join('\n')}

## Main Characters
${mainCharacters.map(char => `- **${char.name}**: ${char.role} - ${char.personality}`).join('\n')}

## Style Bible
${styleBible}`;

          if (docTool.execute) {
            await docTool.execute({
              title: `${bookTitle} - Story Outline`,
              kind: 'text', 
              conversationContext: characterContext
            }, { toolCallId: 'outline-' + Date.now(), messages: [] });
          }

          console.log('[createBookPlan] ✅ Auto-created character profiles and outline documents');
        } catch (docError) {
          console.error('[createBookPlan] Error creating documents:', docError);
        }
      }

      // ASYNC DATABASE STORAGE for characters and props
      if (session?.user?.id) {
        // Don't await this - run in background
        saveCharactersToDatabase(session.user.id, bookId, bookTitle, mainCharacters).catch(error => {
          console.error('[createBookPlan] Background database save failed:', error);
        });
      }

      return {
        success: true,
        bookId,
        bookTitle,
        genre,
        targetAge,
        premise,
        themes,
        mainCharacters,
        styleBible,
        isPictureBook,
        existingContext: {
          foundBookContext: existingBookContext.length > 0,
          foundCharacters: existingCharacters.length,
          characterDetails: existingCharacters.map(ec => ({ name: ec.name, hasExistingInfo: true }))
        },
        documentsCreated: autoCreateDocuments,
        nextStep: skipApprovalGate ? 'Proceeding to Step 2 (Chapter Drafting)' : 'Approval Gate 1: Please review and approve the story plan and character bios before proceeding to chapter writing.',
        approvalRequired: !skipApprovalGate
      };
    },
  });

// Step 2: Chapter Text Drafting Tool
export const draftChapter = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 2 of Enhanced Book Creation: Draft chapter content.
    
    For regular books: Creates traditional chapter text content
    For picture books: Creates scene-structured content with scene nodeviews
    
    This eliminates the need for separate scene segmentation step for picture books.`,
    inputSchema: chapterDraftSchema,
    execute: async (input) => {
      const { bookId, chapterNumber, chapterTitle, chapterText, wordCount, keyEvents, isPictureBook, bookContext } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'chapter_draft',
      });

      dataStream.write?.({
        type: 'title',
        content: `Chapter ${chapterNumber}: ${chapterTitle}${isPictureBook ? ' (Picture Book)' : ''}`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${bookId}_chapter_${chapterNumber}`,
      });

      let finalContent = chapterText;
      let sceneData: Array<{
        sceneId: string;
        sceneNumber: number;
        synopsis: string;
        environment: string;
        characters: string[];
      }> = [];

      // If this is a picture book, generate scene structure and create scene-structured content
      if (isPictureBook) {
        console.log(`[draftChapter] Generating scenes for picture book chapter: ${chapterTitle}`);
        
        dataStream.write?.({
          type: 'text',
          content: 'Analyzing chapter content and generating scene structure for picture book...\n\n',
        });
        
        // Generate scenes using AI
        const generatedScenes = await generateScenesFromChapter(
          chapterText, 
          chapterTitle, 
          bookContext, 
          bookId,
          dataStream
        );
        
        if (generatedScenes && generatedScenes.length > 0) {
          console.log(`[draftChapter] Generated ${generatedScenes.length} scenes`);
          
          // Create proper ProseMirror document with scene nodes
          const { buildContentFromScenes } = await import('@/lib/editor/server-functions');
          
          try {
            finalContent = await buildContentFromScenes(generatedScenes);
            console.log(`[draftChapter] Successfully created scene-structured content`);
          } catch (error) {
            console.error('[draftChapter] Error creating scene content, falling back to markdown:', error);
            // Fallback to markdown if scene node creation fails
            finalContent = '';
            for (const scene of generatedScenes) {
              const sceneMarkdown = createSceneMarkdown(scene, scene.content);
              finalContent += sceneMarkdown + '\n\n';
            }
          }
          
          // Store scene data for memory
          for (const scene of generatedScenes) {
            sceneData.push({
              sceneId: scene.sceneId,
              sceneNumber: scene.sceneNumber,
              synopsis: scene.synopsis,
              environment: scene.environment.location,
              characters: scene.requiredCharacters
            });
          }
        } else {
          console.warn('[draftChapter] No scenes generated, falling back to regular content');
          finalContent = chapterText;
        }
      }

      // Save chapter draft to memory and database
      if (session?.user?.id) {
        try {
          // Save to memory first
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              const memoryContent = isPictureBook && sceneData.length > 0
                ? `Chapter ${chapterNumber}: ${chapterTitle}\n\nPicture Book with ${sceneData.length} scenes:\n${sceneData.map(s => `- Scene ${s.sceneNumber}: ${s.synopsis}`).join('\n')}\n\n${finalContent}`
                : `Chapter ${chapterNumber}: ${chapterTitle}\n\n${chapterText}\n\nKey Events: ${keyEvents.join(', ')}`;

              await memoryService.storeContent(
                paprUserId,
                memoryContent,
                'text',
                {
                  kind: isPictureBook ? 'scene_based_chapter_draft' : 'chapter_draft',
                  book_id: bookId,
                  chapter_number: chapterNumber,
                  chapter_title: chapterTitle,
                  word_count: wordCount,
                  key_events: keyEvents,
                  is_picture_book: isPictureBook || false,
                  scene_count: sceneData.length,
                  step: 'chapter_drafting',
                  status: 'pending_approval'
                },
                session.user.id
              );
            }
          }

          // Also save to the existing book database using the current book tool
          const { createBook } = await import('./create-book');
          const bookTool = createBook({ session, dataStream });
          
          // Execute the existing book creation to save to database
          if (bookTool.execute) {
            await bookTool.execute({
            bookId,
            bookTitle: `Book ${bookId}`, // We'll need to retrieve this from memory
            chapterTitle,
            chapterNumber,
            description: `${isPictureBook ? 'Picture book chapter' : 'Chapter'} with ${wordCount} words`,
            bookContext: finalContent
          }, { toolCallId: 'book-save-' + Date.now(), messages: [] } as ToolCallOptions);
          }

        } catch (error) {
          console.error('[draftChapter] Error saving:', error);
        }
      }

      return {
        success: true,
        bookId,
        chapterNumber,
        chapterTitle,
        content: finalContent,
        wordCount,
        keyEvents,
        scenes: isPictureBook ? sceneData : undefined,
        nextStep: isPictureBook 
          ? `Picture book chapter created with ${sceneData.length} scene${sceneData.length !== 1 ? 's' : ''}. Ready for character and environment creation.`
          : 'Chapter draft created. Ready for approval.',
        approvalRequired: true
      };
    },
  });

// Helper function to create scene markdown with proper structure
function createSceneMarkdown(scene: any, content: string): string {
  // Create scene node with attributes
  const sceneAttributes = {
    'data-scene-id': scene.sceneId,
    'data-scene-number': scene.sceneNumber.toString(),
    'data-synopsis': scene.synopsis,
    'data-environment': scene.environment.location,
    'data-characters': JSON.stringify(scene.requiredCharacters)
  };

  const attributeString = Object.entries(sceneAttributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  return `<div class="scene-block" ${attributeString}>

${content}

</div>`;
}

// AI-powered scene generation function
async function generateScenesFromChapter(
  chapterText: string,
  chapterTitle: string,
  bookContext?: string,
  bookId?: string,
  dataStream?: DataStreamWriter
): Promise<Array<{
  sceneId: string;
  sceneNumber: number;
  synopsis: string;
  content: string;
  environment: {
    location: string;
    timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
    weather: string;
    mood: string;
    description: string;
  };
  requiredCharacters: string[];
  requiredProps: string[];
  continuityNotes?: string;
}> | null> {
  try {
    const { streamText } = await import('ai');
    const { openai } = await import('@ai-sdk/openai');

    const sceneGenerationPrompt = `Analyze this chapter content and break it into 2-4 natural scenes for a picture book.

Chapter Title: ${chapterTitle}
Chapter Content:
${chapterText}

${bookContext ? `Book Context: ${bookContext}` : ''}

For each scene, provide:
1. A unique scene ID (format: scene-N-${chapterTitle.toLowerCase().replace(/\s+/g, '-')})
2. Scene number (1, 2, 3, etc.)
3. Brief synopsis (1-2 sentences)
4. The actual text content for that scene (2-3 paragraphs from the chapter)
5. Environment details (location, time of day, weather, mood)
6. Required characters in the scene
7. Any props or objects needed

Respond with a JSON array of scenes. Each scene should have this structure:
{
  "sceneId": "scene-1-chapter-title",
  "sceneNumber": 1,
  "synopsis": "Brief description of what happens",
  "content": "The actual text content for this scene",
  "environment": {
    "location": "Location name",
    "timeOfDay": "morning|afternoon|evening|night",
    "weather": "clear|cloudy|rainy|etc",
    "mood": "cheerful|mysterious|adventurous|etc",
    "description": "Detailed environment description"
  },
  "requiredCharacters": ["Character 1", "Character 2"],
  "requiredProps": ["prop1", "prop2"],
  "continuityNotes": "Important notes for visual consistency"
}

Make sure the scenes flow naturally and cover the entire chapter content. Focus on visual moments that would work well as illustrations.`;

    let sceneResponse = '';
    
    let streamResult;
    try {
      streamResult = streamText({
        model: openai('gpt-4o'),
        system: 'You are an expert at breaking down children\'s book chapters into visual scenes. Respond only with valid JSON.',
        prompt: sceneGenerationPrompt,
      });
    } catch (reasoningError: any) {
      console.error('[Enhanced Book Creation] Error with scene generation AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[Enhanced Book Creation] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        streamResult = streamText({
          model: openai('gpt-4o'),
          system: 'You are an expert at breaking down children\'s book chapters into visual scenes. Respond only with valid JSON.',
          prompt: sceneGenerationPrompt,
        });
      } else {
        throw reasoningError;
      }
    }

    for await (const textDelta of streamResult.textStream) {
      sceneResponse += textDelta;
      dataStream?.write?.({
        type: 'text-delta',
        content: textDelta,
      });
    }

    // Parse the JSON response
    const cleanResponse = sceneResponse.trim();
    let scenes;
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        scenes = JSON.parse(jsonMatch[0]);
      } else {
        scenes = JSON.parse(cleanResponse);
      }
    } catch (parseError) {
      console.error('[generateScenesFromChapter] JSON parse error:', parseError);
      console.log('[generateScenesFromChapter] Raw response:', cleanResponse);
      return null;
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      console.error('[generateScenesFromChapter] Invalid scenes format:', scenes);
      return null;
    }

    console.log(`[generateScenesFromChapter] Successfully generated ${scenes.length} scenes`);
    return scenes;

  } catch (error) {
    console.error('[generateScenesFromChapter] Error generating scenes:', error);
    return null;
  }
}

// Step 3: Scene Segmentation and Environment Mapping Tool
export const segmentChapterIntoScenes = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 3 of Enhanced Book Creation: Break chapter into scenes with environment mapping.
    
    Only used for picture books. Segments chapter text into individual scenes,
    each tied to a specific environment (location + time + weather).`,
    inputSchema: sceneSegmentationSchema,
    execute: async (input) => {
      const { bookId, chapterNumber, scenes } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'scene_segmentation',
      });

      dataStream.write?.({
        type: 'title',
        content: `Chapter ${chapterNumber} - Scene Breakdown`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${bookId}_scenes_ch${chapterNumber}`,
      });

      // Save scenes and environments to memory
      if (session?.user?.id) {
        try {
          const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
          const apiKey = process.env.PAPR_MEMORY_API_KEY;
          
          if (apiKey) {
            const memoryService = createMemoryService(apiKey);
            const paprUserId = await ensurePaprUser(session.user.id, apiKey);
            
            if (paprUserId) {
              // Save each scene
              for (const scene of scenes) {
                await memoryService.storeContent(
                  paprUserId,
                  `Scene ${scene.sceneNumber}: ${scene.synopsis}\n\nEnvironment: ${scene.environment.location} at ${scene.environment.timeOfDay}\nWeather: ${scene.environment.weather}\nMood: ${scene.environment.mood}\n\nRequired Characters: ${scene.requiredCharacters.join(', ')}\nRequired Props: ${scene.requiredProps.join(', ')}\n\n${scene.continuityNotes || ''}`,
                  'text',
                  {
                    kind: 'scene',
                    book_id: bookId,
                    chapter_number: chapterNumber,
                    scene_id: scene.sceneId,
                    scene_number: scene.sceneNumber,
                    location: scene.environment.location,
                    time_of_day: scene.environment.timeOfDay,
                    weather: scene.environment.weather,
                    required_characters: scene.requiredCharacters,
                    required_props: scene.requiredProps,
                    step: 'scene_segmentation',
                    status: 'pending_approval'
                  },
                  session.user.id
                );

                // Save environment draft
                await memoryService.storeContent(
                  paprUserId,
                  `Environment: ${scene.environment.location}\n\nTime: ${scene.environment.timeOfDay}\nWeather: ${scene.environment.weather}\nMood: ${scene.environment.mood}\nDescription: ${scene.environment.description}`,
                  'text',
                  {
                    kind: 'environment',
                    book_id: bookId,
                    environment_id: `${bookId}_env_${scene.environment.location}_${scene.environment.timeOfDay}`,
                    location: scene.environment.location,
                    time_of_day: scene.environment.timeOfDay,
                    weather: scene.environment.weather,
                    step: 'scene_segmentation',
                    status: 'pending_approval'
                  },
                  session.user.id
                );
              }
            }
          }
        } catch (error) {
          console.error('[segmentChapterIntoScenes] Error saving to memory:', error);
        }
      }

      return {
        success: true,
        bookId,
        chapterNumber,
        scenesCreated: scenes.length,
        scenes: scenes.map(s => ({
          sceneId: s.sceneId,
          synopsis: s.synopsis,
          environment: s.environment.location,
          timeOfDay: s.environment.timeOfDay
        })),
        nextStep: 'Approval Gate 3: Please review and approve the scene list and environment mapping before creating character portraits.',
        approvalRequired: true
      };
    },
  });

// Batch Character Creation Schema
const batchCharacterCreationSchema = z.object({
  bookId: z.string().describe('The book ID'),
  characters: z.array(z.object({
    characterName: z.string().describe('Character name to create portrait for'),
    portraitStyle: z.string().describe('Art style for the portrait (consistent with book style)'),
    baseOutfit: z.string().describe('Description of the character\'s base outfit - their standard, consistent clothing worn throughout the book'),
    seedImages: z.array(z.string()).optional().describe('Specific seed image URLs to use for this character (AI agent should provide these after user confirmation)'),
    useExistingPortrait: z.boolean().optional().describe('Whether to use an existing portrait instead of creating a new one'),
    existingPortraitUrl: z.string().optional().describe('URL of existing portrait to use if useExistingPortrait is true'),
    props: z.array(z.object({
      propName: z.string(),
      description: z.string(),
      mustPresent: z.boolean().describe('Whether this prop must appear in every scene with this character'),
      size: z.string().describe('Relative size (small, medium, large)'),
      material: z.string().describe('Material/texture of the prop')
    })).optional().describe('Associated character props to create')
  })).max(3).describe('Up to 3 characters to create at once for feedback'),
  generatePortraits: z.boolean().describe('Whether to generate new portraits or use existing'),
  transparentBackground: z.boolean().default(true).describe('Whether to generate with transparent/white background for scene composition')
});

// Step 4: Batch Character Portrait and Props Creation Tool
export const createCharacterPortraits = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Step 4 of Enhanced Book Creation: Register existing character portraits OR create new ones in batches.
    
    🚨 **CRITICAL WORKFLOW**: This tool automatically searches memory for existing character portraits. 
    
    **DECISION FLOW**:
    1. Tool automatically finds existing portraits in memory/database
    2. **IF USER APPROVES existing portraits**: Set useExistingPortrait: true + existingPortraitUrl
    3. **IF USER wants new portraits**: Set useExistingPortrait: false + generatePortraits: true
    4. **IF mixed (some existing, some new)**: Use appropriate flags per character
    
    **WHEN TO USE EXISTING PORTRAITS**:
    ✅ User says "those portraits look good" / "use those" / "perfect"
    ✅ User explicitly approves existing character images
    ✅ Existing portraits match the character descriptions well
    ✅ User wants to save time and avoid recreating similar images
    
    **WHEN TO CREATE NEW PORTRAITS**:
    ❌ User says "create new ones" / "different style" / "not quite right"
    ❌ No existing portraits found for characters
    ❌ Existing portraits don't match character descriptions
    ❌ User specifically requests new character designs
    
    **PARAMETERS FOR EXISTING PORTRAITS**:
    - useExistingPortrait: true
    - existingPortraitUrl: "https://..." (from memory search results)
    - generatePortraits: false (skip image creation)
    
    **PARAMETERS FOR NEW PORTRAITS**:
    - useExistingPortrait: false  
    - generatePortraits: true (create new images)
    - seedImages: [] (optional reference images)
    
    Supports up to 3 characters at a time. Always requires user approval before proceeding to next step.`,
    inputSchema: batchCharacterCreationSchema,
    execute: async (input) => {
      const { bookId, characters, generatePortraits, transparentBackground } = input;
      
      dataStream.write?.({
        type: 'kind',
        content: 'batch_character_portraits',
      });

      dataStream.write?.({
        type: 'title',
        content: `Batch Character Creation (${characters.length} characters)`,
      });

      dataStream.write?.({
        type: 'id',
        content: `${bookId}_batch_characters_${Date.now()}`,
      });

      const results = [];
      
      for (const character of characters) {
        const { characterName, portraitStyle, baseOutfit, props, seedImages, useExistingPortrait, existingPortraitUrl } = character;
        let portraitUrl = '';
        let existingPortrait = false;
        
        // Handle existing portrait reuse (AI agent decision)
        if (useExistingPortrait && existingPortraitUrl) {
          portraitUrl = existingPortraitUrl;
          existingPortrait = true;
          console.log(`[createCharacterPortraits] Using AI agent-specified existing portrait for ${characterName}: ${portraitUrl.substring(0, 50)}...`);
        }
        // Search memory for existing character portrait only if not using AI agent-provided existing portrait
        else if (session?.user?.id) {
          try {
            const { createMemoryService } = await import('@/lib/ai/memory/service');
          const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
            const apiKey = process.env.PAPR_MEMORY_API_KEY;
            
            if (apiKey) {
              const memoryService = createMemoryService(apiKey);
              const paprUserId = await ensurePaprUser(session.user.id, apiKey);
              
              if (paprUserId) {
                console.log(`[createCharacterPortraits] Searching memory for character: ${characterName}`);
                
                // First: Search for existing character in THIS book
                let existingCharacters = await memoryService.searchMemories(
                  paprUserId, 
                  `character ${characterName} portrait ${bookId}`,
                  10
                );

                let existingCharacter = existingCharacters.find((mem: FormattedMemory) => 
                  mem.metadata?.kind === 'character' && 
                  mem.metadata?.character_name === characterName &&
                  mem.metadata?.book_id === bookId &&
                  mem.metadata?.portrait_url
                );

                // Second: If not found in this book, search across ALL books for this character
                if (!existingCharacter) {
                  console.log(`[createCharacterPortraits] Character ${characterName} not found in current book, searching across all books...`);
                  
                  const globalCharacters = await memoryService.searchMemories(
                    paprUserId, 
                    `character "${characterName}" portrait personality description`,
                    15
                  );

                  existingCharacter = globalCharacters.find((mem: FormattedMemory) => 
                    mem.metadata?.kind === 'character' && 
                    mem.metadata?.character_name === characterName &&
                    mem.metadata?.portrait_url
                  );
                  
                  if (existingCharacter) {
                    console.log(`[createCharacterPortraits] Found existing character ${characterName} from different book: ${existingCharacter.metadata?.book_title || 'Unknown'}`);
                  }
                }

                if (existingCharacter && existingCharacter.metadata?.portrait_url) {
                  portraitUrl = existingCharacter.metadata.portrait_url as string;
                  existingPortrait = true;
                  console.log(`[createCharacterPortraits] Using existing portrait for ${characterName}: ${portraitUrl.substring(0, 50)}...`);
                } else {
                  console.log(`[createCharacterPortraits] No existing portrait found for ${characterName}, will generate new one if requested`);
                }
              }
            }
          } catch (error) {
            console.error('[createCharacterPortraits] Error searching memory:', error);
          }
        }

        // Use AI agent-provided seed images (or empty array if none provided)
        let finalSeedImages: string[] = seedImages || [];
        console.log(`[createCharacterPortraits] Using AI agent-provided seed images for ${characterName}:`, finalSeedImages);

        // Generate new portrait if needed and requested
        if (!existingPortrait && generatePortraits) {
          try {
            const { createImage } = await import('./create-image');
            const imageTool = createImage({ session });

            // Get character description from memory
            const characterDescription = await getCharacterDescription(session, bookId, characterName);
            
            // Extract key physical features for seed image consistency
            const physicalFeatures = extractPhysicalFeatures(characterDescription, characterName);
            
            if (imageTool.execute) {
              const imageResult = await imageTool.execute({
              description: `CHILDREN'S BOOK CHARACTER PORTRAIT: ${characterName} - ${characterDescription}

🎯 CRITICAL PHYSICAL FEATURES TO MAINTAIN (especially when using seed images):
${physicalFeatures}

Art style: ${portraitStyle}. 

CRITICAL REQUIREMENTS:
1. CHARACTER wearing their BASE OUTFIT: ${baseOutfit} (this is their standard, consistent clothing worn throughout the book)
2. PURE WHITE BACKGROUND or TRANSPARENT BACKGROUND for easy scene composition
3. Full body or 3/4 body portrait showing the complete character
4. Character should be CENTERED and take up most of the frame
5. NO background elements, NO scenery, NO environment - just the character
6. Clean, sharp edges suitable for cutout composition into scenes
7. Character should be looking forward or at a slight angle
8. Consistent with children's book illustration style

This portrait will be used as a seed image for scene composition, so it must have a clean white/transparent background and show the character's complete base outfit clearly.`,
              sceneContext: `Character portrait for book illustration with white/transparent background, designed for scene composition and consistency across multiple scenes`,
              seedImages: finalSeedImages, // Use AI agent-provided seed images
              seedImageTypes: finalSeedImages.map(() => 'character'), // All seeds are character images
              styleConsistency: true,
              aspectRatio: '3:4',
              
              // Enhanced book context for style consistency
              styleBible: portraitStyle,
              bookGenre: 'children\'s book',
              targetAge: 'children'
            }, { toolCallId: 'book-character-' + Date.now(), messages: [] } as ToolCallOptions) as CreateImageOutput;

              if (imageResult.imageUrl) {
                portraitUrl = imageResult.imageUrl;
              }
            }
          } catch (error) {
            console.error('[createCharacterPortraits] Error generating portrait:', error);
          }
        }

        // Save character with portrait to memory
        if (session?.user?.id && portraitUrl) {
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
                  `Character: ${characterName}\nPortrait: ${portraitUrl}\nBase Outfit: ${baseOutfit}\nStyle: ${portraitStyle}\nTransparent Background: ${transparentBackground}`,
                  'document',
                  {
                    kind: 'character',
                    book_id: bookId,
                    character_name: characterName,
                    portrait_url: portraitUrl,
                    portrait_style: portraitStyle,
                    base_outfit: baseOutfit,
                    transparent_background: transparentBackground,
                    step: 'character_creation',
                    status: 'pending_approval'
                  },
                  session.user.id
                );

                // Save props if provided
                if (props && props.length > 0) {
                  for (const prop of props) {
                    await memoryService.storeContent(
                      paprUserId,
                      `Prop: ${prop.propName}\nDescription: ${prop.description}\nMaterial: ${prop.material}\nSize: ${prop.size}\nMust Present: ${prop.mustPresent}`,
                      'text',
                      {
                        kind: 'prop',
                        book_id: bookId,
                        character_name: characterName,
                        prop_name: prop.propName,
                        must_present: prop.mustPresent,
                        size: prop.size,
                        material: prop.material,
                        step: 'character_creation',
                        status: 'pending_approval'
                      },
                      session.user.id
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error('[createCharacterPortraits] Error saving to memory:', error);
          }
        }

        results.push({
          characterName,
          portraitUrl,
          existingPortrait,
          propsCreated: props?.length || 0,
          seedImages: finalSeedImages // Include the AI agent-provided seed images that were used
        });
      }

      // CRITICAL: Update the workflow state with character portraits
      try {
        console.log(`[createCharacterPortraits] Updating workflow state with ${results.length} character portraits`);
        
        // Get current workflow state
        const { getWorkflowFromDatabase } = await import('./unified-book-creation');
        const workflowState = await getWorkflowFromDatabase(bookId, session);
        
        if (workflowState) {
          // Find character step (step 2)
          const characterStepIndex = workflowState.steps.findIndex(s => s.stepNumber === 2);
          
          if (characterStepIndex !== -1) {
            // Get existing characters or initialize empty array
            const existingCharacters = workflowState.steps[characterStepIndex].data?.characters || [];
            
            // Map results to character objects with both portraitUrl AND imageUrl fields
            const newCharacters = results.map(result => {
              // Find the original character data
              const originalChar = characters.find(c => c.characterName === result.characterName);
              
              return {
                name: result.characterName,
                portraitUrl: result.portraitUrl, // Primary field
                imageUrl: result.portraitUrl,    // Duplicate for compatibility
                role: originalChar?.baseOutfit ? `Character with ${originalChar.baseOutfit}` : 'character',
                physicalDescription: originalChar?.portraitStyle || '',
                existingPortrait: result.existingPortrait
              };
            });
            
            // Merge with existing characters, replacing any with same name
            const mergedCharacters = [
              ...existingCharacters.filter((ec: any) => !newCharacters.some(nc => nc.name === ec.name)),
              ...newCharacters
            ];
            
            // Update workflow state
            workflowState.steps[characterStepIndex].data = {
              ...workflowState.steps[characterStepIndex].data,
              characters: mergedCharacters
            };
            
            // Mark step as completed if not already
            if (workflowState.steps[characterStepIndex].status === 'in_progress') {
              workflowState.steps[characterStepIndex].status = 'completed';
            }
            
            // Use createBookArtifact tool to update the workflow state
            // This is the proper way to update workflow state instead of direct DB access
            const { createBookArtifact } = await import('./unified-book-creation');
            
            // Create a tool instance
            const bookArtifactTool = createBookArtifact({ session, dataStream });
            
            // Call the tool to update the workflow state
            if (bookArtifactTool.execute) {
              await bookArtifactTool.execute({
                action: 'update_step',
                bookId: workflowState.bookId,
                stepNumber: 2,
                stepData: {
                  characters: mergedCharacters
                }
              }, { 
                toolCallId: `update-characters-${Date.now()}`,
                messages: [] 
              });
            }
            
            console.log(`[createCharacterPortraits] ✅ Successfully updated workflow state with ${mergedCharacters.length} characters`);
          }
        }
      } catch (error) {
        console.error(`[createCharacterPortraits] Error updating workflow state:`, error);
        // Continue with normal return even if workflow update fails
      }
      
      return {
        success: true,
        bookId,
        charactersProcessed: results.length,
        results,
        nextStep: `Approval Gate 4: Please review and approve the ${results.length} character portraits and props. If approved, you can create more characters (up to 3 at a time) or proceed to environment creation.`,
        approvalRequired: true,
        canCreateMoreCharacters: true,
        maxBatchSize: 3
      };
    },
  });

// Helper function to extract key physical features from character description for seed image consistency
function extractPhysicalFeatures(characterDescription: string, characterName: string): string {
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

// Helper function to get character description from memory (searches across all books)
async function getCharacterDescription(session: Session, bookId: string, characterName: string): Promise<string> {
  try {
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (!apiKey || !session?.user?.id) return '';
    
    const memoryService = createMemoryService(apiKey);
    const paprUserId = await ensurePaprUser(session.user.id, apiKey);
    
    if (!paprUserId) return '';
    
    console.log(`[getCharacterDescription] Searching for character: ${characterName}`);
    
    // First: Search in current book
    let memories = await memoryService.searchMemories(
      paprUserId,
      `character ${characterName} personality physical description ${bookId}`,
      5
    );

    let characterMemory = memories.find((mem: FormattedMemory) => 
      mem.metadata?.kind === 'character' && 
      mem.metadata?.character_name === characterName &&
      mem.metadata?.book_id === bookId
    );

    // Second: If not found in current book, search globally
    if (!characterMemory) {
      console.log(`[getCharacterDescription] Character ${characterName} not found in current book, searching globally...`);
      
      const globalMemories = await memoryService.searchMemories(
        paprUserId,
        `character "${characterName}" personality physical description`,
        10
      );

      characterMemory = globalMemories.find((mem: FormattedMemory) => 
        mem.metadata?.kind === 'character' && 
        mem.metadata?.character_name === characterName
      );
      
      if (characterMemory) {
        console.log(`[getCharacterDescription] Found character ${characterName} from different book: ${characterMemory.metadata?.book_title || 'Unknown'}`);
      }
    }

    if (characterMemory?.content) {
      console.log(`[getCharacterDescription] Using existing description for ${characterName}`);
      return characterMemory.content;
    } else {
      console.log(`[getCharacterDescription] No existing description found for ${characterName}`);
      return `${characterName} from the book`;
    }
  } catch (error) {
    console.error('[getCharacterDescription] Error:', error);
    return `${characterName} from the book`;
  }
}

export type BookPlanInput = z.infer<typeof bookPlanningSchema>;
export type ChapterDraftInput = z.infer<typeof chapterDraftSchema>;
export type SceneSegmentationInput = z.infer<typeof sceneSegmentationSchema>;
export type BatchCharacterCreationInput = z.infer<typeof batchCharacterCreationSchema>;
export type CharacterPortraitInput = z.infer<typeof characterPortraitSchema>;

// Async database storage function for characters and props
async function saveCharactersToDatabase(
  userId: string, 
  bookId: string, 
  bookTitle: string, 
  characters: any[]
): Promise<void> {
  try {
    console.log('[saveCharactersToDatabase] Saving characters to database...');
    
    // Import database utilities
    const { db } = await import('@/lib/db/db');
    const { sql } = await import('drizzle-orm');
    
    // Check if we have a book_props table or similar
    // For now, we'll store in a generic way that can be expanded
    for (const character of characters) {
      try {
        // Check if character already exists to avoid duplicates
        const existingChar = await db.execute(
          sql`SELECT id FROM book_props 
              WHERE user_id = ${userId} 
              AND book_id = ${bookId} 
              AND prop_type = 'character' 
              AND prop_name = ${character.name}
              LIMIT 1`
        );

        if (existingChar.length === 0) {
          // Insert new character
          await db.execute(
            sql`INSERT INTO book_props (
              user_id, book_id, book_title, prop_type, prop_name, 
              prop_data, created_at, updated_at
            ) VALUES (
              ${userId}, ${bookId}, ${bookTitle}, 'character', ${character.name},
              ${JSON.stringify({
                role: character.role,
                personality: character.personality,
                physicalDescription: character.physicalDescription,
                backstory: character.backstory
              })}, 
              NOW(), NOW()
            )`
          );
          
          console.log(`[saveCharactersToDatabase] ✅ Saved character: ${character.name}`);
        } else {
          console.log(`[saveCharactersToDatabase] Character ${character.name} already exists, skipping`);
        }
      } catch (charError) {
        console.error(`[saveCharactersToDatabase] Error saving character ${character.name}:`, charError);
      }
    }
    
    console.log('[saveCharactersToDatabase] ✅ Completed database storage');
  } catch (error) {
    console.error('[saveCharactersToDatabase] Database storage failed:', error);
    // Don't throw - this is a background operation
  }
}
export type EnvironmentCreationInput = z.infer<typeof environmentCreationSchema>;
export type SceneCompositionInput = z.infer<typeof sceneCompositionSchema>;
