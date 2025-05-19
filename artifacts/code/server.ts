import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { codePrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';

export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';
    console.log('[CODE SERVER] Creating code document with title:', title);

    try {
      console.log('[CODE SERVER] Starting LLM stream with prompt:', {
        system: codePrompt,
        prompt: title,
      });

      const { fullStream } = streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: codePrompt,
        prompt: title,
        schema: z.object({
          code: z.string(),
          language: z.string(),
        }),
      });

      let deltaCount = 0;
      for await (const delta of fullStream) {
        deltaCount++;
        const { type } = delta;
        console.log('[CODE SERVER] Received stream delta:', {
          deltaNumber: deltaCount,
          type,
          fullDelta: JSON.stringify(delta),
        });

        if (type === 'object') {
          const { object } = delta;
          const { code, language } = object;

          if (code) {
            // Clean up the content if it's wrapped in template literals
            const cleanContent =
              code.startsWith('`') && code.endsWith('`')
                ? code.slice(1, -1)
                : code;

            console.log('[CODE SERVER] Processing code delta:', {
              deltaNumber: deltaCount,
              length: cleanContent.length,
              preview: cleanContent.substring(0, 50),
              language,
              fullCode: cleanContent, // Log the full code for debugging
            });

            dataStream.writeData({
              type: 'code-delta' as const,
              content: cleanContent,
            });

            draftContent = cleanContent;

            console.log('[CODE SERVER] Updated draft content:', {
              deltaNumber: deltaCount,
              draftContentLength: draftContent.length,
              preview: draftContent.substring(0, 50),
              language,
            });
          }
        }
      }

      console.log('[CODE SERVER] Stream completed:', {
        totalDeltas: deltaCount,
        finalContentLength: draftContent.length,
        preview: draftContent.substring(0, 100),
        fullContent: draftContent, // Log the full final content
      });

      // Send the final complete content again to ensure it's received
      if (draftContent) {
        console.log('[CODE SERVER] Sending final complete content');
        dataStream.writeData({
          type: 'code-delta' as const,
          content: draftContent,
        });
      }

      return draftContent;
    } catch (error) {
      console.error('[CODE SERVER] Error creating code document:', error);
      // Return empty string instead of undefined
      return '';
    }
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';
    console.log(
      '[CODE SERVER] Updating code document with description:',
      description,
    );
    console.log(
      '[CODE SERVER] Current document content length:',
      document.content?.length || 0,
    );

    try {
      console.log('[CODE SERVER] Starting LLM update stream with:', {
        system: updateDocumentPrompt(document.content, 'code'),
        prompt: description,
      });

      const { fullStream } = streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: updateDocumentPrompt(document.content, 'code'),
        prompt: description,
        schema: z.object({
          code: z.string(),
          language: z.string(),
        }),
      });

      let deltaCount = 0;
      for await (const delta of fullStream) {
        deltaCount++;
        const { type } = delta;
        console.log('[CODE SERVER] Received update stream delta:', {
          deltaNumber: deltaCount,
          type,
          fullDelta: JSON.stringify(delta),
        });

        if (type === 'object') {
          const { object } = delta;
          const { code, language } = object;

          if (code) {
            // Clean up the content if it's wrapped in template literals
            const cleanContent =
              code.startsWith('`') && code.endsWith('`')
                ? code.slice(1, -1)
                : code;

            console.log('[CODE SERVER] Processing update code delta:', {
              deltaNumber: deltaCount,
              length: cleanContent.length,
              preview: cleanContent.substring(0, 50),
              language,
              fullCode: cleanContent, // Log the full code for debugging
            });

            dataStream.writeData({
              type: 'code-delta' as const,
              content: cleanContent,
            });

            draftContent = cleanContent;

            console.log('[CODE SERVER] Updated draft content:', {
              deltaNumber: deltaCount,
              draftContentLength: draftContent.length,
              preview: draftContent.substring(0, 50),
              language,
            });
          }
        }
      }

      console.log('[CODE SERVER] Update stream completed:', {
        totalDeltas: deltaCount,
        finalContentLength: draftContent.length,
        preview: draftContent.substring(0, 100),
        fullContent: draftContent, // Log the full final content
      });

      // Send the final complete content again to ensure it's received
      if (draftContent) {
        console.log('[CODE SERVER] Sending final complete content');
        dataStream.writeData({
          type: 'code-delta' as const,
          content: draftContent,
        });
      }

      return draftContent;
    } catch (error) {
      console.error('[CODE SERVER] Error updating code document:', error);
      // Return original content instead of empty string on error
      return document.content || '';
    }
  },
});
