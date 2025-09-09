import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from '@/lib/types';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateUUID } from '@/lib/utils';
import { storeContentInMemory } from '@/lib/ai/memory/middleware';

interface CreateWritingToolsProps {
  session: Session;
  dataStream: DataStreamWriter;
}

const createWritingToolsSchema = z.object({
  bookTitle: z.string().describe('The title of the book these writing tools are for'),
  toolType: z.enum(['outline', 'character-profiles', 'style-guide', 'research-notes', 'synopsis', 'beat-sheet', 'world-building']).describe('Type of writing tool to create'),
  description: z.string().optional().describe('Additional context or specific requirements for the writing tool'),
  existingContent: z.string().optional().describe('Any existing content to build upon or reference'),
});

type CreateWritingToolsInput = z.infer<typeof createWritingToolsSchema>;

type CreateWritingToolsOutput = {
  documentId: string;
  title: string;
  content: string;
  toolType: string;
  bookTitle: string;
  wordCount: number;
  saved: boolean;
  saveError?: string;
};

export const createWritingTools = ({ session, dataStream }: CreateWritingToolsProps) =>
  tool({
    description: `Create writing tools and planning documents for book projects. This tool creates SEPARATE documents for writing aids, NOT book chapters. Use this for outlines, character bibles, style guides, research notes, and other planning materials that support your book writing but are not part of the actual story content.

    **Content Types Supported:**
    - 'outline': Story structure, plot points, chapter summaries
    - 'character-profiles': Character bibles with detailed character information
    - 'style-guide': Writing style, tone, voice guidelines
    - 'research-notes': World-building, historical research, technical details
    - 'synopsis': Book summaries, pitches, loglines
    - 'beat-sheet': Detailed story beats, pacing guides
    - 'world-building': Setting details, maps, cultures, rules

    **IMPORTANT:** This creates documents, NOT book chapters. Use createBook tool only for actual story content.`,
    inputSchema: createWritingToolsSchema,
    execute: async (input: CreateWritingToolsInput): Promise<CreateWritingToolsOutput> => {
      const { bookTitle, toolType, description, existingContent } = input;
      const documentId = generateUUID();

      // Create appropriate title
      const toolTypeNames = {
        'outline': 'Outline',
        'character-profiles': 'Character Profiles',
        'style-guide': 'Style Guide',
        'research-notes': 'Research Notes',
        'synopsis': 'Synopsis',
        'beat-sheet': 'Beat Sheet',
        'world-building': 'World Building'
      };

      const documentTitle = `${bookTitle} - ${toolTypeNames[toolType]}`;

      dataStream.write?.({
        type: 'kind',
        content: 'text',
      });

      dataStream.write?.({
        type: 'title',
        content: documentTitle,
      });

      dataStream.write?.({
        type: 'id',
        content: documentId,
      });

      // Create appropriate system prompt based on tool type
      const systemPrompts = {
        'outline': `You are an expert story development consultant. Create a comprehensive story outline that includes plot structure, character arcs, and chapter breakdowns. Focus on narrative flow, conflict development, and story pacing.`,
        
        'character-profiles': `You are an expert character development specialist. Create detailed character profiles including personality traits, backgrounds, motivations, character arcs, physical descriptions, and relationships. Make characters three-dimensional and compelling.`,
        
        'style-guide': `You are an expert writing coach. Create a style guide that defines the voice, tone, narrative style, dialogue patterns, and writing conventions for this book. Include examples and guidelines for consistency.`,
        
        'research-notes': `You are a research specialist. Compile detailed research notes including world-building elements, technical details, historical context, or any factual information needed for the story. Organize information clearly and cite sources when relevant.`,
        
        'synopsis': `You are a publishing expert. Create compelling synopsis and pitch materials including book summaries, loglines, and marketing descriptions. Focus on highlighting the story's unique elements and appeal.`,
        
        'beat-sheet': `You are a story structure expert. Create a detailed beat sheet with specific story beats, pacing guides, emotional arcs, and scene-by-scene breakdowns. Focus on dramatic structure and narrative momentum.`,
        
        'world-building': `You are a world-building expert. Create comprehensive details about the story's setting including locations, cultures, rules, systems, maps, and environmental details. Ensure internal consistency and immersive detail.`
      };

      const systemPrompt = systemPrompts[toolType];

      // Generate content based on tool type
      let draftContent = '';
      
      const contentPrompt = description 
        ? `Create a comprehensive ${toolTypeNames[toolType].toLowerCase()} for the book "${bookTitle}".

Additional Requirements: ${description}

${existingContent ? `Build upon this existing content: ${existingContent}` : ''}

Create a well-structured, detailed ${toolTypeNames[toolType].toLowerCase()} that will serve as a valuable reference for writing the book. Use clear headings, bullet points, and organize the information logically.`
        : `Create a comprehensive ${toolTypeNames[toolType].toLowerCase()} for the book "${bookTitle}".

${existingContent ? `Build upon this existing content: ${existingContent}` : ''}

Create a well-structured, detailed ${toolTypeNames[toolType].toLowerCase()} that will serve as a valuable reference for writing the book. Use clear headings, bullet points, and organize the information logically.`;

      const streamResult = streamText({
        model: openai('gpt-5'),
        system: systemPrompt,
        prompt: contentPrompt,
      });

      for await (const textDelta of streamResult.textStream) {
        draftContent += textDelta;
        dataStream.write?.({
          type: 'text-delta',
          content: textDelta,
        });
      }

      const wordCount = draftContent.split(/\s+/).filter(word => word.length > 0).length;

      // Store in memory for future reference
      try {
        if (session.user?.id) {
          await saveWritingToolToMemoryAsync(
            session.user.id,
            bookTitle,
            toolType,
            draftContent,
            documentId
          );
        }
      } catch (error) {
        console.error('[createWritingTools] Error saving to memory:', error);
      }

      return {
        documentId,
        title: documentTitle,
        content: draftContent,
        toolType,
        bookTitle,
        wordCount,
        saved: true,
      };
    },
  });

