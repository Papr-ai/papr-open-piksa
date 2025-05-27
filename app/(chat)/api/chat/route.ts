import {
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
import type { ExtendedUIMessage } from '@/lib/types';

export const maxDuration = 60;

// Get Papr Memory API key from environment
const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY || '';

// Update sanitization function to return messages in the correct format
function sanitizeMessageForAI(message: ExtendedUIMessage) {
  // Create a new message with only the properties expected by the AI SDK
  return {
    id: message.id,
    role: message.role,
    content: message.parts?.find(part => part.type === 'text')?.text || '',
    // Only include these if they exist and are needed
    tool_calls: message.tool_calls,
    toolInvocations: message.toolInvocations,
  };
}

// Function to extract memories from tool calls if present
function extractMemoriesFromToolCalls(message: any): any[] | null {
  if (!message) return null;
  
  // Check for toolInvocations first (newer format)
  if (message.toolInvocations?.length) {
    for (const invocation of message.toolInvocations) {
      if (
        (invocation.toolName === 'searchMemories' ||
         invocation.toolName === 'mcp_Papr_MCP_Server_get_memory') &&
        invocation.result?.memories?.length
      ) {
        console.log(`[Memory] Found memories in tool invocation for message ${message.id}`);
        return invocation.result.memories;
      }
    }
  }
  
  // Check for tool_calls (older format)
  if (message.tool_calls?.length) {
    for (const call of message.tool_calls) {
      if (
        call?.function?.name && 
        (call.function.name.includes('searchMemories') || 
         call.function.name.includes('get_memory')) &&
        call.function?.output
      ) {
        try {
          const output = typeof call.function.output === 'string' 
            ? JSON.parse(call.function.output) 
            : call.function.output;
          
          if (output?.memories?.length) {
            console.log(`[Memory] Found memories in tool_calls for message ${message.id}`);
            return output.memories;
          }
        } catch (e) {
          console.error(`[Memory] Error parsing tool call output:`, e);
        }
      }
    }
  }
  
  return null;
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<ExtendedUIMessage>;
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
          tool_calls: null,
          attachments: userMessage.experimental_attachments ?? [],
          memories: null,
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
          ? `${baseSystemPrompt}\n\n
IMPORTANT MEMORY TOOL INSTRUCTIONS:
You have access to a memory search tool that can find relevant past conversations and information. Use it when you need to recall past context or information from previous conversations.

When using the searchMemories tool:
1. ONLY use this tool when the user asks about past conversations or when you need context from previous interactions
2. NEVER include the raw tool response or any JSON in your message text
3. NEVER format memory results as code blocks or lists in your response
4. After using the tool, ONLY reference the information in a natural conversational way
5. The memory results will be automatically displayed to the user in a separate UI component
6. If the initial search doesn't find what you're looking for, try searching again with different keywords or phrasings
7. You can make up to 5 memory searches per response to find the most relevant information

IMPORTANT: If you use the searchMemories tool, do NOT manually format the results in your response. The tool output is handled separately by the UI.

Examples of INCORRECT usage (DO NOT DO THIS):
- Including JSON output: \`\`\`{ "memories": [...] }\`\`\`
- Listing memories: "Here are your memories: 1. 2025-01-01: Memory content"
- Date-based formatting: "2025-01-01: Memory content"
`
          : baseSystemPrompt;

        console.log('[Memory] System prompt generation complete');

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: enhancedSystemPrompt,
          // Sanitize all messages to prevent errors from additional properties
          messages: messages.map(sanitizeMessageForAI),
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
                  console.error(
                    '[CHAT API] No assistant message found in response',
                  );
                  dataStream.writeData({
                    type: 'status',
                    content: 'idle',
                  });
                  dataStream.writeData({
                    type: 'finish',
                    content: '',
                  });
                  return;
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                }) as [ExtendedUIMessage, ExtendedUIMessage];

                // Extract memories from tool calls if present
                const memories = extractMemoriesFromToolCalls(assistantMessage);
                
                if (memories && memories.length > 0) {
                  console.log(`[Memory] Found ${memories.length} memories in assistant message, storing directly in message record`);
                }

                // Save the AI response to database with memories included
                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts || [],
                      tool_calls: assistantMessage.tool_calls || null,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      memories: memories, // Include the memories directly in the message record
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
                  try {
                    console.log('[Memory] Calling storeMessageInMemory...');
                    await storeMessageInMemory({
                      userId: session.user.id,
                      chatId: id,
                      message: userMessage,
                      apiKey: PAPR_MEMORY_API_KEY,
                    });
                  } catch (memoryError) {
                    console.error(
                      '[Memory] Error storing message in memory:',
                      memoryError,
                    );
                    // Continue even if memory storage fails
                  }
                }

                // Signal successful completion
                dataStream.writeData({
                  type: 'status',
                  content: 'idle',
                });
                dataStream.writeData({
                  type: 'finish',
                  content: '',
                });
              } catch (error) {
                console.error('[CHAT API] Error in onFinish:', error);
                // Signal error but allow the stream to complete
                dataStream.writeData({
                  type: 'status',
                  content: 'idle',
                });
                dataStream.writeData({
                  type: 'finish',
                  content: '',
                });
              }
            } else {
              // Handle case where session.user.id is not available
              console.error('[CHAT API] No user ID available in session');
              dataStream.writeData({
                type: 'status',
                content: 'idle',
              });
              dataStream.writeData({
                type: 'finish',
                content: '',
              });
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        try {
          await result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        } catch (streamError) {
          console.error('[CHAT API] Error consuming stream:', streamError);

          // Log more detailed information
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            console.log('[CHAT API] Last message role:', lastMessage.role);

            // Check for tool_calls
            if (lastMessage.tool_calls) {
              console.log(
                '[CHAT API] Tool calls found:',
                lastMessage.tool_calls.length,
              );
              lastMessage.tool_calls.forEach((tc, idx) => {
                console.log(`[CHAT API] Tool call #${idx + 1}:`, {
                  name: tc.function?.name,
                  hasOutput: !!tc.function?.output,
                });
              });
            }
          }

          dataStream.writeData({
            type: 'status',
            content: 'idle',
          });
          dataStream.writeData({
            type: 'finish',
            content: '',
          });
        }
      },
      onError: (error: unknown) => {
        console.error('[CHAT API] STREAMING ERROR:', error);

        if (error instanceof Error) {
          console.error('[CHAT API] Stream error message:', error.message);
          console.error('[CHAT API] Stream error stack:', error.stack);
        }

        return 'An error occurred during processing. Please try again.';
      },
    });
  } catch (error) {
    console.error('[CHAT API] ERROR:', error);

    // Log additional details about the error
    if (error instanceof Error) {
      console.error('[CHAT API] Error message:', error.message);
      console.error('[CHAT API] Error stack:', error.stack);
    }

    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
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
