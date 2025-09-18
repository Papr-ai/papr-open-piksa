import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import { generateUUID } from '@/lib/utils';
import type { BookCreationStep, BookArtifactState } from './book-creation-constants';
import { 
  BOOK_CREATION_STEPS, 
  StepDataSchema,
  ChapterWritingDataSchema,
  StoryPlanningDataSchema,
  CharacterCreationDataSchema,
  EnvironmentDesignDataSchema,
  SceneCompositionDataSchema,
  FinalReviewDataSchema
} from './book-creation-constants';

// Unified Book Creation Artifact Schema
const unifiedBookCreationSchema = z.object({
  action: z.enum([
    'initialize',     // Create new book artifact
    'update_step',    // Update a specific step with new content
    'approve_step',   // User approval from artifact UI
    'regenerate',     // Regenerate content for current step
    'finalize'        // Complete the book creation process
  ]).describe('Action to perform in the book creation workflow'),
  
  bookId: z.string().optional().describe('Book ID for existing book workflow'),
  
  // Initial book setup (for initialize action)
  bookTitle: z.string().optional().describe('Title of the book'),
  bookConcept: z.string().optional().describe('High-level book concept and story idea'),
  targetAge: z.string().optional().describe('Target age group'),
  isPictureBook: z.boolean().optional().describe('Whether this is a picture book (true) or chapter book (false). Use this to override auto-detection from content.'),
  
  // Step-specific data (for update_step action)
  stepNumber: z.number().optional().describe('Step number to update (1-6)'),
  stepData: StepDataSchema.optional().describe('Data for the specific step - must match the step-specific Zod schema'),
  
  // Memory search acknowledgment (for update_step action)
  searchedMemory: z.boolean().optional().describe('IMPORTANT: Did you search the user\'s memory before updating this step? Set to true if you used searchMemories tool to find relevant context about the book, characters, plot, or user preferences. Set to false if you did not search memory. RECOMMENDED: Always search memory first to maintain consistency with previous work and user preferences.'),
  
  // Book context for step processing
  currentBookTitle: z.string().optional().describe('Current book title for context'),
  
  // User feedback (for approve_step action)
  approved: z.boolean().optional().describe('Whether the user approved the current step'),
  feedback: z.string().optional().describe('User feedback for improvements'),
  
  // Context preservation
  conversationContext: z.string().optional().describe('Full context from the conversation to maintain consistency'),
  
  // Common AI agent additional fields (these will be ignored but won't cause validation errors)
  stepName: z.string().optional().describe('Step name (ignored, for AI agent compatibility)'),
  status: z.string().optional().describe('Status (ignored, for AI agent compatibility)')
}).passthrough(); // Allow additional properties to avoid validation errors

type UnifiedBookCreationInput = z.infer<typeof unifiedBookCreationSchema>;

/**
 * Smart merge function that preserves existing step data and only updates provided fields
 * This prevents AI agents from accidentally removing existing content when updating partial data
 */
function smartMergeStepData(existingData: any, newData: any, stepNumber: number): any {
  console.log(`[smartMergeStepData] Step ${stepNumber} starting merge:`, {
    hasExisting: !!existingData,
    hasNew: !!newData,
    existingType: typeof existingData,
    newType: typeof newData
  });
  
  if (!existingData || typeof existingData !== 'object') {
    console.log(`[smartMergeStepData] Step ${stepNumber}: No valid existing data, returning new data`);
    return newData || {};
  }
  
  if (!newData || typeof newData !== 'object') {
    console.log(`[smartMergeStepData] Step ${stepNumber}: No valid new data, returning existing data`);
    return existingData;
  }
  
  console.log(`[smartMergeStepData] Step ${stepNumber} merge details:`, {
    existingKeys: Object.keys(existingData),
    newKeys: Object.keys(newData)
  });
  
  // For arrays, we need special handling to merge intelligently
  const mergedData = { ...existingData };
  
  for (const [key, value] of Object.entries(newData)) {
    if (value === null || value === undefined) {
      // Skip null/undefined values - don't overwrite existing data
      console.log(`[smartMergeStepData] Skipping null/undefined value for key: ${key}`);
      continue;
    }
    
    if (Array.isArray(value) && Array.isArray(existingData[key])) {
      // For arrays, merge by unique identifiers when possible
      if (key === 'characters') {
        // Merge characters by name
        mergedData[key] = mergeCharacterArrays(existingData[key], value);
      } else if (key === 'environments') {
        // Merge environments by name
        mergedData[key] = mergeEnvironmentArrays(existingData[key], value);
      } else if (key === 'chapters') {
        // Merge chapters by chapterNumber
        mergedData[key] = mergeChapterArrays(existingData[key], value);
      } else {
        // For other arrays, replace completely (safer default)
        mergedData[key] = value;
      }
    } else if (typeof value === 'object' && typeof existingData[key] === 'object') {
      // Recursively merge objects
      mergedData[key] = smartMergeStepData(existingData[key], value, stepNumber);
    } else if (typeof value === 'string' && value.trim() !== '') {
      // Only update strings if they're not empty
      mergedData[key] = value;
    } else if (typeof value !== 'string') {
      // Update non-string values directly
      mergedData[key] = value;
    }
    // Skip empty strings to preserve existing content
  }
  
  console.log(`[smartMergeStepData] Step ${stepNumber} merge complete:`, {
    mergedKeys: Object.keys(mergedData),
    resultSize: Object.keys(mergedData).length
  });
  
  return mergedData;
}

/**
 * Merge character arrays by name, preserving existing character data
 */
function mergeCharacterArrays(existing: any[], incoming: any[]): any[] {
  const merged = [...existing];
  
  for (const newChar of incoming) {
    if (!newChar?.name) continue;
    
    const existingIndex = merged.findIndex(char => char?.name === newChar.name);
    if (existingIndex >= 0) {
      // Update existing character with new data, preserving existing fields
      merged[existingIndex] = { ...merged[existingIndex], ...newChar };
      console.log(`[smartMergeStepData] Updated existing character: ${newChar.name}`);
    } else {
      // Add new character
      merged.push(newChar);
      console.log(`[smartMergeStepData] Added new character: ${newChar.name}`);
    }
  }
  
  return merged;
}

/**
 * Merge environment arrays by name, preserving existing environment data
 */
function mergeEnvironmentArrays(existing: any[], incoming: any[]): any[] {
  const merged = [...existing];
  
  for (const newEnv of incoming) {
    if (!newEnv?.name) continue;
    
    const existingIndex = merged.findIndex(env => env?.name === newEnv.name);
    if (existingIndex >= 0) {
      // Update existing environment with new data
      merged[existingIndex] = { ...merged[existingIndex], ...newEnv };
      console.log(`[smartMergeStepData] Updated existing environment: ${newEnv.name}`);
    } else {
      // Add new environment
      merged.push(newEnv);
      console.log(`[smartMergeStepData] Added new environment: ${newEnv.name}`);
    }
  }
  
  return merged;
}

/**
 * Merge chapter arrays by chapterNumber, preserving existing chapter data
 */
function mergeChapterArrays(existing: any[], incoming: any[]): any[] {
  const merged = [...existing];
  
  for (const newChapter of incoming) {
    if (newChapter?.chapterNumber === undefined) continue;
    
    const existingIndex = merged.findIndex(ch => ch?.chapterNumber === newChapter.chapterNumber);
    if (existingIndex >= 0) {
      // Update existing chapter with new data, preserving existing fields
      merged[existingIndex] = { ...merged[existingIndex], ...newChapter };
      console.log(`[smartMergeStepData] Updated existing chapter: ${newChapter.chapterNumber}`);
    } else {
      // Add new chapter
      merged.push(newChapter);
      console.log(`[smartMergeStepData] Added new chapter: ${newChapter.chapterNumber}`);
    }
  }
  
  return merged.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
}

// Generate example chapter data for documentation
const exampleChapter = {
  chapterNumber: 1,
  title: "Chapter Title", 
  scenes: [
    {
      sceneNumber: 1,
      title: "Scene Title",
      text: "## Hook\nMira discovers something mysterious...\n\n## Rising Action\nShe investigates and finds...\n\n## Dialogue\n> \"What could this mean?\" Mira wondered.\n\n## Climax\nThe mystery reveals itself!",
      characters: ["Mira", "Kip"],
      illustrationNotes: "Show Mira looking at the mysterious object with wonder"
    }
  ]
};

// Example input for update_step action with chapter data
const exampleUpdateStepInput = {
  action: "update_step",
  bookId: "book-id-from-context",
  stepNumber: 3,
  stepData: {
    chapters: [exampleChapter]
  }
};

