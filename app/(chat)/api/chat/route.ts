import {
  type UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import {
  createMemoryEnabledSystemPrompt,
  storeMessageInMemory,
} from '@/lib/ai/memory/middleware';
import { systemPrompt } from '@/lib/ai/prompts';

export const maxDuration = 60;

// Get Papr Memory API key from environment
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';

// Create memory-enabled system prompt
const memoryEnabledSystemPrompt = createMemoryEnabledSystemPrompt({
  apiKey: PAPR_MEMORY_API_KEY,
});

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // STEP 1: First, save the message to our database
    console.log('[Memory] Saving user message to database...');
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts.map((part) => {
            if (part.type === 'text') {
              return part;
            }
            // Convert any non-text parts to text parts
            return { type: 'text', text: String(part) };
          }),
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });
    console.log('[Memory] User message saved to database');

    // STEP 2: Process AI response with memory search as a tool
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Check if memory search is enabled in the request
        const memoryHeaderValue = request.headers.get('X-Memory-Enabled');
        console.log(
          '[Memory DEBUG] X-Memory-Enabled header value:',
          memoryHeaderValue,
        );
        // Check specifically for 'true' string value
        const isMemoryEnabled = memoryHeaderValue === 'true';
        console.log('[Memory DEBUG] Memory enabled:', isMemoryEnabled);

        // Get base system prompt
        const baseSystemPrompt = systemPrompt({ selectedChatModel });

        // Add memory context to system prompt if enabled
        const enhancedSystemPrompt = isMemoryEnabled
          ? `${baseSystemPrompt}\n\nYou have access to a memory search tool that can find relevant past conversations and information. Use it when you need to recall past context or information from previous conversations. The tool returns an array of memory objects with content and timestamp.`
          : baseSystemPrompt;

        console.log('[Memory] System prompt generation complete');

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
          messages,
          maxSteps: 5,
          temperature: selectedChatModel === 'chat-model-reasoning' ? 1 : 0,
          experimental_activeTools: [
            'getWeather',
            'createDocument',
            'updateDocument',
            'requestSuggestions',
            ...(isMemoryEnabled ? (['searchMemories'] as const) : []),
          ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            ...(isMemoryEnabled
              ? { searchMemories: searchMemories({ session, dataStream }) }
              : {}),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                });

                // Save the AI response to database
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: (assistantMessage.parts || []).map((part) => {
                        if (
                          part.type === 'text' ||
                          part.type === 'reasoning' ||
                          part.type === 'tool-invocation'
                        ) {
                          return part;
                        }
                        // Convert any unknown part types to text
                        return { type: 'text', text: String(part) };
                      }),
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });

                // Store the user message in memory if enabled
                if (
                  isMemoryEnabled &&
                  PAPR_MEMORY_API_KEY &&
                  session.user?.id
                ) {
                  console.log('-------------------------------------');
                  console.log(
                    `[Memory] Processing memory storage for user ${session.user.id} AFTER AI response`,
                  );
                  console.log(`[Memory] Chat ID: ${id}`);
                  console.log(`[Memory] Message ID: ${userMessage.id}`);

                  try {
                    console.log('[Memory] Calling storeMessageInMemory...');
                    const success = await storeMessageInMemory({
                      userId: session.user.id,
                      chatId: id,
                      message: userMessage,
                      apiKey: PAPR_MEMORY_API_KEY,
                    });

                    if (success) {
                      console.log(
                        '[Memory] Successfully stored message in memory',
                      );
                    } else {
                      console.log('[Memory] Failed to store message in memory');
                    }
                  } catch (error) {
                    console.error(
                      '[Memory] Error storing message in memory:',
                      error,
                    );
                  }
                  console.log('-------------------------------------');
                }
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error('STREAMING ERROR:', error);

        // Log additional details about the error
        if (error instanceof Error) {
          console.error('Stream error message:', error.message);
          console.error('Stream error stack:', error.stack);
        }

        return 'Oops, an error occurred during processing. Please try again.';
      },
    });
  } catch (error) {
    console.error('CHAT API ERROR:', error);

    // Log additional details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Check for specific error types
    if (error instanceof TypeError) {
      console.error(
        'Type error - likely an issue with the model or middleware',
      );
    }

    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
