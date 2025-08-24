import { streamText, convertToModelMessages } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { modelIsPremium, modelSupportsReasoning } from '@/lib/ai/models';
import { checkModelAccess } from '@/lib/subscription/utils';
import { checkBasicInteractionLimit, checkPremiumInteractionLimit, trackBasicInteraction, trackPremiumInteraction } from '@/lib/subscription/usage-middleware';
import { getMostRecentUserMessage } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { saveMessages, getChatById, saveChat } from '@/lib/db/queries';
import { generateTitleFromUserMessage } from '../../actions';
import type { ExtendedUIMessage } from '@/lib/types';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { addMemory } from '@/lib/ai/tools/add-memory';
import { createMemoryEnabledSystemPrompt } from '@/lib/ai/memory/middleware';
import { systemPrompt } from '@/lib/ai/prompts';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { createTaskTrackerTools } from '@/lib/ai/tools/task-tracker';
import { 
  createListRepositoriesTool,
  createCreateProjectTool,
  createGetRepositoryFilesTool,
  createGetFileContentTool,
  createSearchFilesTool,
  createOpenFileExplorerTool,
  createCreateRepositoryTool,
  createUpdateStagedFileTool,
  createGetStagingStateTool,
  createClearStagedFilesTool
} from '@/lib/ai/tools/github-integration';
import { checkOnboardingStatus } from '@/lib/auth/onboarding-middleware';
import { handleRateLimitWithRetry, estimateConversationTokens } from '@/lib/ai/rate-limit-handler';