export const createBookArtifact = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Unified Book Creation Tool - Creates a persistent artifact UI for step-by-step book creation.
    
    📖 **PICTURE BOOK vs CHAPTER BOOK SUPPORT**: This tool automatically adapts based on the user's choice:
    - Picture books: Focus on visual scenes with illustrations and shorter text - IMAGES ARE REQUIRED for characters, environments, and scenes
    - Chapter books: Focus on longer narrative content with detailed chapter development - Images are optional
    The book type is determined from the user's initial selection and stored in the workflow state.
    
    🎨 **PICTURE BOOK IMAGE REQUIREMENTS**:
    When isPictureBook is true, the AI MUST:
    - Step 2: Generate character portrait images and include imageUrl in character objects
    - Step 4: Generate environment images and include imageUrl in environment objects  
    - Step 5: Generate scene composition images and include imageUrl in scene objects
    Use the createSingleBookImage tool to generate these images before updating step data.
    
    This tool manages the entire book creation workflow in a single artifact interface with the following steps:
    
    1. Story Planning - High-level concept, themes, character outlines
    2. Character Creation - Character portraits using existing tools
    3. Chapter Writing - Chapters with scenes array (NOT beats array). Each scene has: text (markdown), characters, illustrationNotes
    4. Environment Design - Environment master plates
    5. Final Chapter Content - Complete chapters with fully written scenes (PRESERVE EXACT chapter titles from Step 3, expand scene content)
    6. Final Review - Complete book review and finalization
    
    🧠 MEMORY SEARCH REQUIREMENT:
    BEFORE updating any step, you should FIRST use the searchMemories tool to find:
    - Previous book content and character details
    - User preferences for writing style, themes, or art direction
    - Existing story elements to maintain consistency
    - Any specific requirements or feedback from the user
    
    Set searchedMemory: true if you searched memory, false if you skipped it.
    
    ACTIONS:
    - initialize: Create new book artifact with initial concept (INCLUDE isPictureBook parameter based on user's choice)
    - update_step: Update a specific step with validated structured content (SEARCH MEMORY FIRST!)
    - approve_step: User approves/rejects step from artifact UI
    - regenerate: Regenerate content for current step based on feedback (SEARCH MEMORY FIRST!)
    - finalize: Complete the book creation process
    
    ⚠️ IMPORTANT: When initializing a book, always include the isPictureBook parameter based on the user's choice from the book creation wizard. This ensures proper workflow behavior and image requirements.`,
    
    inputSchema: unifiedBookCreationSchema,
    
    execute: async (input: UnifiedBookCreationInput) => {
      const { action, bookId, bookTitle, bookConcept, targetAge, isPictureBook, stepNumber, stepData, searchedMemory, approved, feedback, conversationContext, currentBookTitle } = input;
      
      // Generate or use existing book ID
      const currentBookId = bookId || generateUUID();
      
      switch (action) {
        case 'initialize':
          // Create new book artifact with initial concept
          
          // First, check if an existing workflow exists for this book
          let existingWorkflow: BookArtifactState | null = null;
          try {
            existingWorkflow = await getWorkflowFromDatabase(currentBookId, session);
          } catch (error) {
            console.error('[createBookArtifact] Error checking for existing workflow:', error);
          }
          
          // If existing workflow found, return it instead of creating new
          if (existingWorkflow) {
            console.log('[createBookArtifact] ✅ Found existing workflow, returning saved state');
            return {
              success: true,
              bookId: existingWorkflow.bookId,
              nextAction: `Continue with Step ${existingWorkflow.currentStep}: ${BOOK_CREATION_STEPS.find(s => s.number === existingWorkflow.currentStep)?.name}`,
              message: `Resumed existing book creation workflow for "${existingWorkflow.bookTitle}". Currently on Step ${existingWorkflow.currentStep}.`,
              artifactState: existingWorkflow
            };
          }
          
          // Parse the story content to extract structured data
          const parseStoryContent = (content: string) => {
            const themes = [];
            const themePatterns = [
              /themes?:?\s*([^\n]+)/i,
              /topics?:?\s*([^\n]+)/i,
              /(adventure|family|friendship|learning|exploration|discovery)/gi
            ];
            
            for (const pattern of themePatterns) {
              const match = content.match(pattern);
              if (match) {
                if (match[1]) {
                  themes.push(...match[1].split(/[,;]/).map(t => t.trim()).filter(Boolean));
                } else if (match[0]) {
                  themes.push(match[0]);
                }
              }
            }
            
            const lines = content.split('\n').filter(line => line.trim());
            const premise = lines.find(line => !line.startsWith('#') && line.length > 50) || 
                           lines.slice(0, 3).join(' ').substring(0, 200) + '...';
            
            // Detect if this is a picture book - prefer system context over content analysis
            const isPictureBook = content.toLowerCase().includes('picture book') || 
                                 content.toLowerCase().includes('illustration') ||
                                 content.toLowerCase().includes('illustrated') ||
                                 (targetAge && (targetAge.includes('3-') || targetAge.includes('4-') || targetAge.includes('5-')));
            
            const styleGuide = content.includes('style') || content.includes('picture book') 
              ? 'Children\'s picture book style with vibrant illustrations'
              : 'Family-friendly storytelling style';
            
            return {
              premise: premise || 'Story concept to be developed',
              themes: [...new Set(themes)].slice(0, 5) || ['Adventure', 'Family'],
              styleGuide,
              isPictureBook,
              fullContent: content
            };
          };

          // Parse the book concept if provided
          const parsedContent = bookConcept ? parseStoryContent(bookConcept) : null;
          
          // Determine isPictureBook from parameter, parsed content, or auto-detection
          const determinedIsPictureBook: boolean | undefined = (() => {
            if (typeof isPictureBook === 'boolean') return isPictureBook;
            if (typeof parsedContent?.isPictureBook === 'boolean') return parsedContent.isPictureBook;
            return undefined;
          })();
          
          console.log('[createBookArtifact] 📖 Initialization isPictureBook detection:', {
            providedIsPictureBook: isPictureBook,
            hasParsedContent: !!parsedContent,
            parsedIsPictureBook: parsedContent?.isPictureBook,
            determinedIsPictureBook,
            bookConcept: bookConcept ? bookConcept.substring(0, 100) + '...' : 'No concept',
            targetAge
          });

          const initialState: BookArtifactState = {
            bookId: currentBookId,
            bookTitle: bookTitle || 'Untitled Book',
            bookConcept: bookConcept || '',
            targetAge: targetAge || '3-8 years',
            isPictureBook: determinedIsPictureBook,
            currentStep: 1,
            steps: BOOK_CREATION_STEPS.map(step => ({
              stepNumber: step.number,
              stepName: step.name,
              status: step.number === 1 ? 'in_progress' : 'pending',
              data: step.number === 1 && parsedContent ? {
                content: parsedContent.fullContent,
                premise: parsedContent.premise,
                themes: parsedContent.themes,
                styleBible: parsedContent.styleGuide,
                isPictureBook: determinedIsPictureBook
              } : undefined
            })),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Save initial workflow state to database
          try {
            await saveWorkflowToDatabase(initialState, session);
            console.log('[createBookArtifact] ✅ Initial workflow state saved to database');
          } catch (error) {
            console.error('[createBookArtifact] Error saving initial workflow:', error);
          }
          
          // Send initial artifact content to the artifact system
          console.log('[createBookArtifact] ✅ Initial state ready for tool result:', JSON.stringify(initialState, null, 2));
          
          // CRITICAL: Send the initial state to the artifact system using the original stream event type
          dataStream.write?.({
            type: 'book-creation-state',
            content: initialState
          });
          
          // Store book creation workflow in memory and task database
          try {
            // Store in memory for context
            const memoryContent = {
              type: 'book_workflow',
              bookId: currentBookId,
              bookTitle: bookTitle || 'Untitled Book',
              bookConcept: bookConcept || '',
              targetAge: targetAge || '3-8 years',
              steps: BOOK_CREATION_STEPS.map(step => ({
                stepNumber: step.number,
                stepName: step.name,
                status: step.number === 1 ? 'in_progress' : 'pending',
                description: step.description
              })),
              createdAt: new Date().toISOString(),
              currentStep: 1
            };
            
            // Store workflow in memory
            dataStream.write?.({
              type: 'add-memory',
              content: {
                content: `Book Creation Workflow: ${bookTitle}\n\n${JSON.stringify(memoryContent, null, 2)}`,
                category: 'book_workflow',
                metadata: {
                  bookId: currentBookId,
                  workflowType: 'book_creation',
                  currentStep: 1
                }
              }
            });
            
          } catch (error) {
            console.error('[createBookArtifact] Error storing workflow:', error);
          }
          
          return {
            success: true,
            action: 'initialize',
            bookId: currentBookId,
            artifactCreated: true,
            currentStep: 1,
            nextAction: 'Agent should now work on Step 1: Story Planning using existing book planning tools',
            message: `Book creation artifact initialized for "${bookTitle}". Starting with Step 1: Story Planning.`,
            artifactState: initialState // Include the state in the tool result
          };
          
        case 'update_step':
          // Agent updates a specific step with generated content
          if (!stepNumber || !stepData) {
            return {
              success: false,
              error: 'stepNumber and stepData are required for update_step action'
            };
          }
          
          // Log memory search acknowledgment
          if (searchedMemory === true) {
            console.log(`[createBookArtifact] ✅ AI agent searched memory before updating Step ${stepNumber}`);
          } else if (searchedMemory === false) {
            console.log(`[createBookArtifact] ⚠️ AI agent did NOT search memory before updating Step ${stepNumber} - consistency may be affected`);
          } else {
            console.log(`[createBookArtifact] ❓ AI agent did not specify whether memory was searched for Step ${stepNumber}`);
          }

          // Use stepData as-is - trust the AI SDK and Zod schemas completely
          let validatedStepData = stepData;
          
          // Enhanced spatial processing for environment and scene steps
          if (stepNumber === 4 && validatedStepData.environments) {
            console.log('[createBookArtifact] 🗺️ Enhancing environments with spatial data');
            validatedStepData = await enhanceEnvironmentsWithSpatialData(validatedStepData, currentBookId, session);
          } else if (stepNumber === 5 && validatedStepData.chapters) {
            console.log('[createBookArtifact] 🎯 Enhancing scenes with prescriptive positioning');
            validatedStepData = await enhanceScenesWithPrescriptivePositioning(validatedStepData, currentBookId, session);
          }
          
          // Extract isPictureBook flag from Step 1 data to update artifact state
          let isPictureBookFlag: boolean | undefined = undefined;
          if (stepNumber === 1 && typeof validatedStepData.isPictureBook === 'boolean') {
            isPictureBookFlag = validatedStepData.isPictureBook;
            console.log('[createBookArtifact] 📖 Picture book flag detected:', isPictureBookFlag);
          }
          
          // Step 5 now uses the same chapters structure as Step 3 - no special validation needed
          
          console.log(`[createBookArtifact] ✅ Step ${stepNumber} data accepted directly from AI SDK`);
          
          if (stepNumber < 1 || stepNumber > 6) {
            return {
              success: false,
              error: `Invalid step number: ${stepNumber}. Must be 1-6.`
            };
          }
          
          // First, retrieve existing workflow state from database to preserve previous step data
          let existingWorkflowState: BookArtifactState | null = null;
          try {
            existingWorkflowState = await getWorkflowFromDatabase(currentBookId, session);
            console.log('[createBookArtifact] 🔍 Retrieved existing workflow state:', existingWorkflowState ? 'Found' : 'Not found');
            if (existingWorkflowState) {
              console.log('[createBookArtifact] 🔍 Existing steps with data:', existingWorkflowState.steps.map(s => ({ 
                stepNumber: s.stepNumber, 
                status: s.status, 
                hasData: !!s.data,
                dataKeys: s.data ? Object.keys(s.data) : []
              })));
              
              // Specifically check Step 1 data
              const step1 = existingWorkflowState.steps.find(s => s.stepNumber === 1);
              if (step1?.data) {
                console.log('[createBookArtifact] 📋 Step 1 existing data details:', {
                  keys: Object.keys(step1.data),
                  premise: step1.data.premise ? String(step1.data.premise).substring(0, 100) + '...' : 'No premise',
                  themes: step1.data.themes || 'No themes',
                  content: step1.data.content ? String(step1.data.content).substring(0, 100) + '...' : 'No content'
                });
              }
            }
          } catch (error) {
            console.error('[createBookArtifact] Error retrieving existing workflow:', error);
          }
          
          // Get current isPictureBook state from existing workflow or detected flag
          const currentIsPictureBook = isPictureBookFlag ?? existingWorkflowState?.isPictureBook;
          console.log('[createBookArtifact] 📖 Current isPictureBook state:', currentIsPictureBook);
          
          // Validate picture book image requirements
          if (currentIsPictureBook === true) {
            const imageValidation = validatePictureBookImageRequirements(stepNumber, validatedStepData);
            if (!imageValidation.isValid) {
              return {
                success: false,
                error: `Picture book image requirements not met for Step ${stepNumber}: ${imageValidation.errors.join(', ')}`,
                requiredImages: imageValidation.requiredImages,
                message: `This is a picture book. Please use the createSingleBookImage tool to generate the required images first, then update the step data with the imageUrl fields.`
              };
            }
          }
          
          // Process the validated step data based on step number
          let processedStepData = validatedStepData;
          
          // For step 2 (Character Creation), enrich character data with images from memory/database
          if (stepNumber === 2 && validatedStepData.characters && session?.user?.id) {
            try {
              processedStepData = await enrichCharacterDataWithImages(validatedStepData, currentBookId, session);
            } catch (error) {
              console.error('[createBookArtifact] Error enriching character data:', error);
              // Continue with validated data if enrichment fails
            }
          }
          
          // For step 4 (Environment Design), enrich environment data with images from memory/database
          if (stepNumber === 4 && validatedStepData.environments && session?.user?.id) {
            try {
              processedStepData = await enrichEnvironmentDataWithImages(validatedStepData, currentBookId, session);
            } catch (error) {
              console.error('[createBookArtifact] Error enriching environment data:', error);
              // Continue with original data if enrichment fails
            }
          }
          
          // Preserve existing step data and only update the current step
          const preservedSteps = existingWorkflowState?.steps || BOOK_CREATION_STEPS.map(step => ({
            stepNumber: step.number,
            stepName: step.name,
            status: 'pending' as const,
            data: undefined
          }));
          
          console.log('[createBookArtifact] 🔍 Preserved steps before update:', preservedSteps.map(s => ({ 
            stepNumber: s.stepNumber, 
            status: s.status, 
            hasData: !!s.data,
            dataKeys: s.data ? Object.keys(s.data) : []
          })));
          
          // Specifically check if Step 1 data is preserved
          const preservedStep1 = preservedSteps.find(s => s.stepNumber === 1);
          if (preservedStep1?.data) {
            console.log('[createBookArtifact] 📋 Preserved Step 1 data details:', {
              keys: Object.keys(preservedStep1.data),
              premise: preservedStep1.data.premise ? String(preservedStep1.data.premise).substring(0, 100) + '...' : 'No premise'
            });
          } else {
            console.log('[createBookArtifact] ⚠️ No Step 1 data found in preserved steps!');
          }
          
          // Update only the current step while preserving others
          const updatedSteps = preservedSteps.map(step => {
            if (step.stepNumber === stepNumber) {
              // Smart merge: preserve existing data and only update provided fields
              const existingStepData = step.data || {};
              const mergedStepData = smartMergeStepData(existingStepData, processedStepData, stepNumber);
              
              console.log(`[createBookArtifact] 🔄 Smart merge for Step ${stepNumber}:`, {
                existingKeys: Object.keys(existingStepData),
                newKeys: Object.keys(processedStepData || {}),
                mergedKeys: Object.keys(mergedStepData)
              });
              
              // Additional debugging for Step 1 specifically
              if (stepNumber === 1) {
                console.log('[createBookArtifact] 📋 Step 1 smart merge details:', {
                  existingPremise: existingStepData?.premise ? String(existingStepData.premise).substring(0, 100) + '...' : 'No existing premise',
                  newPremise: processedStepData?.premise ? String(processedStepData.premise).substring(0, 100) + '...' : 'No new premise',
                  mergedPremise: mergedStepData?.premise ? String(mergedStepData.premise).substring(0, 100) + '...' : 'No merged premise'
                });
              }
              
              return {
                ...step,
                status: 'completed' as const,
                data: mergedStepData
              };
            } else if (step.stepNumber < stepNumber) {
              // Keep previous steps as approved with their existing data
              console.log(`[createBookArtifact] 📋 Preserving Step ${step.stepNumber} as approved:`, {
                hasData: !!step.data,
                dataKeys: step.data ? Object.keys(step.data) : []
              });
              return {
                ...step,
                status: 'approved' as const
              };
            } else {
              // Keep future steps as pending
              return {
                ...step,
                status: 'pending' as const
              };
            }
          });
          
          console.log('[createBookArtifact] 🔍 Updated steps after processing:', updatedSteps.map(s => ({ 
            stepNumber: s.stepNumber, 
            status: s.status, 
            hasData: !!s.data,
            dataKeys: s.data ? Object.keys(s.data) : []
          })));
          
          // Final check on Step 1 data before saving
          const finalStep1 = updatedSteps.find(s => s.stepNumber === 1);
          if (finalStep1?.data) {
            console.log('[createBookArtifact] 📋 Final Step 1 data before save:', {
              keys: Object.keys(finalStep1.data),
              premise: finalStep1.data.premise ? String(finalStep1.data.premise).substring(0, 100) + '...' : 'No premise'
            });
          } else {
            console.log('[createBookArtifact] ❌ Step 1 data LOST! No data in final steps.');
          }
          
          // Auto-finalize when Step 5 is completed
          if (stepNumber === 5) {
            console.log('[createBookArtifact] 🎯 Step 5 completed, auto-finalizing Step 6...');
            
            // Create Step 6 final review data
            const step6Data = {
              status: 'completed',
              bookTitle: existingWorkflowState?.bookTitle || 'Book Creation',
              totalSteps: 6,
              completedSteps: 6,
              bookSummary: `${existingWorkflowState?.bookTitle || 'Book Creation'} - A ${targetAge || existingWorkflowState?.targetAge || '3-8 years'} children's book`,
              bookConcept: bookConcept || existingWorkflowState?.bookConcept || '',
              
              // Count assets from previous steps with safe property access
              totalCharacters: (() => {
                const step2Data = updatedSteps.find(s => s.stepNumber === 2)?.data;
                return (step2Data && typeof step2Data === 'object' && 'characters' in step2Data && Array.isArray(step2Data.characters)) ? step2Data.characters.length : 0;
              })(),
              totalEnvironments: (() => {
                const step4Data = updatedSteps.find(s => s.stepNumber === 4)?.data;
                return (step4Data && typeof step4Data === 'object' && 'environments' in step4Data && Array.isArray(step4Data.environments)) ? step4Data.environments.length : 0;
              })(),
              totalScenes: (() => {
                const step5Data = updatedSteps.find(s => s.stepNumber === 5)?.data;
                if (step5Data && typeof step5Data === 'object') {
                  if ('scenes' in step5Data && Array.isArray(step5Data.scenes)) return step5Data.scenes.length;
                  if ('scenesToCompose' in step5Data && Array.isArray(step5Data.scenesToCompose)) return step5Data.scenesToCompose.length;
                }
                return 0;
              })(),
              
              // Calculate total pages (estimate based on scenes)
              totalPages: (() => {
                const step5Data = updatedSteps.find(s => s.stepNumber === 5)?.data;
                let sceneCount = 6; // default
                if (step5Data && typeof step5Data === 'object') {
                  if ('scenes' in step5Data && Array.isArray(step5Data.scenes)) sceneCount = step5Data.scenes.length;
                  else if ('scenesToCompose' in step5Data && Array.isArray(step5Data.scenesToCompose)) sceneCount = step5Data.scenesToCompose.length;
                }
                return Math.max(12, sceneCount * 2);
              })(),
              
              finalizedAt: new Date().toISOString()
            };
            
            // Update Step 6 to completed
            updatedSteps.forEach(step => {
              if (step.stepNumber === 6) {
                step.status = 'completed' as const;
                step.data = step6Data;
              }
            });
            
            console.log('[createBookArtifact] 🎉 Step 6 auto-finalized with completion data');
          }
          
          // Send artifact content update using text-delta (which we know works)
          const stepUpdate = {
            currentStep: stepNumber,
            steps: [{
              stepNumber,
              status: 'completed',
              data: processedStepData
            }],
            updatedAt: new Date().toISOString()
          };
          
          // Update the artifact content directly with preserved step data
          // Extract actual book title from step data if available (e.g., from Step 1 or Step 3)
          let actualBookTitle = currentBookTitle || bookTitle || existingWorkflowState?.bookTitle;
          
          console.log('[createBookArtifact] 🔍 Title extraction debug:', {
            currentBookTitle,
            bookTitle,
            existingTitle: existingWorkflowState?.bookTitle,
            stepNumber,
            stepDataKeys: stepData ? Object.keys(stepData) : 'no stepData'
          });
          
          // Try to extract book title from current step data with safe property access
          if (stepNumber === 1 && stepData && typeof stepData === 'object' && 'titleOptions' in stepData && Array.isArray(stepData.titleOptions) && stepData.titleOptions.length > 0) {
            // Use first title option from Story Planning step
            actualBookTitle = stepData.titleOptions[0];
            console.log('[createBookArtifact] ✅ Found title in Step 1 titleOptions:', actualBookTitle);
          } else if (stepNumber === 3 && stepData && typeof stepData === 'object' && 'conversationContext' in stepData && typeof stepData.conversationContext === 'string') {
            // Extract from conversation context in Chapter Writing step
            const titleMatch = stepData.conversationContext.match(/Book Title:\s*([^.]+)/);
            if (titleMatch) {
              actualBookTitle = titleMatch[1].trim();
              console.log('[createBookArtifact] ✅ Found title in Step 3 conversationContext:', actualBookTitle);
            }
          }
          
          // Enhanced fallback: Check all steps for title information
          if (!actualBookTitle || actualBookTitle === 'Book Creation' || actualBookTitle === 'Untitled Book') {
            console.log('[createBookArtifact] 🔍 Searching all steps for title...');
            
            // Check existing workflow state first with safe property access
            if (existingWorkflowState?.steps) {
              for (const step of existingWorkflowState.steps) {
                const stepData = step.data;
                if (stepData && typeof stepData === 'object') {
                  if ('titleOptions' in stepData && Array.isArray(stepData.titleOptions) && stepData.titleOptions.length > 0) {
                    actualBookTitle = stepData.titleOptions[0];
                    console.log('[createBookArtifact] ✅ Found title in existing step titleOptions:', actualBookTitle);
                    break;
                  }
                  if ('conversationContext' in stepData && typeof stepData.conversationContext === 'string') {
                    const titleMatch = stepData.conversationContext.match(/Book Title:\s*([^.\n]+)/);
                    if (titleMatch) {
                      actualBookTitle = titleMatch[1].trim();
                      console.log('[createBookArtifact] ✅ Found title in existing step conversationContext:', actualBookTitle);
                      break;
                    }
                  }
                  // Check for title in step data directly
                  if ('bookTitle' in stepData && typeof stepData.bookTitle === 'string') {
                    actualBookTitle = stepData.bookTitle;
                    console.log('[createBookArtifact] ✅ Found title in existing step data.bookTitle:', actualBookTitle);
                    break;
                  }
                }
              }
            }
            
            // Check updated steps with safe property access
            for (const step of updatedSteps) {
              const stepData = step.data;
              if (stepData && typeof stepData === 'object') {
                if ('titleOptions' in stepData && Array.isArray(stepData.titleOptions) && stepData.titleOptions.length > 0) {
                  actualBookTitle = stepData.titleOptions[0];
                  console.log('[createBookArtifact] ✅ Found title in updated step titleOptions:', actualBookTitle);
                  break;
                }
                if ('conversationContext' in stepData && typeof stepData.conversationContext === 'string') {
                  const titleMatch = stepData.conversationContext.match(/Book Title:\s*([^.\n]+)/);
                  if (titleMatch) {
                    actualBookTitle = titleMatch[1].trim();
                    console.log('[createBookArtifact] ✅ Found title in updated step conversationContext:', actualBookTitle);
                    break;
                  }
                }
                if ('bookTitle' in stepData && typeof stepData.bookTitle === 'string') {
                  actualBookTitle = stepData.bookTitle;
                  console.log('[createBookArtifact] ✅ Found title in updated step data.bookTitle:', actualBookTitle);
                  break;
                }
              }
            }
          }
          
          // Use typed data from Step 1 for book title (no manual parsing needed)
          if (stepNumber === 1 && processedStepData && typeof processedStepData === 'object' && 'bookTitle' in processedStepData && typeof processedStepData.bookTitle === 'string') {
            actualBookTitle = processedStepData.bookTitle;
            console.log('[createBookArtifact] ✅ Found book title in Step 1 typed data:', actualBookTitle);
          }
          
          console.log('[createBookArtifact] 🎯 Final book title:', actualBookTitle);

          const updatedArtifactState: BookArtifactState = {
            bookId: currentBookId,
            bookTitle: actualBookTitle || 'Book Creation',
            bookConcept: bookConcept || existingWorkflowState?.bookConcept || '',
            targetAge: targetAge || existingWorkflowState?.targetAge || '3-8 years',
            isPictureBook: isPictureBookFlag ?? existingWorkflowState?.isPictureBook,
            currentStep: stepNumber === 5 ? 6 : stepNumber, // Auto-advance to Step 6 when Step 5 is completed
            steps: updatedSteps,
            createdAt: existingWorkflowState?.createdAt || new Date(),
            updatedAt: new Date()
          };
          
          // Save updated workflow state to database
          try {
            await saveWorkflowToDatabase(updatedArtifactState, session);
            console.log('[createBookArtifact] ✅ Workflow state saved to database');
          } catch (error) {
            console.error('[createBookArtifact] Error saving workflow to database:', error);
          }
          
          // Update artifact content using multiple stream types for compatibility
          console.log('[createBookArtifact] ✅ Updated state ready for tool result:', JSON.stringify(updatedArtifactState, null, 2));
          
          // CRITICAL: Send the updated state to the artifact system using the original stream event type
          dataStream.write?.({
            type: 'book-creation-state',
            content: updatedArtifactState
          });
          
          // Update workflow progress in memory
          try {
            const stepName = BOOK_CREATION_STEPS.find(s => s.number === stepNumber)?.name || `Step ${stepNumber}`;
            dataStream.write?.({
              type: 'add-memory',
              content: {
                content: `Book Creation Progress: ${stepName} completed for book ${currentBookId}\n\nStep Data:\n${JSON.stringify(processedStepData, null, 2)}`,
                category: 'book_workflow_progress',
                metadata: {
                  bookId: currentBookId,
                  stepNumber,
                  stepName,
                  status: 'completed',
                  completedAt: new Date().toISOString()
                }
              }
            });
          } catch (error) {
            console.error('[createBookArtifact] Error storing step progress:', error);
          }
          
          // Prepare response message with memory search feedback
          let responseMessage = `Step ${stepNumber} updated and ready for user approval in the artifact.`;
          if (searchedMemory === false) {
            responseMessage += `\n\n💡 Tip: Consider using searchMemories tool before future updates to maintain consistency with previous work and user preferences.`;
          } else if (searchedMemory === true) {
            responseMessage += `\n\n✅ Great! You searched memory before updating, which helps maintain consistency.`;
          }
          
          return {
            success: true,
            action: 'update_step',
            bookId: currentBookId,
            stepNumber,
            stepUpdated: true,
            awaitingUserApproval: true,
            searchedMemory: searchedMemory,
            message: responseMessage,
            artifactState: updatedArtifactState // Include the updated state in the tool result
          };
          
        case 'approve_step':
          // Handle user approval from artifact UI
          console.log('[createBookArtifact] 🔍 APPROVE_STEP called with:', { approved, stepNumber, feedback });
          console.log('[createBookArtifact] 🔍 This should only happen from user interaction in artifact UI');
          
          if (approved) {
            const nextStep = (stepNumber || 1) + 1;
            
            // Send artifact update to show step approval and progression
            dataStream.write?.({
              type: 'text-delta',
              content: JSON.stringify({
                currentStep: nextStep <= 6 ? nextStep : stepNumber,
                steps: [{
                  stepNumber: stepNumber || 1,
                  status: 'approved'
                }],
                updatedAt: new Date().toISOString()
              })
            });
            
            return {
              success: true,
              action: 'approve_step',
              bookId: currentBookId,
              stepApproved: true,
              currentStep: nextStep <= 6 ? nextStep : stepNumber,
              nextAction: nextStep <= 6 ? 
                `Agent should now work on Step ${nextStep}: ${BOOK_CREATION_STEPS[nextStep - 1]?.name}` :
                'All steps completed. Ready for final review.',
              message: nextStep <= 6 ? 
                `Step ${stepNumber} approved. Moving to Step ${nextStep}.` :
                'All steps completed! Book creation finished.'
            };
          } else {
            // User requested changes
            // Send artifact update to show step needs revision
            dataStream.write?.({
              type: 'text-delta',
              content: JSON.stringify({
                steps: [{
                  stepNumber: stepNumber || 1,
                  status: 'needs_revision',
                  feedback: feedback || 'User requested changes'
                }],
                updatedAt: new Date().toISOString()
              })
            });
            
            return {
              success: true,
              action: 'approve_step',
              bookId: currentBookId,
              stepApproved: false,
              needsRevision: true,
              userFeedback: feedback,
              nextAction: `Agent should revise Step ${stepNumber} based on user feedback`,
              message: `Step ${stepNumber} needs revision. User feedback: ${feedback || 'No specific feedback provided'}`
            };
          }
          
        case 'regenerate':
          // Regenerate content for current step
          // Send artifact update to show step is regenerating
          dataStream.write?.({
            type: 'text-delta',
            content: JSON.stringify({
              steps: [{
                stepNumber: stepNumber || 1,
                status: 'in_progress'
              }],
              updatedAt: new Date().toISOString()
            })
          });
          
          return {
            success: true,
            action: 'regenerate',
            bookId: currentBookId,
            stepNumber,
            regenerating: true,
            nextAction: `Agent should regenerate content for Step ${stepNumber} using existing tools`,
            message: `Regenerating content for Step ${stepNumber}...`
          };
          
        case 'finalize':
          // Complete the book creation process and update Step 6
          console.log('[createBookArtifact] 🎯 FINALIZE: Completing book creation process');
          
          // First, retrieve existing workflow state to preserve all previous steps
          let currentWorkflowState: BookArtifactState | null = null;
          try {
            currentWorkflowState = await getWorkflowFromDatabase(currentBookId, session);
            console.log('[createBookArtifact] 🔍 Retrieved existing workflow for finalization:', currentWorkflowState ? 'Found' : 'Not found');
          } catch (error) {
            console.error('[createBookArtifact] Error retrieving existing workflow for finalization:', error);
          }
          
          if (!currentWorkflowState) {
            return {
              success: false,
              error: 'Cannot finalize book: No existing workflow state found'
            };
          }
          
          // Create Step 6 final review data
          const step6Data = {
            status: 'completed',
            bookTitle: currentWorkflowState.bookTitle,
            totalSteps: 6,
            completedSteps: 6,
            bookSummary: `${currentWorkflowState.bookTitle} - A ${currentWorkflowState.targetAge} children's book`,
            bookConcept: currentWorkflowState.bookConcept,
            
            // Count assets from previous steps with safe property access
            totalCharacters: (() => {
              const step2Data = currentWorkflowState.steps.find(s => s.stepNumber === 2)?.data;
              return (step2Data && typeof step2Data === 'object' && 'characters' in step2Data && Array.isArray(step2Data.characters)) ? step2Data.characters.length : 0;
            })(),
            totalEnvironments: (() => {
              const step4Data = currentWorkflowState.steps.find(s => s.stepNumber === 4)?.data;
              return (step4Data && typeof step4Data === 'object' && 'environments' in step4Data && Array.isArray(step4Data.environments)) ? step4Data.environments.length : 0;
            })(),
            totalScenes: (() => {
              const step5Data = currentWorkflowState.steps.find(s => s.stepNumber === 5)?.data;
              if (step5Data && typeof step5Data === 'object') {
                if ('scenes' in step5Data && Array.isArray(step5Data.scenes)) return step5Data.scenes.length;
                if ('scenesToCompose' in step5Data && Array.isArray(step5Data.scenesToCompose)) return step5Data.scenesToCompose.length;
              }
              return 0;
            })(),
            
            // Calculate total pages (estimate based on scenes)
            totalPages: (() => {
              const step5Data = currentWorkflowState.steps.find(s => s.stepNumber === 5)?.data;
              let sceneCount = 6; // default
              if (step5Data && typeof step5Data === 'object') {
                if ('scenes' in step5Data && Array.isArray(step5Data.scenes)) sceneCount = step5Data.scenes.length;
                else if ('scenesToCompose' in step5Data && Array.isArray(step5Data.scenesToCompose)) sceneCount = step5Data.scenesToCompose.length;
              }
              return Math.max(12, sceneCount * 2);
            })(),
            
            finalizedAt: new Date().toISOString()
          };
          
          // Update all steps, marking Step 6 as completed
          const finalUpdatedSteps = currentWorkflowState.steps.map(step => {
            if (step.stepNumber === 6) {
              return {
                ...step,
                status: 'completed' as const,
                data: step6Data
              };
            } else if (step.stepNumber < 6) {
              return {
                ...step,
                status: 'approved' as const
              };
            } else {
              return step;
            }
          });
          
          // Create final workflow state
          const finalWorkflowState: BookArtifactState = {
            ...currentWorkflowState,
            currentStep: 6,
            steps: finalUpdatedSteps,
            updatedAt: new Date()
          };
          
          // Save final workflow state to database
          try {
            await saveWorkflowToDatabase(finalWorkflowState, session);
            console.log('[createBookArtifact] ✅ Final workflow state saved to database');
          } catch (error) {
            console.error('[createBookArtifact] Error saving final workflow to database:', error);
          }
          
          // Send final artifact update
          dataStream.write?.({
            type: 'book-creation-state',
            content: finalWorkflowState
          });
          
          console.log('[createBookArtifact] 🎉 Book creation finalized with Step 6 completed');
          
          return {
            success: true,
            action: 'finalize',
            bookId: currentBookId,
            bookFinalized: true,
            message: 'Book creation completed successfully! The book is ready for publishing.',
            artifactState: finalWorkflowState
          };
          
        default:
          return {
            success: false,
            error: `Unknown action: ${action}`
          };
      }
    }
  });

