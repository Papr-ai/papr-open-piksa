import { simulateReadableStream } from 'ai';
import { MockLanguageModelV2 } from 'ai/test';
import { getResponseChunksByPrompt } from '@/tests/prompts/utils';

// @ts-ignore - MockLanguageModelV2 API compatibility issues with AI SDK 5.0
export const chatModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'Hello, world!' }],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    warnings: [],
  }),
  // @ts-ignore - Parameter type compatibility
  doStream: async ({ prompt }: any) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt(prompt),
    }),
  }),
});

// @ts-ignore - MockLanguageModelV2 API compatibility issues with AI SDK 5.0
export const reasoningModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'This is a reasoning model response.' }],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    warnings: [],
  }),
  // @ts-ignore - Parameter type compatibility
  doStream: async ({ prompt }: any) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 500,
      chunks: getResponseChunksByPrompt(prompt, true),
    }),
  }),
});

// @ts-ignore - MockLanguageModelV2 API compatibility issues with AI SDK 5.0
export const titleModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'This is a test title' }],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    warnings: [],
  }),
  // @ts-ignore - Parameter type compatibility
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: [
        { type: 'text-delta', id: 'test-id', delta: 'This is a test title' },
        {
          type: 'finish',
          finishReason: 'stop',
          logprobs: undefined,
          usage: { completionTokens: 10, promptTokens: 3 },
        },
      ],
    }),
  }),
});

// @ts-ignore - MockLanguageModelV2 API compatibility issues with AI SDK 5.0
export const artifactModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'This is an artifact model response.' }],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    warnings: [],
  }),
  // @ts-ignore - Parameter type compatibility
  doStream: async ({ prompt }: any) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt(prompt),
    }),
  }),
});