/**
 * Asynchronously save writing tool to memory for future reference
 */
async function saveWritingToolToMemoryAsync(
  userId: string,
  bookTitle: string,
  toolType: string,
  content: string,
  documentId: string
): Promise<void> {
  // Run async without blocking
  setImmediate(async () => {
    try {
      const apiKey = process.env.PAPR_MEMORY_API_KEY;
      if (!apiKey) {
        console.log('[createWritingTools] No Papr API key available for memory saving');
        return;
      }

      console.log(`[createWritingTools] Saving ${toolType} for "${bookTitle}" to memory...`);

      // Create memory content
      const memoryContent = `Writing Tool: ${bookTitle} - ${toolType.charAt(0).toUpperCase() + toolType.slice(1)}

${content}

---
Document Type: Writing Tool
Book: ${bookTitle}
Tool Type: ${toolType}
Created: ${new Date().toLocaleDateString()}`;

      // Create metadata for writing tool tracking
      const metadata = {
        sourceType: 'PaprChat_WritingTool',
        sourceUrl: `/artifacts/text/${documentId}`,
        external_user_id: userId,
        'emoji tags': ['📝', '📚', '🔧', '💡'],
        topics: ['writing tools', 'book planning', toolType.replace('-', ' '), bookTitle.toLowerCase().replace(/\s+/g, '_')],
        hierarchical_structures: `writing_tools/books/${bookTitle.toLowerCase().replace(/\s+/g, '_')}/${toolType}`,
        createdAt: new Date().toISOString(),
        customMetadata: {
          category: 'writing_tools',
          book_title: bookTitle,
          tool_type: toolType,
          document_id: documentId,
          content_type: 'writing_aid',
          app_user_id: userId,
          tool: 'createWritingTools'
        }
      };

      // Store in memory
      const success = await storeContentInMemory({
        userId,
        content: memoryContent,
        metadata,
        apiKey,
      });

      if (success) {
        console.log(`[createWritingTools] Successfully saved ${toolType} for "${bookTitle}" to memory`);
      } else {
        console.log(`[createWritingTools] Failed to save ${toolType} for "${bookTitle}" to memory`);
      }
    } catch (error) {
      console.error(`[createWritingTools] Error saving ${toolType} to memory:`, error);
    }
  });
}