/**
 * Search for existing images in memory and database
 */
async function searchExistingImages(
  bookId: string, 
  searchQuery: string, 
  imageType: 'character' | 'environment' | 'scene' | 'any',
  session: Session
): Promise<Array<{name: string, imageUrl: string, source: 'memory' | 'database', description?: string}>> {
  const results: Array<{name: string, imageUrl: string, source: 'memory' | 'database', description?: string}> = [];
  
  if (!session?.user?.id) {
    return results;
  }

  try {
    // Search BookProp database FIRST (prioritized for book-specific assets)
    console.log(`[searchExistingImages] Searching BookProp database first for ${imageType} assets`);
    const { db } = await import('@/lib/db/db');
    const { bookProp } = await import('@/lib/db/schema');
    const { eq, and, like } = await import('drizzle-orm');
    
    let typeFilter = imageType;
    if (imageType === 'any') {
      // Don't filter by type
      const dbResults = await db
        .select()
        .from(bookProp)
        .where(
          and(
            eq(bookProp.userId, session.user.id),
            eq(bookProp.bookId, bookId),
            like(bookProp.name, `%${searchQuery}%`)
          )
        )
        .limit(10);
      
      for (const prop of dbResults) {
        if (prop.imageUrl) {
          results.push({
            name: prop.name,
            imageUrl: prop.imageUrl,
            source: 'database' as const,
            description: prop.description || `${prop.type}: ${prop.name}`
          });
        }
      }
    } else {
      const dbResults = await db
        .select()
        .from(bookProp)
        .where(
          and(
            eq(bookProp.userId, session.user.id),
            eq(bookProp.bookId, bookId),
            eq(bookProp.type, typeFilter),
            like(bookProp.name, `%${searchQuery}%`)
          )
        )
        .limit(10);
      
      for (const prop of dbResults) {
        if (prop.imageUrl) {
          results.push({
            name: prop.name,
            imageUrl: prop.imageUrl,
            source: 'database' as const,
            description: prop.description || `${prop.type}: ${prop.name}`
          });
        }
      }
    }

    console.log(`[searchExistingImages] Found ${results.length} results in BookProp database`);

    // Search memory as fallback (secondary priority)
    console.log(`[searchExistingImages] Searching memory as fallback for additional ${imageType} assets`);
    const { createMemoryService } = await import('@/lib/ai/memory/service');
    const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    
    if (apiKey) {
      const memoryService = createMemoryService(apiKey);
      const paprUserId = await ensurePaprUser(session.user.id, apiKey);
      
      if (paprUserId) {
        const memories = await memoryService.searchMemories(
          paprUserId,
          `${searchQuery} ${bookId} image portrait`,
          10
        );

        for (const memory of memories) {
          const customMeta = memory.metadata?.customMetadata as any;
          if (customMeta?.image_url || customMeta?.portrait_url) {
            const imageUrl = customMeta.image_url || customMeta.portrait_url;
            const name = customMeta.character_name || customMeta.environment_name || customMeta.scene_name || 'Unknown';
            const memoryType = customMeta.kind || 'unknown';
            
            // Only add if not already found in BookProp (avoid duplicates)
            const alreadyExists = results.some(r => r.name === name && r.imageUrl === imageUrl);
            
            if (!alreadyExists && (imageType === 'any' || imageType === memoryType)) {
              results.push({
                name,
                imageUrl,
                source: 'memory' as const,
                description: memory.content?.substring(0, 100)
              });
            }
          }
        }
      }
    }

    console.log(`[searchExistingImages] Total results found: ${results.length} (BookProp + Memory)`);

  } catch (error) {
    console.error('[searchExistingImages] Error searching for existing images:', error);
  }

  return results;
}

