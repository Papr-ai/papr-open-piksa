import { myProvider } from './ai/providers';
import { streamObject } from 'ai';
import { z } from 'zod';

/**
 * Simple test function to verify the artifact model is properly configured
 * Run with: npx tsx lib/test-artifact-model.ts
 */
async function testArtifactModel() {
  console.log('Testing artifact model (Claude 3.7 Sonnet)...');

  try {
    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: 'You are a helpful assistant that generates Python code.',
      prompt:
        'Write a simple Python function to calculate the Fibonacci sequence.',
      schema: z.object({
        code: z.string(),
      }),
    });

    console.log('Stream created successfully, receiving content:');

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          console.log('Received code chunk:', {
            length: code.length,
            preview: `${code.substring(0, 100)}...`,
          });
        }
      }
    }

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing artifact model:', error);
  }
}

// Only run if directly executed (not imported)
if (require.main === module) {
  testArtifactModel();
}

export { testArtifactModel };