// Simple chat API that works with useChat hook
export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<ExtendedUIMessage>;
      selectedChatModel?: string;
    } = await request.json();

    const modelToUse = selectedChatModel || 'gpt-5-mini';
    console.log('[SIMPLE CHAT API] Using model:', modelToUse);

    // Check onboarding status first - this includes auth check
    const onboardingResult = await checkOnboardingStatus();
    if (!onboardingResult.isCompleted) {
      return onboardingResult.response!;
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check model access
    const modelAccess = await checkModelAccess(session.user.id, modelToUse);
    if (!modelAccess.allowed) {
      return new Response(JSON.stringify({ 
        error: modelAccess.reason || 'Model access denied',
        code: 'MODEL_ACCESS_DENIED'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check usage limits
    const isPremium = modelIsPremium(modelToUse);
    const usageCheck = isPremium 
      ? await checkPremiumInteractionLimit(session.user.id)
      : await checkBasicInteractionLimit(session.user.id);
      
    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: usageCheck.reason,
        code: 'USAGE_LIMIT_EXCEEDED',
        usage: usageCheck.usage,
        shouldShowUpgrade: usageCheck.shouldShowUpgrade
      }), { 
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check memory enabled status from headers
    const memoryHeaderValue = request.headers.get('X-Memory-Enabled');
    const isMemoryEnabled = memoryHeaderValue === 'true';
    console.log('[SIMPLE CHAT API] Memory enabled:', isMemoryEnabled);

    const userMessage = getMostRecentUserMessage(messages);
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Ensure chat exists (create if it doesn't)
    const chat = await getChatById({ id });
    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });
      await saveChat({ id, userId: session.user.id, title });
      console.log('[SIMPLE CHAT API] Created new chat with title:', title);
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Save user message
    console.log('[SIMPLE CHAT API] Processing message for user:', session.user.id);
    console.log('[SIMPLE CHAT API] Message count:', messages.length);
    console.log('[SIMPLE CHAT API] Estimated tokens:', estimateConversationTokens(messages));
    console.log('[SIMPLE CHAT API] Saving user message to database...');
    await saveMessages({
      messages: [
        {
          id: userMessage.id,
          chatId: id,
          role: 'user',
          parts: userMessage.parts,
          tool_calls: null,
          attachments: [],
          memories: null,
          modelId: null,
          createdAt: new Date(),
        }
      ]
    });
    console.log('[SIMPLE CHAT API] User message saved to database');

    // Convert UI messages to model messages format with hardening against malformed parts
    let modelMessages;
    try {
      modelMessages = convertToModelMessages(messages, {
        ignoreIncompleteToolCalls: true,
      });
    } catch (conversionError) {
      console.error('[SIMPLE CHAT API] convertToModelMessages failed, sanitizing messages:', conversionError);
      // Fallback: drop any non-text/file parts and retry
      const sanitizedMessages = messages.map((m: any) => ({
        ...m,
        // Keep only valid, simple parts to avoid unsupported states
        parts: Array.isArray(m.parts)
          ? m.parts.filter((p: any) => p && typeof p === 'object' && (p.type === 'text' || p.type === 'file'))
          : m.parts,
      }));

      modelMessages = convertToModelMessages(sanitizedMessages, {
        ignoreIncompleteToolCalls: true,
      });
    }

    const supportsReasoning = modelSupportsReasoning(modelToUse);
    console.log('[SIMPLE CHAT API] Model supports reasoning:', supportsReasoning);

    // Prepare tools - note: dataStream is used for progress updates during tool execution
    // In the simple route, we don't have the complex streaming setup, but tools still return real data
    const dataStream = {
      write: (data: any) => {
        // For now, just log progress updates - could be enhanced to send to client
        console.log('[SIMPLE CHAT] Tool progress:', data);
      }
    };
    
    const tools: any = {};
    
    // Always available tools
    tools.getWeather = getWeather;
    tools.createDocument = createDocument({ session, dataStream });
    tools.updateDocument = updateDocument({ session, dataStream });
    tools.requestSuggestions = requestSuggestions({ session, dataStream });
    
    // GitHub tools
    tools.listRepositories = createListRepositoriesTool({ session, dataStream });
    tools.createProject = createCreateProjectTool({ session, dataStream });
    tools.getRepositoryFiles = createGetRepositoryFilesTool({ session, dataStream });
    tools.getFileContent = createGetFileContentTool({ session, dataStream });
    tools.searchFiles = createSearchFilesTool({ session, dataStream });
    tools.openFileExplorer = createOpenFileExplorerTool({ session, dataStream });
    tools.createRepository = createCreateRepositoryTool({ session, dataStream });
    tools.updateStagedFile = createUpdateStagedFileTool({ session, dataStream });
    tools.getStagingState = createGetStagingStateTool({ session, dataStream });
    tools.clearStagedFiles = createClearStagedFilesTool({ session, dataStream });
    
    // Task tracker tools
    const taskTrackerTools = createTaskTrackerTools(dataStream);
    tools.createTaskPlan = taskTrackerTools.createTaskPlan;
    tools.updateTask = taskTrackerTools.updateTask;
    tools.completeTask = taskTrackerTools.completeTask;
    tools.getTaskStatus = taskTrackerTools.getTaskStatus;
    tools.addTask = taskTrackerTools.addTask;
    
    // Memory tools (if enabled)
    if (isMemoryEnabled) {
      tools.searchMemories = searchMemories({ 
        session: { user: session.user! } as any
      });
      tools.addMemory = addMemory({ 
        session: { user: session.user! } as any
      });
    }

    // Get system prompt (memory-enabled or regular)
    const apiKey = process.env.PAPR_MEMORY_API_KEY;
    let enhancedSystemPrompt: string;
    
    if (isMemoryEnabled && apiKey) {
      const memorySystemPromptGenerator = createMemoryEnabledSystemPrompt({ apiKey });
      enhancedSystemPrompt = await memorySystemPromptGenerator({
        selectedChatModel: modelToUse,
        userId: session.user!.id,
        messages: messages,
      });
      console.log('[SIMPLE CHAT API] Using memory-enabled system prompt');
    } else {
      enhancedSystemPrompt = systemPrompt({ selectedChatModel: modelToUse });
      console.log('[SIMPLE CHAT API] Using standard system prompt');
    }

    // Use rate limit handler with automatic retry
    const result = await handleRateLimitWithRetry(
      messages,
      modelToUse,
      async (messagesToUse) => {
        console.log(`[SIMPLE CHAT API] Attempting API call with ${messagesToUse.length} messages`);
        
        // Convert messages to model format for the actual API call
        let adjustedModelMessages;
        try {
          adjustedModelMessages = convertToModelMessages(messagesToUse, {
            ignoreIncompleteToolCalls: true,
          });
        } catch (conversionError) {
          console.error('[SIMPLE CHAT API] convertToModelMessages failed for truncated messages, sanitizing:', conversionError);
          const sanitizedMessages = messagesToUse.map((m: any) => ({
            ...m,
            parts: Array.isArray(m.parts)
              ? m.parts.filter((p: any) => p && typeof p === 'object' && (p.type === 'text' || p.type === 'file'))
              : m.parts,
          }));
          adjustedModelMessages = convertToModelMessages(sanitizedMessages, {
            ignoreIncompleteToolCalls: true,
          });
        }

        return await streamText({
          model: myProvider.languageModel(modelToUse),
          system: enhancedSystemPrompt + 
            "\n\nIMPORTANT: When using tools, ALWAYS provide a helpful text response explaining what you're doing or what the tool results mean. Don't just call tools without text - users need both your explanation AND the tool results.",
          messages: adjustedModelMessages,
          tools: tools,
          providerOptions: {
            openai: supportsReasoning
              ? { reasoning: { effort: 'medium', budgetTokens: 2000 } }
              : {},
          },
          temperature: 0.7,
        });
      }
    );

    console.log('[SIMPLE CHAT API] Returning UI message stream response');
    return result.toUIMessageStreamResponse<ExtendedUIMessage>({
      originalMessages: messages, // keeps strong typing of metadata on the client
      sendReasoning: true,        // forwards reasoning parts when provider supports them
      messageMetadata: ({ part }) => {
        // Attach metadata at start/finish (visible on client as message.metadata)
        if (part.type === 'start') {
          return { model: modelToUse, createdAt: Date.now() };
        }
        if (part.type === 'finish') {
          return {
            totalTokens: part.totalUsage?.totalTokens,
            inputTokens: part.totalUsage?.inputTokens,
            outputTokens: part.totalUsage?.outputTokens,
          };
        }
      },
      onFinish: async ({ messages: finalMessages }) => {
        console.log('[SIMPLE CHAT API] onFinish called with messages:', finalMessages.length);
        console.log('[SIMPLE CHAT API] Final messages structure:', JSON.stringify(finalMessages, null, 2));
        
        try {
          // Track usage
          const userId = session.user?.id;
          if (userId) {
            if (isPremium) {
              await trackPremiumInteraction(userId);
              console.log('[SIMPLE CHAT API] Tracked premium interaction');
            } else {
              await trackBasicInteraction(userId);
              console.log('[SIMPLE CHAT API] Tracked basic interaction');
            }
          }

          // Save all new messages (assistant messages with tool results)
          const newMessages = finalMessages.slice(messages.length); // Get only new messages
          console.log('[SIMPLE CHAT API] New messages to save:', newMessages.length);
          console.log('[SIMPLE CHAT API] New messages details:', JSON.stringify(newMessages, null, 2));
          
          for (const message of newMessages) {
            console.log('[SIMPLE CHAT API] Processing message:', {
              role: message.role,
              id: message.id,
              partsCount: message.parts?.length || 0,
              partsTypes: message.parts?.map(p => (p as any).type) || []
            });
            
            if (message.role === 'assistant') {
              console.log('[SIMPLE CHAT API] Saving assistant message with parts:', message.parts.length);
              console.log('[SIMPLE CHAT API] Parts details:', JSON.stringify(message.parts, null, 2));
              console.log('[SIMPLE CHAT API] Model to save:', modelToUse);
              
              // Extract tool calls from parts for the tool_calls field
              const toolCalls = message.parts
                .filter((part: any) => part.type && part.type.startsWith('tool-'))
                .map((part: any) => ({
                  id: part.toolCallId,
                  type: 'function',
                  function: {
                    name: part.type.replace('tool-', ''),
                    arguments: JSON.stringify(part.input || {}),
                  },
                  // Don't include the result/output - that stays in parts for UI rendering
                }));
              
              console.log('[SIMPLE CHAT API] Extracted tool calls:', JSON.stringify(toolCalls, null, 2));

              const messageToSave = {
                id: message.id || generateUUID(), // Generate ID if empty
                chatId: id,
                role: 'assistant',
                parts: message.parts,
                tool_calls: toolCalls.length > 0 ? toolCalls : null,
                attachments: [],
                memories: null,
                modelId: modelToUse,
                createdAt: new Date(),
              };
              
              console.log('[SIMPLE CHAT API] Message object to save:', JSON.stringify(messageToSave, null, 2));
              
              await saveMessages({
                messages: [messageToSave]
              });
              
              console.log('[SIMPLE CHAT API] Assistant message saved successfully');
            }
          }
        } catch (error) {
          console.error('[SIMPLE CHAT API] Error in onFinish:', error);
        }
      },
    });

  } catch (error) {
    console.error('[SIMPLE CHAT API] ERROR:', error);
    return new Response(JSON.stringify({
      error: 'An error occurred while processing your request.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