/**
 * Enrich character data with images from memory and database
 */
async function enrichCharacterDataWithImages(stepData: any, bookId: string, session: Session): Promise<any> {
  if (!stepData.characters || !Array.isArray(stepData.characters)) {
    return stepData;
  }

  const enrichedCharacters = [];
  
  for (const character of stepData.characters) {
    const enrichedCharacter = { ...character };
    
    // Try to find character image in BookProp database FIRST (prioritized)
    if (session?.user?.id) {
      try {
        const characterName = character.name || character.characterName;
        console.log(`[enrichCharacterData] Checking BookProp database first for character: ${characterName}`);
        
        // Try to get character from book_props table
        const { db } = await import('@/lib/db/db');
        const { bookProp } = await import('@/lib/db/schema');
        const { eq, and } = await import('drizzle-orm');
        
        const characterProp = await db
          .select()
          .from(bookProp)
          .where(
            and(
              eq(bookProp.userId, session.user.id),
              eq(bookProp.bookId, bookId),
              eq(bookProp.type, 'character'),
              eq(bookProp.name, characterName)
            )
          )
          .limit(1);
        
        if (characterProp.length > 0 && characterProp[0].imageUrl) {
          enrichedCharacter.portraitUrl = characterProp[0].imageUrl;
          enrichedCharacter.imageUrl = characterProp[0].imageUrl;
          console.log(`[enrichCharacterData] ✅ Found portrait in BookProp database for ${characterName}:`, characterProp[0].imageUrl.substring(0, 50));
        }
      } catch (error) {
        console.error(`[enrichCharacterData] Error checking BookProp database for ${character.name}:`, error);
      }
    }

    // If not found in BookProp, try memory as fallback
    if (!enrichedCharacter.portraitUrl && !enrichedCharacter.imageUrl) {
      try {
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
        const apiKey = process.env.PAPR_MEMORY_API_KEY;
        
        if (apiKey && session?.user?.id) {
          const memoryService = createMemoryService(apiKey);
          const paprUserId = await ensurePaprUser(session.user.id, apiKey);
          
          if (paprUserId) {
            // Search for character portrait in memory
            const characterName = character.name || character.characterName;
            console.log(`[enrichCharacterData] Checking memory as fallback for character: ${characterName}`);
            const memories = await memoryService.searchMemories(
              paprUserId,
              `character portrait ${characterName} book ${bookId}`,
              5
            );

            // Look for character-specific memories with images
            const characterMemory = memories.find((m: any) => {
              const customMeta = m.metadata?.customMetadata as any;
              return customMeta?.character_name === characterName &&
                customMeta?.book_id === bookId &&
                (customMeta?.kind === 'character' || customMeta?.content_type === 'character_portrait') &&
                (customMeta?.image_url || customMeta?.portrait_url);
            });

            if (characterMemory) {
              const customMeta = characterMemory.metadata?.customMetadata as any;
              enrichedCharacter.portraitUrl = customMeta?.image_url || customMeta?.portrait_url;
              enrichedCharacter.imageUrl = customMeta?.image_url || customMeta?.portrait_url;
              console.log(`[enrichCharacterData] ✅ Found portrait in memory for ${characterName}:`, enrichedCharacter.portraitUrl?.substring(0, 50));
            } else {
              console.log(`[enrichCharacterData] No portrait found in memory for ${characterName}`);
            }
          }
        }
      } catch (error) {
        console.error(`[enrichCharacterData] Error searching memory for ${character.name}:`, error);
      }
    }

    
    enrichedCharacters.push(enrichedCharacter);
  }

  console.log(`[enrichCharacterData] Final enriched characters:`, enrichedCharacters.map(c => ({
    name: c.name,
    hasPortraitUrl: !!c.portraitUrl,
    hasImageUrl: !!c.imageUrl,
    portraitUrl: c.portraitUrl?.substring(0, 50) + '...'
  })));

  return {
    ...stepData,
    characters: enrichedCharacters
  };
}

