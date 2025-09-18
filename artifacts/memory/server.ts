import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';

export const memoryDocumentHandler = createDocumentHandler<'memory'>({
  kind: 'memory',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    let streamResult;
    try {
      streamResult = streamText({
        model: myProvider.languageModel('artifact-model'),
        system:
          'Create a comprehensive memory document about the given topic. This should be well-structured content that can be stored and retrieved later. Use clear headings, bullet points, and organize information logically. Focus on key facts, insights, and actionable information. Markdown is supported.',
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: title,
        maxOutputTokens: 5000, // Reasonable limit for memory artifacts
      });
    } catch (reasoningError: any) {
      console.error('[Memory Artifact] Error with AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[Memory Artifact] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        streamResult = streamText({
          model: myProvider.languageModel('artifact-model'),
          system:
            'Create a comprehensive memory document about the given topic. This should be well-structured content that can be stored and retrieved later. Use clear headings, bullet points, and organize information logically. Focus on key facts, insights, and actionable information. Markdown is supported.',
          experimental_transform: smoothStream({ chunking: 'word' }),
          prompt: title,
          maxOutputTokens: 5000, // Reasonable limit for memory artifacts
        });
      } else {
        throw reasoningError;
      }
    }
    
    const { fullStream } = streamResult;

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;

        dataStream.write?.({
          type: 'text-delta',
          content: text,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = '';

    let updateStreamResult;
    try {
      updateStreamResult = streamText({
        model: myProvider.languageModel('artifact-model'),
        system: updateDocumentPrompt(document.content, 'memory'),
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: description,
        maxOutputTokens: 5000, // Reasonable limit for memory artifacts
        providerOptions: {
          openai: {
            prediction: {
              type: 'content',
              content: document.content,
            },
          },
        },
      });
    } catch (reasoningError: any) {
      console.error('[Memory Artifact Update] Error with AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[Memory Artifact Update] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        updateStreamResult = streamText({
          model: myProvider.languageModel('artifact-model'),
          system: updateDocumentPrompt(document.content, 'memory'),
          experimental_transform: smoothStream({ chunking: 'word' }),
          prompt: description,
          maxOutputTokens: 5000, // Reasonable limit for memory artifacts
          providerOptions: {
            openai: {
              prediction: {
                type: 'content',
                content: document.content,
              },
            },
          },
        });
      } else {
        throw reasoningError;
      }
    }
    
    const { fullStream } = updateStreamResult;

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;
        dataStream.write?.({
          type: 'text-delta',
          content: text,
        });
      }
    }

    return draftContent;
  },
});
