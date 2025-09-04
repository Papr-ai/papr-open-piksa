import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { myProvider } from '@/lib/ai/providers';
import { modelIsPremium, modelSupportsReasoning, modelSupportsWebSearch, getWebSearchModel } from '@/lib/ai/models';
import { checkModelAccess } from '@/lib/subscription/utils';
import { checkBasicInteractionLimit, checkPremiumInteractionLimit, trackBasicInteraction, trackPremiumInteraction } from '@/lib/subscription/usage-middleware';
import { getMostRecentUserMessage } from '@/lib/utils';
import { generateUUID } from '@/lib/utils';
import { saveMessages, getChatById, saveChat } from '@/lib/db/queries';
import { generateTitleFromUserMessage } from '../../actions';
import { getOrCreateChatContext } from '@/lib/ai/memory/chat-context';
import type { ExtendedUIMessage } from '@/lib/types';
import { searchMemories } from '@/lib/ai/tools/search-memories';
import { addMemory } from '@/lib/ai/tools/add-memory';
import { createMemoryEnabledSystemPrompt, intelligentlyStoreMessageInMemory } from '@/lib/ai/memory/middleware';
import { shouldAnalyzeConversation, processConversationCompletion } from '@/lib/ai/conversation-insights';
import { handleNewChatCreation } from '@/lib/ai/chat-history-context';
import { systemPrompt } from '@/lib/ai/prompts';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { createBook } from '@/lib/ai/tools/create-book';
import { searchBooks } from '@/lib/ai/tools/search-books';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { createTaskTrackerTools } from '@/lib/ai/tools/task-tracker';
import { createImage } from '@/lib/ai/tools/create-image';
import { createWritingTools } from '@/lib/ai/tools/create-writing-tools';
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
import { handleRateLimitWithRetry } from '@/lib/ai/rate-limit-handler';
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
    console.log('[SIMPLE CHAT API] Memory header value:', memoryHeaderValue);
    console.log('[SIMPLE CHAT API] Memory enabled:', isMemoryEnabled);
    console.log('[SIMPLE CHAT API] All headers:', Object.fromEntries(request.headers.entries()));

    const userMessage = getMostRecentUserMessage(messages);
    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Get or create chat with user context (handles both new and existing chats)
    const { chatExists, userContext, contextString } = await getOrCreateChatContext(
      id,
      session.user.id,
      messages
    );

    if (chatExists) {
      // Verify ownership for existing chat
      const chat = await getChatById({ id });
      if (chat && chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      console.log('[SIMPLE CHAT API] Created new chat with user context');
    }

    // Save user message
    console.log('[SIMPLE CHAT API] Processing message for user:', session.user.id);
    console.log('[SIMPLE CHAT API] Message count:', messages.length);

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
          memoryDecision: null, // Will be updated later with actual decision
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
    tools.createBook = createBook({ session, dataStream });
    tools.searchBooks = searchBooks({ session });
    tools.requestSuggestions = requestSuggestions({ session, dataStream });
    tools.createImage = createImage({ session });
    tools.createWritingTools = createWritingTools({ session, dataStream });
    
    // Enhanced book creation workflow tools
    const { createEnhancedBookTools } = await import('@/lib/ai/tools/enhanced-book-tools');
    const enhancedBookTools = createEnhancedBookTools(session, dataStream);
    tools.createBookPlan = enhancedBookTools.createBookPlan;
    tools.draftChapter = enhancedBookTools.draftChapter;
    tools.segmentChapterIntoScenes = enhancedBookTools.segmentChapterIntoScenes;
    tools.createCharacterPortraits = enhancedBookTools.createCharacterPortraits;
    tools.createEnvironments = enhancedBookTools.createEnvironments;
    tools.createSceneManifest = enhancedBookTools.createSceneManifest;
    tools.renderScene = enhancedBookTools.renderScene;
    tools.completeBook = enhancedBookTools.completeBook;
    
    // Book workflow status tool
    const { getBookWorkflowStatus } = await import('@/lib/ai/tools/book-workflow-status');
    tools.getBookWorkflowStatus = getBookWorkflowStatus({ session });
    
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
    const taskTrackerTools = createTaskTrackerTools(dataStream, session);
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
    
    // Use system prompt with memory instructions if memory is enabled
    const baseSystemPrompt = systemPrompt({ selectedChatModel: modelToUse });
    
    // Get chat history context for newly created chats only
    let chatHistoryContext = '';
    if (!chatExists && isMemoryEnabled && apiKey && session?.user?.id) {
      console.log('[SIMPLE CHAT API] 🆕 New chat being created, loading chat history context');
      chatHistoryContext = await handleNewChatCreation(session.user.id, apiKey);
    }
    
    // Always include user context if available (regardless of memory toggle)
    let contextualSystemPrompt = baseSystemPrompt;
    
    if (contextString) {
      console.log('[SIMPLE TEXT CHAT] Adding user context to system prompt:');
      console.log('='.repeat(80));
      console.log('User Context Length:', contextString.length);
      console.log('User Context Preview:', contextString.substring(0, 200) + '...');
      console.log('='.repeat(80));
      
      contextualSystemPrompt += `\n\n${contextString}`;
    }
    
    if (chatHistoryContext) {
      console.log('[SIMPLE TEXT CHAT] Adding chat history context');
      contextualSystemPrompt += `\n\n${chatHistoryContext}`;
    }
    
    // Add memory tool instructions if memory is enabled
    enhancedSystemPrompt = isMemoryEnabled 
      ? `${contextualSystemPrompt}\n\n
MEMORY TOOL INSTRUCTIONS:
You have access to memory tools to help maintain context and remember important information about the user.

**searchMemories tool:** Use when you need to recall past conversations or user information.

**addMemory tool - USE THIS NATURALLY:**
- Save important information about the user as you discover it during conversation
- Save user preferences, goals, projects, and interests  
- Save key facts about their work, tools they use, or problems they're solving
- Think of it as taking notes during a conversation - save what would be useful to remember later

**When to use addMemory:**
- When the user shares their goals or projects
- When you learn about their preferences or working style
- When they mention their profession, interests, or expertise
- When they share important context about their work

Use these tools naturally as part of helping the user - you don't need to announce when you're using them.`
      : contextualSystemPrompt;
    
    // Check system prompt size and truncate if necessary to prevent token limit errors
    // Simple character-based estimation: ~4 chars per token
    const systemPromptTokens = Math.ceil(enhancedSystemPrompt.length / 4);
    
    if (systemPromptTokens > 50000) { // If system prompt is over 50k tokens
      
      // Use a much shorter system prompt for large contexts
      enhancedSystemPrompt = `You are Pen, an AI work assistant that helps users find information from their Papr memories and create content. You are tasked with responding to user queries by accessing their saved Papr memories when enabled (currently: ${isMemoryEnabled}). Today is ${new Date().toISOString().split('T')[0]}.

You are also an expert software developer and system architect. You excel at:
- Breaking down complex problems into clear, actionable steps  
- Writing clean, production-ready code with proper structure and documentation
- Following best practices for software development and system design

## 📖 Book Writing Support
When you detect book writing requests, always use the createBook tool for substantial book content. This tool manages the entire book structure and individual chapters.

**Memory Management:**
- Always check memory first when users ask about something not in context
- Use add_memory tool to save important information from conversations
- Use search_memories tool to recall past conversations
- Cite memories using source URLs when retrieved

**Response Quality:**
Be helpful and concise. Use markdown formatting with headers, bullet points, and code blocks. Provide actionable feedback and maintain consistency across conversations.${isMemoryEnabled ? `

**MEMORY TOOL INSTRUCTIONS:**
- searchMemories: Use when you need to recall past conversations or user information
- addMemory: Save important user information, preferences, goals, and context naturally during conversation` : ''}`;
      

    }
    
    console.log(`[SIMPLE CHAT API] Using ${isMemoryEnabled ? 'memory-enabled' : 'standard'} system prompt`);

    // Function to sanitize tool names to match OpenAI pattern ^[a-zA-Z0-9_-]+$
    const sanitizeToolName = (name: string): string => {
      return name.replace(/[^a-zA-Z0-9_-]/g, '_');
    };

    // Pre-process messages to handle orphaned tool calls and remove large binary data
    const preprocessedMessages = messages.map((msg, msgIndex) => {
      if (msg.parts) {
        msg.parts = msg.parts.map((part: any) => {
          // Sanitize tool names for all tool-related parts
          if (part.type === 'tool-call' && part.toolName) {
            const sanitizedName = sanitizeToolName(part.toolName);
            if (sanitizedName !== part.toolName) {
              console.log(`[SIMPLE CHAT API] Sanitizing tool name: "${part.toolName}" -> "${sanitizedName}"`);
            }
            part = { ...part, toolName: sanitizedName };
          }
          
          if (part.type === 'tool-result' && part.toolName) {
            const sanitizedName = sanitizeToolName(part.toolName);
            if (sanitizedName !== part.toolName) {
              console.log(`[SIMPLE CHAT API] Sanitizing tool result name: "${part.toolName}" -> "${sanitizedName}"`);
            }
            part = { ...part, toolName: sanitizedName };
          }
          
          // If this is a tool result with large data, sanitize it
          if (part.type === 'tool-result' && part.output) {
            const outputStr = JSON.stringify(part.output);
            if (outputStr.length > 100000) { // Over 100k chars
              console.log(`[SIMPLE CHAT API] Pre-processing: Sanitizing large tool result: ${part.toolName}, size: ${outputStr.length}`);
              
              // For image generation, keep only metadata
              if (part.toolName === 'generateImage') {
                return {
                  ...part,
                  output: {
                    type: 'json',
                    value: {
                      id: part.output?.value?.id,
                      imageUrl: part.output?.value?.imageUrl,
                      prompt: part.output?.value?.prompt,
                      style: part.output?.value?.style,
                      context: part.output?.value?.context,
                      // Remove any base64 or large data
                    }
                  }
                };
              }
              
              // For other large tools, truncate
              return {
                ...part,
                output: {
                  type: 'text',
                  value: `[Large tool result truncated - original size: ${outputStr.length} chars]`
                }
              };
            }
          }
          return part;
        });
      }
      return msg;
    });

    console.log(`[SIMPLE CHAT API] Pre-processed ${messages.length} messages, removed large binary data`);

    // Fix orphaned tool calls by adding dummy tool results
    const fixedMessages: any[] = [];
    for (let i = 0; i < preprocessedMessages.length; i++) {
      const currentMsg = preprocessedMessages[i];
      fixedMessages.push(currentMsg);
      
      // Check if this message has tool calls
      const toolCalls = currentMsg.parts?.filter((p: any) => p.type === 'tool-call' && p.toolCallId) || [];
      
      if (toolCalls.length > 0) {
        // Check if the next message has corresponding tool results
        const nextMsg = preprocessedMessages[i + 1];
        const toolResults = nextMsg?.parts?.filter((p: any) => p.type === 'tool-result' && p.toolCallId) || [];
        
        // Find tool calls without corresponding results
        const orphanedCalls = toolCalls.filter((call: any) => 
          !toolResults.some((result: any) => result.toolCallId === call.toolCallId)
        );
        
        if (orphanedCalls.length > 0) {
          console.log(`[SIMPLE CHAT API] Found ${orphanedCalls.length} orphaned tool calls, adding dummy results`);
          
          // Create dummy tool results for orphaned calls
          const dummyResults = orphanedCalls.map((call: any) => ({
            type: 'dynamic-tool' as const,
            toolName: call.toolName || 'unknown',
            toolCallId: call.toolCallId,
            state: 'output-available' as const,
            input: {},
            output: { error: 'Tool call result not found in conversation history' }
          }));
          
          // Add a message with dummy results if next message doesn't exist or is from user
          if (!nextMsg || nextMsg.role === 'user') {
            fixedMessages.push({
              id: `dummy-${Date.now()}-${Math.random()}`,
              role: 'assistant' as const,
              parts: dummyResults
            });
          } else {
            // Add dummy results to existing assistant message
            nextMsg.parts = [...(nextMsg.parts || []), ...dummyResults];
          }
        }
      }
    }

    console.log(`[SIMPLE CHAT API] Fixed messages: ${fixedMessages.length} (was ${preprocessedMessages.length})`);

    // Use rate limit handler with automatic retry
    const result = await handleRateLimitWithRetry(
      fixedMessages,
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

        // CRITICAL: Apply sanitization AFTER conversion to remove large binary data
        adjustedModelMessages = adjustedModelMessages.map((msg: any) => {
          if (msg.content && Array.isArray(msg.content)) {
            msg.content = msg.content.map((part: any) => {
              if (part && typeof part === 'object' && part.text) {
                const textLength = part.text.length;
                if (textLength > 100000) { // Over 100k chars
                  console.log(`[SIMPLE CHAT API] POST-CONVERSION: Sanitizing large content in message, size: ${textLength}`);
                  return {
                    ...part,
                    text: `[Large content truncated - original size: ${textLength} chars]`
                  };
                }
              }
              return part;
            });
          } else if (msg.content && typeof msg.content === 'string' && msg.content.length > 100000) {
            console.log(`[SIMPLE CHAT API] POST-CONVERSION: Sanitizing large string content, size: ${msg.content.length}`);
            msg.content = `[Large content truncated - original size: ${msg.content.length} chars]`;
          }
          return msg;
        });



        // Use Google provider directly for web search, otherwise use custom provider
        const modelProvider = (isWebSearchEnabled && modelSupportsWebSearch(modelToUse)) 
          ? google(modelToUse)
          : myProvider.languageModel(modelToUse);

        // Build final system prompt with additional instructions
        const additionalInstructions = "\n\nIMPORTANT: When using tools, ALWAYS provide a helpful text response explaining what you're doing or what the tools accomplish. DO NOT include raw tool response data or JSON in your text - the UI will handle displaying tool results automatically. Focus on natural language explanations of your actions." +
          (isWebSearchEnabled ? "\n\nYou have access to real-time web search via Google Search. ALWAYS USE THE GOOGLE SEARCH TOOL when users ask about:\n- Current events or recent news\n- Latest developments in any field\n- Real-time information\n- Recent updates or changes\n- \"What's new\" or \"latest\" questions\n\nIMPORTANT CITATION REQUIREMENTS:\n1. When you use web search, you MUST include inline citations in your response\n2. Use this format: [Source Name] for each key fact or claim\n3. Place citations immediately after the relevant information\n4. Use the actual website name (like \"TechCrunch\", \"Reuters\", \"BBC News\") as the citation\n5. Do not rely on your training data for recent information - always search first when dealing with current topics\n\nExample: \"OpenAI announced a new model today [TechCrunch]. The model shows 40% improvement in coding tasks [GitHub Blog].\"\n\nFor the user's question, you MUST use the google_search tool first to get current information, then provide your response with proper inline citations using the format above." : "");
        
        const finalSystemPrompt = enhancedSystemPrompt + additionalInstructions;
        

        
        // Log detailed message content to understand what's being sent
        console.log(`[SIMPLE CHAT API] DETAILED MESSAGE ANALYSIS:`);
        console.log(`  - Total messages: ${adjustedModelMessages.length}`);
        
        adjustedModelMessages.forEach((msg, index) => {
          const msgContent = JSON.stringify(msg);
          const msgLength = msgContent.length;
          const estimatedTokens = Math.ceil(msgLength / 4);
          
          console.log(`  - Message ${index} (${msg.role}): ${msgLength} chars, ~${estimatedTokens} tokens`);
          if (msgLength > 10000) {
            console.log(`    - LARGE MESSAGE DETECTED: ${msgContent.substring(0, 200)}...`);
          }
        });
        
        // Log system prompt details
        console.log(`[SIMPLE CHAT API] SYSTEM PROMPT ANALYSIS:`);
        console.log(`  - System prompt length: ${finalSystemPrompt.length} chars`);
        console.log(`  - System prompt preview: ${finalSystemPrompt.substring(0, 200)}...`);
        

        console.log(`  - Model: ${modelProvider.modelId || 'unknown'}`);
        console.log(`  - Tools count: ${Object.keys(tools).length}`);

                const streamResult = await streamText({
          model: modelProvider,
          stopWhen: [stepCountIs(5)], // Allow up to 5 steps for multi-step reasoning
          system: finalSystemPrompt,
          messages: adjustedModelMessages,
          tools: tools,
          experimental_activeTools: [
            'getWeather',
            'createDocument',
            'updateDocument',
            'createBook',
            'searchBooks',
            'requestSuggestions',
            'createImage',
            'listRepositories',
            'createProject',
            'getRepositoryFiles',
            'getFileContent',
            'searchFiles',
            'openFileExplorer',
            'createRepository',
            'updateStagedFile',
            'getStagingState',
            'clearStagedFiles',
            'createTaskPlan',
            'updateTask',
            'completeTask',
            'getTaskStatus',
            'addTask',
            ...(isMemoryEnabled ? ['searchMemories', 'addMemory'] : []),
            ...(isWebSearchEnabled && modelSupportsWebSearch(modelToUse) ? ['google_search'] : []),
          ],
          providerOptions: {
            openai: supportsReasoning
              ? { reasoning: { effort: 'medium', budgetTokens: 2000 } }
              : {},
          },
          temperature: 0.7,
          onStepFinish: (stepResult) => {
            // Log tool calls for debugging
            if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
              console.log('[SIMPLE CHAT API] Tool calls attempted:', JSON.stringify(stepResult.toolCalls, null, 2));
            }
            if (stepResult.toolResults && stepResult.toolResults.length > 0) {
              console.log('[SIMPLE CHAT API] Tool results:', JSON.stringify(stepResult.toolResults, null, 2));
            }
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
      messageMetadata: ({ part }: { part: any }) => {
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
      onFinish: async ({ messages: finalMessages }: { messages: any }) => {
        
        try {
          // Sanitize messages to remove large binary data before saving
          const sanitizedMessages = finalMessages.map((msg: any) => {
            if (msg.parts) {
              msg.parts = msg.parts.map((part: any) => {
                // If this is a tool result with large data, sanitize it
                if (part.type === 'tool-result' && part.output) {
                  const outputStr = JSON.stringify(part.output);
                  if (outputStr.length > 100000) { // Over 100k chars
                    console.log(`[SIMPLE CHAT API] Sanitizing large tool result: ${part.toolName}, size: ${outputStr.length}`);
                    
                    // For image generation, keep only metadata
                    if (part.toolName === 'generateImage') {
                      return {
                        ...part,
                        output: {
                          type: 'json',
                          value: {
                            id: part.output?.value?.id,
                            imageUrl: part.output?.value?.imageUrl,
                            prompt: part.output?.value?.prompt,
                            style: part.output?.value?.style,
                            context: part.output?.value?.context,
                            // Remove any base64 or large data
                          }
                        }
                      };
                    }
                    
                    // For other large tools, truncate
                    return {
                      ...part,
                      output: {
                        type: 'text',
                        value: `[Large tool result truncated - original size: ${outputStr.length} chars]`
                      }
                    };
                  }
                }
                return part;
              });
            }
            return msg;
          });
          
          // Use sanitized messages for processing
          finalMessages = sanitizedMessages;
          
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

          // Note: Memory is now handled by the AI itself via addMemory tool calls
          console.log('[SIMPLE CHAT API] 💭 Memory handling delegated to AI via tools');

          // Check if we should analyze this conversation for insights
          const allMessages = [...messages, ...finalMessages.slice(messages.length)];
          const PAPR_MEMORY_API_KEY = process.env.PAPR_MEMORY_API_KEY;
          
          console.log('[SIMPLE CHAT API] 🔍 Checking conversation analysis conditions:', {
            messageCount: allMessages.length,
            isMemoryEnabled,
            hasApiKey: !!PAPR_MEMORY_API_KEY,
            shouldAnalyze: shouldAnalyzeConversation(allMessages),
            chatId: id
          });
          
          if (isMemoryEnabled && PAPR_MEMORY_API_KEY && shouldAnalyzeConversation(allMessages)) {
            console.log('[SIMPLE CHAT API] 🔍 Conversation ready for analysis:', {
              messageCount: allMessages.length,
              chatId: id
            });

            // Process conversation insights in the background
            const currentChat = await getChatById({ id });
            processConversationCompletion({
              chatId: id,
              chatTitle: currentChat?.title,
              messages: allMessages,
              userId: userId!,
            }, PAPR_MEMORY_API_KEY).catch(error => {
              console.error('[SIMPLE CHAT API] 🔍 Error processing conversation insights:', error);
            });
          } else {
            console.log('[SIMPLE CHAT API] 🔍 Skipping conversation analysis - conditions not met');
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
              partsTypes: message.parts?.map((p: any) => p.type) || []
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
                memoryDecision: null, // Assistant messages don't have memory decisions
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