/**
 * Enrich environment data with images from memory and database
 */
async function enrichEnvironmentDataWithImages(stepData: any, bookId: string, session: Session): Promise<any> {
  if (!stepData.environments || !Array.isArray(stepData.environments)) {
    return stepData;
  }

  const enrichedEnvironments = [];
  
  for (const environment of stepData.environments) {
    const enrichedEnvironment = { ...environment };
    
    // If environment already has existingReference, preserve it
    if (environment.existingReference) {
      enrichedEnvironment.imageUrl = environment.existingReference;
      enrichedEnvironment.environmentUrl = environment.existingReference;
      console.log(`[enrichEnvironmentData] Using existing reference for ${environment.name}:`, environment.existingReference?.substring(0, 50));
      enrichedEnvironments.push(enrichedEnvironment);
      continue;
    }
    
    // Try to find environment image in BookProp database FIRST (prioritized)
    if (session?.user?.id) {
      try {
        const environmentName = environment.name || environment.environmentName;
        console.log(`[enrichEnvironmentData] Checking BookProp database first for environment: ${environmentName}`);
        
        // Try to get environment from book_props table
        const { db } = await import('@/lib/db/db');
        const { bookProp } = await import('@/lib/db/schema');
        const { eq, and } = await import('drizzle-orm');
        
        const environmentProp = await db
          .select()
          .from(bookProp)
          .where(
            and(
              eq(bookProp.userId, session.user.id),
              eq(bookProp.bookId, bookId),
              eq(bookProp.type, 'environment'),
              eq(bookProp.name, environmentName)
            )
          )
          .limit(1);
        
        if (environmentProp.length > 0 && environmentProp[0].imageUrl) {
          enrichedEnvironment.imageUrl = environmentProp[0].imageUrl;
          enrichedEnvironment.environmentUrl = environmentProp[0].imageUrl;
          console.log(`[enrichEnvironmentData] ✅ Found image in BookProp database for ${environmentName}:`, environmentProp[0].imageUrl.substring(0, 50));
        }
      } catch (error) {
        console.error(`[enrichEnvironmentData] Error checking BookProp database for ${environment.name}:`, error);
      }
    }

    // If not found in BookProp, try memory as fallback
    if (!enrichedEnvironment.imageUrl && !enrichedEnvironment.environmentUrl) {
      try {
        const { createMemoryService } = await import('@/lib/ai/memory/service');
        const { ensurePaprUser } = await import('@/lib/ai/memory/middleware');
        const apiKey = process.env.PAPR_MEMORY_API_KEY;
        
        if (apiKey && session?.user?.id) {
          const memoryService = createMemoryService(apiKey);
          const paprUserId = await ensurePaprUser(session.user.id, apiKey);
          
          if (paprUserId) {
            // Search for environment image in memory
            const environmentName = environment.name || environment.environmentName;
            console.log(`[enrichEnvironmentData] Checking memory as fallback for environment: ${environmentName}`);
            const memories = await memoryService.searchMemories(
              paprUserId,
              `environment ${environmentName} book ${bookId}`,
              5
            );

            // Look for environment-specific memories with images
            const environmentMemory = memories.find((m: any) => {
              const customMeta = m.metadata?.customMetadata as any;
              return customMeta?.environment_name === environmentName &&
                customMeta?.book_id === bookId &&
                (customMeta?.kind === 'environment') &&
                (customMeta?.image_url || customMeta?.environment_url);
            });

            if (environmentMemory) {
              const customMeta = environmentMemory.metadata?.customMetadata as any;
              enrichedEnvironment.imageUrl = customMeta?.image_url || customMeta?.environment_url;
              enrichedEnvironment.environmentUrl = customMeta?.image_url || customMeta?.environment_url;
              console.log(`[enrichEnvironmentData] ✅ Found image in memory for ${environmentName}:`, enrichedEnvironment.imageUrl?.substring(0, 50));
            } else {
              console.log(`[enrichEnvironmentData] No image found in memory for ${environmentName}`);
            }
          }
        }
      } catch (error) {
        console.error(`[enrichEnvironmentData] Error searching memory for ${environment.name}:`, error);
      }
    }

    
    enrichedEnvironments.push(enrichedEnvironment);
  }

  return {
    ...stepData,
    environments: enrichedEnvironments
  };
}

