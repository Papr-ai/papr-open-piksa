import { smoothStream, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';

export const memoryDocumentHandler = createDocumentHandler<'memory'>({
  kind: 'memory',
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system:
        'Create a comprehensive memory document about the given topic. This should be well-structured content that can be stored and retrieved later. Use clear headings, bullet points, and organize information logically. Focus on key facts, insights, and actionable information. Markdown is supported.',
      experimental_transform: smoothStream({ chunking: 'word' }),
      prompt: title,
      maxOutputTokens: 5000, // Reasonable limit for memory artifacts
    });

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

    const { fullStream } = streamText({
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
