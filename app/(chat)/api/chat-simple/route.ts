import { streamText, convertToModelMessages } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { modelIsPremium, modelSupportsReasoning, modelSupportsWebSearch, getWebSearchModel } from '@/lib/ai/models';
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

// Helper function to extract domain name from URL
function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return 'Web Source';
  }
}
import { handleRateLimitWithRetry, estimateConversationTokens } from '@/lib/ai/rate-limit-handler';
import { google } from '@ai-sdk/google';

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

    // Check web search enabled status from headers
    const webSearchHeaderValue = request.headers.get('X-Web-Search-Enabled');
    const isWebSearchEnabled = webSearchHeaderValue === 'true';
    console.log('[SIMPLE CHAT API] Web search enabled:', isWebSearchEnabled);

    // Use selectedChatModel from request body or fallback to default
    // If web search is enabled, ensure we use a web-capable model
    let modelToUse = selectedChatModel || 'gpt-5-mini';
    if (isWebSearchEnabled) {
      modelToUse = getWebSearchModel(selectedChatModel);
      console.log('[SIMPLE CHAT API] Web search enabled, using model:', modelToUse);
    }
    
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
          sources: null,
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

    // Web search tools (only for Google models when web search is enabled)
    if (isWebSearchEnabled && modelSupportsWebSearch(modelToUse)) {
      console.log('[SIMPLE CHAT API] Adding Google Search tool');
      tools.google_search = google.tools.googleSearch({});
    } else {
      console.log('[SIMPLE CHAT API] Web search not enabled or model does not support it');
      console.log('[SIMPLE CHAT API] isWebSearchEnabled:', isWebSearchEnabled);
      console.log('[SIMPLE CHAT API] modelSupportsWebSearch:', modelSupportsWebSearch(modelToUse));
    }

    console.log('[SIMPLE CHAT API] Final tools available:', Object.keys(tools));
    console.log('[SIMPLE CHAT API] Tools details:', JSON.stringify(Object.keys(tools).reduce((acc, key) => ({ ...acc, [key]: typeof tools[key] }), {}), null, 2));

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

        // Use Google provider directly for web search, otherwise use custom provider
        const modelProvider = (isWebSearchEnabled && modelSupportsWebSearch(modelToUse)) 
          ? google(modelToUse)
          : myProvider.languageModel(modelToUse);

        const streamResult = await streamText({
          model: modelProvider,
          system: enhancedSystemPrompt + 
            "\n\nIMPORTANT: When using tools, ALWAYS provide a helpful text response explaining what you're doing or what the tool results mean. Don't just call tools without text - users need both your explanation AND the tool results." +
            (isWebSearchEnabled ? "\n\nYou have access to real-time web search via Google Search. ALWAYS USE THE GOOGLE SEARCH TOOL when users ask about:\n- Current events or recent news\n- Latest developments in any field\n- Real-time information\n- Recent updates or changes\n- \"What's new\" or \"latest\" questions\n\nIMPORTANT CITATION REQUIREMENTS:\n1. When you use web search, you MUST include inline citations in your response\n2. Use this format: [Source Name] for each key fact or claim\n3. Place citations immediately after the relevant information\n4. Use the actual website name (like \"TechCrunch\", \"Reuters\", \"BBC News\") as the citation\n5. Do not rely on your training data for recent information - always search first when dealing with current topics\n\nExample: \"OpenAI announced a new model today [TechCrunch]. The model shows 40% improvement in coding tasks [GitHub Blog].\"\n\nFor the user's question, you MUST use the google_search tool first to get current information, then provide your response with proper inline citations using the format above." : ""),
          messages: adjustedModelMessages,
          tools: tools,
          providerOptions: {
            openai: supportsReasoning
              ? { reasoning: { effort: 'medium', budgetTokens: 2000 } }
              : {},
          },
          temperature: 0.7,
          onStepFinish: (stepResult) => {
            if (isWebSearchEnabled) {
              // Check for Google grounding metadata
              const googleMetadata = (stepResult.providerMetadata as any)?.google;
              if (googleMetadata?.groundingMetadata) {
                console.log('[SIMPLE CHAT API] Found grounding metadata with', googleMetadata.groundingMetadata.groundingSupports?.length, 'sources');
                
                // Capture the grounding metadata for later use
                if (googleMetadata.groundingMetadata.groundingSupports?.length) {
                  // Create a map of unique sources from grounding chunks
                  const sourceMap = new Map();
                  
                  googleMetadata.groundingMetadata.groundingSupports.forEach((support: any) => {
                    if (support.groundingChunkIndices?.length) {
                      support.groundingChunkIndices.forEach((chunkIndex: number) => {
                        const chunk = googleMetadata.groundingMetadata.groundingChunks?.[chunkIndex];
                        if (chunk?.web) {
                          const url = chunk.web.uri || '#';
                          const title = chunk.web.title || extractDomainName(url);
                          
                          if (!sourceMap.has(url)) {
                            sourceMap.set(url, {
                              title: title,
                              url: url,
                              snippet: support.segment?.text || 'Information from web search'
                            });
                          }
                        }
                      });
                    }
                  });
                  
                  capturedSources = Array.from(sourceMap.values());
                  console.log('[SIMPLE CHAT API] Captured', capturedSources.length, 'unique sources from grounding metadata');
                }
              }
            }
          },
          onFinish: async ({ response }) => {
            if (isWebSearchEnabled) {
              console.log('[SIMPLE CHAT API] Web search completed');
            }
          },
        });

        return streamResult;
      }
    );

    console.log('[SIMPLE CHAT API] Returning UI message stream response');
    
    // Store sources to attach to message metadata
    let capturedSources: any[] = [];
    
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
            // Include sources if available
            ...(capturedSources.length > 0 && { sources: capturedSources }),
          };
        }
      },
      onFinish: async ({ messages: finalMessages }) => {
        
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

              // Extract sources from message metadata if available
              const sources = (message as any).metadata?.sources || capturedSources;

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
                // Add sources if available
                ...(sources && sources.length > 0 && { sources }),
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