/**
 * Save workflow state to database (Books table with workflow_state column)
 */
async function saveWorkflowToDatabase(workflowState: BookArtifactState, session: Session): Promise<void> {
  if (!session?.user?.id) {
    throw new Error('No user session available');
  }

  try {
    const { db } = await import('@/lib/db/db');
    const { Book } = await import('@/lib/db/schema');
    const { eq, and, sql } = await import('drizzle-orm');
    
    // Create a readable summary of the workflow progress
    const completedSteps = workflowState.steps.filter(step => step.status === 'completed' || step.status === 'approved');
    const currentStepName = workflowState.steps.find(step => step.stepNumber === workflowState.currentStep)?.stepName || `Step ${workflowState.currentStep}`;
    
    const workflowSummary = `Book Creation Workflow Progress:
- Book: ${workflowState.bookTitle}
- Target Age: ${workflowState.targetAge}
- Current Step: ${workflowState.currentStep}/6 (${currentStepName})
- Completed Steps: ${completedSteps.length}/6
- Progress: ${Math.round((completedSteps.length / 6) * 100)}%

Book Concept: ${workflowState.bookConcept}

Workflow Data: ${JSON.stringify(workflowState, null, 2)}`;

    const workflowData = {
      bookId: workflowState.bookId,
      userId: session.user.id,
      bookTitle: workflowState.bookTitle,
      chapterNumber: 0, // Special chapter number for workflow metadata
      chapterTitle: `${workflowState.bookTitle} - Workflow`, // Use actual book title
      content: workflowSummary, // Store readable summary with JSON data
      version: '1',
      is_latest: true,
      updatedAt: new Date()
    };

    // Use UPSERT (INSERT ... ON CONFLICT DO UPDATE) to prevent duplicates
    // This is atomic and handles race conditions properly
    console.log(`[saveWorkflowToDatabase] 🔄 Upserting workflow for book ${workflowState.bookId}...`);
    
    const result = await db.execute(sql`
      INSERT INTO "Books" (
        "bookId", "userId", "bookTitle", "chapterNumber", "chapterTitle", 
        "content", "version", "is_latest", "createdAt", "updatedAt"
      ) VALUES (
        ${workflowState.bookId}, 
        ${session.user.id}, 
        ${workflowState.bookTitle}, 
        0, 
        ${workflowData.chapterTitle}, 
        ${workflowData.content}, 
        ${workflowData.version}, 
        ${workflowData.is_latest}, 
        NOW(), 
        NOW()
      )
      ON CONFLICT ("bookId", "userId", "chapterNumber") 
      DO UPDATE SET 
        "bookTitle" = EXCLUDED."bookTitle",
        "chapterTitle" = EXCLUDED."chapterTitle",
        "content" = EXCLUDED."content",
        "version" = EXCLUDED."version",
        "is_latest" = EXCLUDED."is_latest",
        "updatedAt" = NOW()
      RETURNING "id", "createdAt", "updatedAt"
    `);

    if (result.length > 0) {
      console.log(`[saveWorkflowToDatabase] ✅ Upserted workflow for book ${workflowState.bookId} (ID: ${result[0].id})`);
    } else {
      console.warn(`[saveWorkflowToDatabase] ⚠️ Upsert returned no results for book ${workflowState.bookId}`);
    }
  } catch (error) {
    console.error('[saveWorkflowToDatabase] Error:', error);
    throw error;
  }
}

