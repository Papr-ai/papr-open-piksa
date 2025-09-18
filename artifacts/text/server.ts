import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    let streamResult;
    try {
      streamResult = streamText({
        model: myProvider.languageModel('artifact-model'),
        system:
          'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: title,
        maxOutputTokens: 5000, // Reasonable limit for text artifacts
      });
    } catch (reasoningError: any) {
      console.error('[Text Artifact] Error with AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[Text Artifact] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        streamResult = streamText({
          model: myProvider.languageModel('artifact-model'),
          system:
            'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
          experimental_transform: smoothStream({ chunking: 'word' }),
          prompt: title,
          maxOutputTokens: 5000, // Reasonable limit for text artifacts
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
        system: updateDocumentPrompt(document.content, 'text'),
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: description,
        maxOutputTokens: 5000, // Reasonable limit for text artifacts
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
      console.error('[Text Artifact Update] Error with AI call:', reasoningError);
      
      // Check if this is a reasoning error
      if (reasoningError.message?.includes('reasoning') || reasoningError.message?.includes('required following item')) {
        console.log('[Text Artifact Update] Detected reasoning chain error, retrying without reasoning...');
        
        // Retry without reasoning-specific features
        updateStreamResult = streamText({
          model: myProvider.languageModel('artifact-model'),
          system: updateDocumentPrompt(document.content, 'text'),
          experimental_transform: smoothStream({ chunking: 'word' }),
          prompt: description,
          maxOutputTokens: 5000, // Reasonable limit for text artifacts
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