/**
 * Retrieve workflow state from database
 */
export async function getWorkflowFromDatabase(bookId: string, session: Session): Promise<BookArtifactState | null> {
  if (!session?.user?.id) {
    return null;
  }

  try {
    const { db } = await import('@/lib/db/db');
    const { Book } = await import('@/lib/db/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const workflowRecord = await db
      .select()
      .from(Book)
      .where(
        and(
          eq(Book.bookId, bookId),
          eq(Book.userId, session.user.id),
          eq(Book.chapterNumber, 0) // Workflow metadata is stored in chapter 0
        )
      )
      .limit(1);

    if (workflowRecord.length > 0 && workflowRecord[0].content) {
      try {
        // Extract JSON from the workflow summary (it's at the end after "Workflow Data: ")
        const content = workflowRecord[0].content;
        console.log(`[getWorkflowFromDatabase] Raw content length: ${content.length}`);
        console.log(`[getWorkflowFromDatabase] Raw content preview: ${content.substring(0, 200)}...`);
        
        const jsonStart = content.indexOf('Workflow Data: ') + 'Workflow Data: '.length;
        const jsonContent = content.substring(jsonStart);
        console.log(`[getWorkflowFromDatabase] JSON content length: ${jsonContent.length}`);
        console.log(`[getWorkflowFromDatabase] JSON content preview: ${jsonContent.substring(0, 300)}...`);
        
        const workflowState = JSON.parse(jsonContent) as BookArtifactState;
        console.log(`[getWorkflowFromDatabase] ✅ Retrieved workflow for book ${bookId}`);
        console.log(`[getWorkflowFromDatabase] 📖 isPictureBook state:`, workflowState.isPictureBook);
        console.log(`[getWorkflowFromDatabase] 🔍 Loaded steps with data:`, workflowState.steps.map(s => ({ 
          stepNumber: s.stepNumber, 
          status: s.status, 
          hasData: !!s.data 
        })));
        return workflowState;
      } catch (parseError) {
        console.error('[getWorkflowFromDatabase] Error parsing workflow JSON:', parseError);
        return null;
      }
    }

    console.log(`[getWorkflowFromDatabase] No workflow found for book ${bookId}`);
    return null;
  } catch (error) {
    console.error('[getWorkflowFromDatabase] Error:', error);
    return null;
  }
}

/**
 * Search and Use Existing Images Tool - Allows AI agent to find and reuse existing images
 */
export const searchAndUseExistingImages = ({ session, dataStream }: { session: Session; dataStream: DataStreamWriter }) =>
  tool({
    description: `Search for existing images in memory and database for direct reuse in book creation.
    
    🎯 **SIMPLE WORKFLOW**: Find existing images → Show to user → If approved, add URLs directly to book plan
    
    **When to use this tool**:
    - ALWAYS search for existing images BEFORE suggesting new image creation
    - Before populating character data in book creation steps
    - Before creating environments or scenes
    - When user asks "do we have existing images for these characters?"
    
    **RECOMMENDED WORKFLOW**:
    1. **Search**: Use this tool to find existing character/environment images
    2. **Present**: Show results to user: "I found these existing portraits for [Character]: [images]"
    3. **User decides**: User says "use those" OR "create new ones"  
    4. **If approved**: Directly add imageUrl/portraitUrl to character data when updating book steps
    5. **If rejected**: Then call image creation tools to make new ones
    
    **Key Benefits**:
    - ✅ No duplicate image creation when good ones exist
    - ✅ User has full control over image selection  
    - ✅ Direct workflow - just add URLs to step data
    - ✅ Faster than always creating new images
    
    **DO NOT**:
    ❌ Call image creation tools without checking for existing images first
    ❌ Assume user wants new images when existing ones might work
    ❌ Create complex tool chains when simple URL assignment works
    
    This tool returns image URLs that can be directly assigned to character.portraitUrl or character.imageUrl in book step data.`,
    
    inputSchema: z.object({
      bookId: z.string().describe('Book ID to search within'),
      searchQuery: z.string().describe('Search term - character name, environment name, or description keywords'),
      imageType: z.enum(['character', 'environment', 'scene', 'any']).describe('Type of image to search for'),
      maxResults: z.number().optional().default(10).describe('Maximum number of results to return')
    }),
    
    execute: async (input) => {
      const { bookId, searchQuery, imageType, maxResults = 10 } = input;
      
      console.log(`[searchAndUseExistingImages] Searching for ${imageType} images with query: "${searchQuery}" in book ${bookId}`);
      
      try {
        const existingImages = await searchExistingImages(bookId, searchQuery, imageType, session);
        
        const limitedResults = existingImages.slice(0, maxResults);
        
        console.log(`[searchAndUseExistingImages] Found ${limitedResults.length} existing images`);
        
        // Stream the results for user visibility
        dataStream.write?.({
          type: 'existing-images-search',
          content: {
            searchQuery,
            imageType,
            resultsCount: limitedResults.length,
            results: limitedResults
          }
        });
        
        return {
          success: true,
          searchQuery,
          imageType,
          resultsFound: limitedResults.length,
          images: limitedResults,
          message: limitedResults.length > 0 
            ? `Found ${limitedResults.length} existing ${imageType} images matching "${searchQuery}". Show these to the user and ask if they want to use them. If approved, directly add the imageUrl to the character data in the book step.`
            : `No existing ${imageType} images found matching "${searchQuery}". You'll need to create new images if the user wants them.`,
          usage: {
            simpleWorkflow: "1. Show images to user → 2. Get approval → 3. Add imageUrl directly to character.portraitUrl in book step data",
            avoidComplexity: "Don't call image creation tools if user approves existing images - just use the URLs directly"
          }
        };
      } catch (error) {
        console.error('[searchAndUseExistingImages] Error:', error);
        return {
          success: false,
          error: 'Failed to search for existing images',
          searchQuery,
          imageType,
          resultsFound: 0,
          images: []
        };
      }
    }
  });

/**
 * Enhanced spatial processing for environments (Step 4)
 */
async function enhanceEnvironmentsWithSpatialData(stepData: any, bookId: string, session: Session): Promise<any> {
  if (!stepData.environments || !Array.isArray(stepData.environments)) {
    return stepData;
  }
  
  const enhancedEnvironments = await Promise.all(
    stepData.environments.map(async (env: any) => {
      // Add spatial enhancement prompts for top-down views
      const spatialEnhancements = {
        spatialViewType: 'top-down-with-detail',
        spatialPromptAddition: `

🗺️ SPATIAL LAYOUT REQUIREMENTS:
- Create from a top-down or elevated isometric view showing complete spatial relationships
- Include clear zones for character placement (seating areas, walkways, interaction points)
- Show architectural accuracy with proper proportions and scale references
- Define clear sight lines and accessibility paths
- Include spatial reference points for accurate character positioning

ZONE DEFINITION: Clearly define functional areas within this environment:
- Seating/resting areas with specific positions
- Movement corridors and pathways  
- Interaction zones (doors, windows, furniture)
- Scale references for character placement
- Clear boundaries between different functional areas

This environment will serve as a spatial foundation for precise character placement in scenes.`,
        
        enhancedDescription: `${env.description || ''} 

SPATIAL CONTEXT: This ${env.name} environment needs comprehensive spatial layout visibility. Show the complete space from an elevated perspective that reveals:
- All functional zones and their relationships
- Clear pathways and access points
- Seating arrangements and interaction areas
- Proper scale and proportional relationships
- Environmental elements that characters can interact with

The view should provide enough spatial information for characters to be placed accurately and logically in subsequent scene compositions.`
      };
      
      return {
        ...env,
        ...spatialEnhancements
      };
    })
  );
  
  return {
    ...stepData,
    environments: enhancedEnvironments,
    spatialEnhancementApplied: true,
    spatialNotes: 'Environments enhanced with top-down spatial layout requirements for accurate character placement'
  };
}

/**
 * Enhanced prescriptive positioning for scenes (Step 5)
 */
async function enhanceScenesWithPrescriptivePositioning(stepData: any, bookId: string, session: Session): Promise<any> {
  if (!stepData.chapters || !Array.isArray(stepData.chapters)) {
    return stepData;
  }
  
  const enhancedChapters = await Promise.all(
    stepData.chapters.map(async (chapter: any) => {
      if (!chapter.scenes || !Array.isArray(chapter.scenes)) {
        return chapter;
      }
      
      const enhancedScenes = chapter.scenes.map((scene: any) => {
        // Add prescriptive positioning requirements
        const prescriptiveEnhancements = {
          prescriptivePositioning: true,
          spatialInstructions: `

🎯 PRESCRIPTIVE CHARACTER POSITIONING:
When creating this scene, be extremely specific about character placement:

SCENE: ${scene.text || scene.content || 'Scene description'}
${scene.characters ? `CHARACTERS: ${scene.characters.join(', ')}` : ''}
${scene.environment ? `ENVIRONMENT: ${scene.environment}` : ''}

POSITIONING REQUIREMENTS:
- Specify exact locations within the environment (e.g., "sitting in airplane seat 12A", "standing in the aisle between rows 5 and 6")
- Define character poses and body language clearly
- Describe what each character is touching, leaning on, or interacting with
- Specify facing directions and eye contact between characters
- Ensure all positions are physically possible and spatially consistent

SPATIAL VALIDATION:
- Characters cannot float or be placed in impossible positions
- All interactions with environment must be realistic (sitting IN seats, not ON trays)
- Character scale must be appropriate for the environment
- Multiple characters must have logical spatial relationships

This prescriptive approach prevents spatial inconsistencies and ensures realistic, believable scene composition.`,
          
          enhancedImagePrompt: scene.illustrationNotes ? 
            `${scene.illustrationNotes}

🎯 SPATIAL POSITIONING CRITICAL REQUIREMENTS:
- Use EXACT positioning language (specific seat numbers, precise locations)
- Characters must interact realistically with environment elements
- Show proper scale relationships between characters and environment
- Validate that all positions are physically possible and logical
- Characters should appear naturally integrated, not artificially placed

PRESCRIPTIVE SCENE COMPOSITION: Use the environment as a spatial foundation and place each character in their specified, realistic position within that space.` 
            : undefined
        };
        
        return {
          ...scene,
          ...prescriptiveEnhancements
        };
      });
      
      return {
        ...chapter,
        scenes: enhancedScenes
      };
    })
  );
  
  return {
    ...stepData,
    chapters: enhancedChapters,
    prescriptivePositioningApplied: true,
    spatialNotes: 'Scenes enhanced with prescriptive character positioning requirements to prevent spatial inconsistencies'
  };
}

/**
 * Validate that picture books have required images for each step
 */
function validatePictureBookImageRequirements(stepNumber: number, stepData: any): {
  isValid: boolean;
  errors: string[];
  requiredImages: string[];
} {
  const errors: string[] = [];
  const requiredImages: string[] = [];
  
  switch (stepNumber) {
    case 2: // Character Creation
      if (stepData.characters && Array.isArray(stepData.characters)) {
        for (const character of stepData.characters) {
          if (!character.imageUrl && !character.portraitUrl) {
            errors.push(`Character "${character.name}" missing imageUrl`);
            requiredImages.push(`Character portrait for ${character.name}`);
          }
        }
      }
      break;
      
    case 4: // Environment Design
      if (stepData.environments && Array.isArray(stepData.environments)) {
        for (const environment of stepData.environments) {
          if (!environment.imageUrl) {
            errors.push(`Environment "${environment.name}" missing imageUrl`);
            requiredImages.push(`Environment image for ${environment.name}`);
          }
        }
      }
      break;
      
    case 5: // Scene Composition
      if (stepData.chapters && Array.isArray(stepData.chapters)) {
        for (const chapter of stepData.chapters) {
          if (chapter.scenes && Array.isArray(chapter.scenes)) {
            for (const scene of chapter.scenes) {
              if (!scene.imageUrl) {
                errors.push(`Scene "${scene.title || scene.sceneNumber || 'untitled'}" missing imageUrl`);
                requiredImages.push(`Scene image for ${scene.title || `Scene ${scene.sceneNumber}`}`);
              }
            }
          }
        }
      }
      break;
      
    default:
      // No image requirements for other steps
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    requiredImages
  };
}

// Export types for use in UI components
export type { BookArtifactState, BookCreationStep, UnifiedBookCreationInput };
export { BOOK_CREATION_STEPS };
